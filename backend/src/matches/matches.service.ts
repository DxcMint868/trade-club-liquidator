import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { MatchStatus } from "@prisma/client";

export interface CreateMatchDto {
  creator: string;
  entryMargin: string;
  duration: number;
  maxParticipants: number;
}

export interface JoinMatchDto {
  matchId: string;
  participant: string;
  stakedAmount: string;
}

export interface UpdatePnLDto {
  matchId: string;
  participant: string;
  pnl: string;
}

@Injectable()
export class MatchesService {
  constructor(
    private db: DatabaseService,
    private contractService: ContractService,
  ) {}

  // Event handlers for blockchain events
  @OnEvent("match.created")
  async handleMatchCreated(payload: any) {
    const {
      matchId,
      creator,
      entryMargin,
      duration,
      maxParticipants,
      blockNumber,
      transactionHash,
    } = payload;

    await this.db.match.create({
      data: {
        matchId,
        creator: creator.toLowerCase(),
        entryMargin,
        duration: parseInt(duration),
        maxParticipants: parseInt(maxParticipants),
        prizePool: "0",
        status: MatchStatus.CREATED,
        createdTxHash: transactionHash,
        blockNumber,
        transactionHash,
      },
    });

    console.log(`✅ Match ${matchId} saved to database`);
  }

  @OnEvent("match.participant-joined")
  async handleParticipantJoined(payload: any) {
    const { matchId, participant, stakedAmount, transactionHash } = payload;

    // Create participant record
    await this.db.participant.create({
      data: {
        matchId,
        address: participant.toLowerCase(),
        stakedAmount,
        pnl: "0",
        joinedTxHash: transactionHash,
      },
    });

    console.log(`✅ Participant ${participant} joined match ${matchId}`);
  }

  @OnEvent("match.started")
  async handleMatchStarted(payload: any) {
    const { matchId, startTime, transactionHash } = payload;

    await this.db.match.update({
      where: { matchId },
      data: {
        status: MatchStatus.ACTIVE,
        startTime: new Date(parseInt(startTime) * 1000),
        startedTxHash: transactionHash,
      },
    });

    console.log(`✅ Match ${matchId} started`);
  }

  @OnEvent("match.completed")
  async handleMatchCompleted(payload: any) {
    const { matchId, winner, prizePool, transactionHash } = payload;

    await this.db.match.update({
      where: { matchId },
      data: {
        status: MatchStatus.COMPLETED,
        winner: winner.toLowerCase(),
        prizePool,
        endTime: new Date(),
        completedTxHash: transactionHash,
      },
    });

    console.log(`✅ Match ${matchId} completed. Winner: ${winner}`);
  }

  @OnEvent("match.pnl-updated")
  async handlePnLUpdated(payload: any) {
    const { matchId, participant, pnl } = payload;

    await this.db.participant.updateMany({
      where: {
        matchId,
        address: participant.toLowerCase(),
      },
      data: {
        pnl,
        updatedAt: new Date(),
      },
    });

    console.log(
      `✅ PnL updated for ${participant} in match ${matchId}: ${pnl}`,
    );
  }

  // API methods
  async getAllMatches(status?: MatchStatus) {
    const where = status ? { status } : {};

    return await this.db.match.findMany({
      where,
      include: {
        participants: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getMatch(matchId: string) {
    const match = await this.db.match.findUnique({
      where: { matchId },
      include: {
        participants: {
          orderBy: {
            pnl: "desc",
          },
        },
      },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    return match;
  }

  async getMatchParticipants(matchId: string) {
    return await this.db.participant.findMany({
      where: { matchId },
      orderBy: {
        pnl: "desc",
      },
    });
  }

  async getMatchLeaderboard(matchId: string) {
    const participants = await this.db.participant.findMany({
      where: { matchId },
      orderBy: {
        pnl: "desc",
      },
    });

    return participants.map((p, index) => ({
      rank: index + 1,
      address: p.address,
      pnl: p.pnl,
      stakedAmount: p.stakedAmount,
      roi: this.calculateROI(p.pnl, p.stakedAmount),
    }));
  }

  async getUserMatches(address: string) {
    const lowerAddress = address.toLowerCase();

    // Find matches where user is creator
    const createdMatches = await this.db.match.findMany({
      where: { creator: lowerAddress },
      include: {
        participants: true,
      },
    });

    // Find matches where user is participant
    const participatedMatches = await this.db.match.findMany({
      where: {
        participants: {
          some: {
            address: lowerAddress,
          },
        },
      },
      include: {
        participants: true,
      },
    });

    // Combine and deduplicate
    const allMatches = [...createdMatches, ...participatedMatches];
    const uniqueMatches = Array.from(
      new Map(allMatches.map((m) => [m.matchId, m])).values(),
    );

    return uniqueMatches;
  }

  async getActiveMatches() {
    return await this.db.match.findMany({
      where: {
        status: MatchStatus.ACTIVE,
      },
      include: {
        participants: true,
      },
      orderBy: {
        startTime: "desc",
      },
    });
  }

  async updatePnLFromTrade(
    matchId: string,
    participant: string,
    tradePnL: string,
  ) {
    // Get current participant data
    const participantData = await this.db.participant.findFirst({
      where: {
        matchId,
        address: participant.toLowerCase(),
      },
    });

    if (!participantData) {
      throw new Error(
        `Participant ${participant} not found in match ${matchId}`,
      );
    }

    // Calculate new PnL
    const currentPnL = BigInt(participantData.pnl);
    const tradePnLBigInt = BigInt(tradePnL);
    const newPnL = currentPnL + tradePnLBigInt;

    // Update on blockchain (this will trigger the event listener to update DB)
    await this.contractService.updatePnL(matchId, participant, newPnL);

    return {
      matchId,
      participant,
      oldPnL: currentPnL.toString(),
      tradePnL: tradePnLBigInt.toString(),
      newPnL: newPnL.toString(),
    };
  }

  // Helper methods
  private calculateROI(pnl: string, stakedAmount: string): string {
    const pnlBigInt = BigInt(pnl);
    const stakedBigInt = BigInt(stakedAmount);

    if (stakedBigInt === 0n) return "0";

    const roi = (pnlBigInt * 10000n) / stakedBigInt; // 100% = 10000
    return (Number(roi) / 100).toFixed(2);
  }
}
