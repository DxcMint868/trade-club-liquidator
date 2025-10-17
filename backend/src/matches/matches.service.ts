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
    private contractService: ContractService
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

    console.log(`PnL updated for ${participant} in match ${matchId}: ${pnl}`);
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
      new Map(allMatches.map((m) => [m.matchId, m])).values()
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

  async joinMatch(
    matchId: string,
    userAddress: string,
    smartAccountAddress: string,
    signedDelegation: any
  ) {
    // Validate match exists and is joinable
    const match = await this.db.match.findUnique({
      where: { matchId },
      include: { participants: true },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    if (
      match.status !== MatchStatus.CREATED &&
      match.status !== MatchStatus.ACTIVE
    ) {
      throw new Error(
        `Match ${matchId} is not accepting participants (status: ${match.status})`
      );
    }

    if (match.participants.length >= match.maxParticipants) {
      throw new Error(`Match ${matchId} is full`);
    }

    // Check if user already joined
    const existingParticipant = match.participants.find(
      (p) => p.address.toLowerCase() === userAddress.toLowerCase()
    );

    if (existingParticipant) {
      throw new Error(`User ${userAddress} already joined match ${matchId}`);
    }

    // Store signed delegation for future use
    const delegationData = {
      supporter: userAddress.toLowerCase(),
      monachad: signedDelegation.delegate.toLowerCase(),
      matchId,
      amount: match.entryMargin,
      spendingLimit: match.entryMargin, // For now, spending limit = entry margin
      spent: "0",
      expiresAt: new Date(Date.now() + match.duration * 1000),
      delegationHash: signedDelegation.signature, // Use signature as hash for now
      signedDelegation: JSON.stringify(signedDelegation),
      isActive: true,
      blockNumber: 0, // Will be updated when actually executed on-chain
      transactionHash: "0x0", // Placeholder
    };

    // Create participant and delegation in a transaction
    const result = await this.db.$transaction(async (tx) => {
      const participant = await tx.participant.create({
        data: {
          matchId,
          address: userAddress.toLowerCase(),
          stakedAmount: match.entryMargin,
          pnl: "0",
          joinedTxHash: "0x0", // Will be updated when on-chain tx happens
        },
      });

      
      console.log("Delegation Data:", delegationData);
      const delegation = await tx.delegation.create({
        data: delegationData,
      });

      return { participant, delegation };
    });

    console.log(
      `✅ User ${userAddress} joined match ${matchId} with delegation`
    );

    return {
      success: true,
      participant: result.participant,
      delegation: {
        delegationHash: result.delegation.delegationHash,
        expiresAt: result.delegation.expiresAt,
      },
    };
  }

  async updatePnLFromTrade(
    matchId: string,
    participant: string,
    tradePnL: string
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
        `Participant ${participant} not found in match ${matchId}`
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

  // New methods for Monachad/Supporter flow

  /**
   * Get all Monachads (competing traders) in a match
   */
  async getMatchMonachads(matchId: string) {
    const monachads = await this.db.participant.findMany({
      where: {
        matchId,
        role: "MONACHAD",
      },
      select: {
        address: true,
        stakedAmount: true,
        pnl: true,
        joinedAt: true,
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    return {
      matchId,
      monachads: monachads.map((m) => ({
        ...m,
        roi: this.calculateROI(m.pnl, m.stakedAmount),
      })),
    };
  }

  /**
   * Get all supporters in a match
   */
  async getMatchSupporters(matchId: string) {
    const supporters = await this.db.participant.findMany({
      where: {
        matchId,
        role: "SUPPORTER",
      },
      select: {
        address: true,
        followingAddress: true,
        stakedAmount: true,
        pnl: true,
        joinedAt: true,
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    return {
      matchId,
      supporters,
    };
  }

  /**
   * Get all supporters following a specific Monachad
   */
  async getMonachadSupporters(matchId: string, monachadAddress: string) {
    const supporters = await this.db.participant.findMany({
      where: {
        matchId,
        role: "SUPPORTER",
        followingAddress: monachadAddress.toLowerCase(),
      },
      select: {
        address: true,
        stakedAmount: true,
        pnl: true,
        joinedAt: true,
      },
      orderBy: {
        joinedAt: "asc",
      },
    });

    return {
      matchId,
      monachadAddress,
      supporters,
      totalSupporters: supporters.length,
    };
  }

  /**
   * Join a match as a competing Monachad (trader)
   */
  async joinAsMonachad(
    matchId: string,
    monachadAddress: string,
    smartAccountAddress: string
  ) {
    const match = await this.db.match.findUnique({
      where: { matchId },
      include: { participants: true },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    if (
      match.status !== MatchStatus.CREATED &&
      match.status !== MatchStatus.ACTIVE
    ) {
      throw new Error(
        `Match ${matchId} is not accepting Monachads (status: ${match.status})`
      );
    }

    // Count current Monachads
    const currentMonachads = match.participants.filter(
      (p) => p.role === "MONACHAD"
    ).length;

    if (currentMonachads >= match.maxParticipants) {
      throw new Error(`Match ${matchId} already has max Monachads`);
    }

    // Check if user already joined
    const existingParticipant = match.participants.find(
      (p) => p.address.toLowerCase() === monachadAddress.toLowerCase()
    );

    if (existingParticipant) {
      throw new Error(
        `User ${monachadAddress} already joined match ${matchId}`
      );
    }

    // Create participant as Monachad
    const participant = await this.db.participant.create({
      data: {
        matchId,
        address: monachadAddress.toLowerCase(),
        role: "MONACHAD",
        followingAddress: null,
        stakedAmount: match.entryMargin,
        pnl: "0",
        joinedTxHash: "0x0", // Will be updated when on-chain tx happens
      },
    });

    console.log(
      `✅ User ${monachadAddress} joined match ${matchId} as Monachad`
    );

    return {
      success: true,
      participant,
      role: "MONACHAD",
    };
  }

  /**
   * Follow a Monachad in a match (join as supporter/copy trader)
   */
  async followMonachad(
    matchId: string,
    supporterAddress: string,
    monachadAddress: string,
    smartAccountAddress: string,
    signedDelegation: any,
    stakedAmount?: string
  ) {
    const match = await this.db.match.findUnique({
      where: { matchId },
      include: { participants: true },
    });

    if (!match) {
      throw new Error(`Match ${matchId} not found`);
    }

    if (
      match.status !== MatchStatus.CREATED &&
      match.status !== MatchStatus.ACTIVE
    ) {
      throw new Error(
        `Match ${matchId} is not accepting supporters (status: ${match.status})`
      );
    }

    // Check if Monachad exists in this match
    const monachad = match.participants.find(
      (p) =>
        p.address.toLowerCase() === monachadAddress.toLowerCase() &&
        p.role === "MONACHAD"
    );

    if (!monachad) {
      throw new Error(
        `Monachad ${monachadAddress} not found in match ${matchId}`
      );
    }

    // Check if supporter already joined
    const existingParticipant = match.participants.find(
      (p) => p.address.toLowerCase() === supporterAddress.toLowerCase()
    );

    if (existingParticipant) {
      throw new Error(
        `User ${supporterAddress} already joined match ${matchId}`
      );
    }

    // Count current supporters for this Monachad
    const currentSupporters = match.participants.filter(
      (p) =>
        p.role === "SUPPORTER" &&
        p.followingAddress?.toLowerCase() === monachadAddress.toLowerCase()
    ).length;

    if (match.maxSupporters && currentSupporters >= match.maxSupporters) {
      throw new Error(
        `Monachad ${monachadAddress} already has max supporters`
      );
    }

    // Use provided staked amount or default to 0
    const amountToStake = stakedAmount || "0";

    // Store delegation
    const delegationData = {
      supporter: supporterAddress.toLowerCase(),
      monachad: monachadAddress.toLowerCase(),
      matchId,
      amount: amountToStake,
      spendingLimit: amountToStake,
      spent: "0",
      expiresAt: new Date(Date.now() + match.duration * 1000),
      delegationHash: signedDelegation.signature,
      signedDelegation: JSON.stringify(signedDelegation),
      isActive: true,
      blockNumber: 0,
      transactionHash: "0x0",
    };

    // Create participant and delegation in a transaction
    const result = await this.db.$transaction(async (tx) => {
      const participant = await tx.participant.create({
        data: {
          matchId,
          address: supporterAddress.toLowerCase(),
          role: "SUPPORTER",
          followingAddress: monachadAddress.toLowerCase(),
          stakedAmount: amountToStake,
          pnl: "0",
          joinedTxHash: "0x0",
        },
      });

      console.log("Delegation Data:", delegationData);
      const delegation = await tx.delegation.create({
        data: delegationData,
      });

      return { participant, delegation };
    });

    console.log(
      `✅ User ${supporterAddress} joined match ${matchId} as Supporter, following ${monachadAddress}`
    );

    return {
      success: true,
      participant: result.participant,
      delegation: {
        delegationHash: result.delegation.delegationHash,
        expiresAt: result.delegation.expiresAt,
      },
      role: "SUPPORTER",
      followingMonachad: monachadAddress,
    };
  }
}

