import { Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { GovernanceStatus } from "@prisma/client";

@Injectable()
export class GovernanceService {
  constructor(
    private db: DatabaseService,
    private contractService: ContractService,
  ) {}

  @OnEvent("governance.bribe-created")
  async handleBribeCreated(payload: any) {
    const {
      bribeId,
      creator,
      proposalId,
      totalReward,
      deadline,
      transactionHash,
    } = payload;

    // Create bribe record
    await this.db.bribe.create({
      data: {
        bribeId,
        proposalId,
        creator: creator.toLowerCase(),
        totalReward,
        deadline: new Date(parseInt(deadline) * 1000),
        createdTxHash: transactionHash,
      },
    });

    console.log(`✅ Bribe ${bribeId} created for proposal ${proposalId}`);
  }

  @OnEvent("governance.votes-delegated")
  async handleVotesDelegated(payload: any) {
    const { bribeId, delegator, delegatee, votes, transactionHash } = payload;

    // Record vote
    await this.db.vote.create({
      data: {
        bribeId,
        voter: delegator.toLowerCase(),
        delegatee: delegatee.toLowerCase(),
        voteWeight: votes,
        txHash: transactionHash,
      },
    });

    console.log(
      `✅ ${votes} votes delegated from ${delegator} to ${delegatee} for bribe ${bribeId}`,
    );
  }

  // API methods
  async getAllProposals(status?: GovernanceStatus) {
    const where = status ? { status } : {};

    return await this.db.governance.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getProposal(proposalId: string) {
    const proposal = await this.db.governance.findUnique({
      where: { proposalId },
      include: {
        bribes: {
          include: {
            votes: true,
          },
        },
      },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    return proposal;
  }

  async getBribesByProposal(proposalId: string) {
    return await this.db.bribe.findMany({
      where: { proposalId },
      include: {
        votes: true,
      },
      orderBy: {
        totalReward: "desc",
      },
    });
  }

  async getBribe(bribeId: string) {
    const bribe = await this.db.bribe.findUnique({
      where: { bribeId },
      include: {
        votes: true,
      },
    });

    if (!bribe) {
      throw new Error(`Bribe ${bribeId} not found`);
    }

    return bribe;
  }

  async getVotesByBribe(bribeId: string) {
    return await this.db.vote.findMany({
      where: { bribeId },
      orderBy: {
        voteWeight: "desc",
      },
    });
  }

  async getUserVotes(address: string) {
    const lowerAddress = address.toLowerCase();

    return await this.db.vote.findMany({
      where: {
        OR: [{ voter: lowerAddress }, { delegatee: lowerAddress }],
      },
      orderBy: {
        timestamp: "desc",
      },
    });
  }

  async getBribeLeaderboard(bribeId: string) {
    const votes = await this.db.vote.findMany({
      where: { bribeId },
      orderBy: {
        voteWeight: "desc",
      },
    });

    // Aggregate votes by delegatee
    const votesByDelegatee = new Map<string, bigint>();

    for (const vote of votes) {
      const current = votesByDelegatee.get(vote.delegatee) || BigInt(0);
      votesByDelegatee.set(vote.delegatee, current + BigInt(vote.voteWeight));
    }

    // Convert to leaderboard
    const leaderboard = Array.from(votesByDelegatee.entries())
      .map(([delegatee, totalVotes]) => ({
        delegatee,
        totalVotes: totalVotes.toString(),
      }))
      .sort((a, b) => {
        const aBig = BigInt(a.totalVotes);
        const bBig = BigInt(b.totalVotes);
        return aBig > bBig ? -1 : aBig < bBig ? 1 : 0;
      });

    return leaderboard;
  }

  async getBribeStats(bribeId: string) {
    const bribe = await this.db.bribe.findUnique({
      where: { bribeId },
      include: {
        votes: true,
      },
    });

    if (!bribe) {
      throw new Error(`Bribe ${bribeId} not found`);
    }

    let totalVotes = BigInt(0);
    const uniqueVoters = new Set<string>();
    const uniqueDelegatees = new Set<string>();

    for (const vote of bribe.votes) {
      totalVotes += BigInt(vote.voteWeight);
      uniqueVoters.add(vote.voter);
      uniqueDelegatees.add(vote.delegatee);
    }

    return {
      bribeId,
      proposalId: bribe.proposalId,
      totalReward: bribe.totalReward,
      totalVotes: totalVotes.toString(),
      totalVoters: uniqueVoters.size,
      totalDelegatees: uniqueDelegatees.size,
      deadline: bribe.deadline,
      isActive: new Date() < bribe.deadline,
    };
  }

  async getActiveProposals() {
    return await this.db.governance.findMany({
      where: {
        status: GovernanceStatus.ACTIVE,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async getUserGovernanceActivity(address: string) {
    const lowerAddress = address.toLowerCase();

    const votes = await this.db.vote.count({
      where: { voter: lowerAddress },
    });

    const bribesCreated = await this.db.bribe.count({
      where: { creator: lowerAddress },
    });

    // Fetch votes and sum manually (voteWeight is String type)
    const voterVotes = await this.db.vote.findMany({
      where: { voter: lowerAddress },
      select: {
        voteWeight: true,
      },
    });

    const delegateeVotes = await this.db.vote.findMany({
      where: { delegatee: lowerAddress },
      select: {
        voteWeight: true,
      },
    });

    // Sum vote weights manually using BigInt
    const totalVoteWeight = voterVotes.reduce(
      (sum, v) => sum + BigInt(v.voteWeight),
      BigInt(0),
    );

    const receivedVoteWeight = delegateeVotes.reduce(
      (sum, v) => sum + BigInt(v.voteWeight),
      BigInt(0),
    );

    return {
      address,
      totalVotes: votes,
      bribesCreated,
      totalVoteWeight: totalVoteWeight.toString(),
      receivedVoteWeight: receivedVoteWeight.toString(),
    };
  }
}
