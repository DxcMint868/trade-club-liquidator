import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ethers } from "ethers";
import { ContractService } from "./contract.service";
import { Interval } from "@nestjs/schedule";

/**
 * Polling-based event listener for chains that don't support eth_newFilter
 * Uses queryFilter() to fetch events in blocks, more reliable across chains
 */
@Injectable()
export class EventListenerService implements OnModuleInit, OnModuleDestroy {
  private lastProcessedBlock: number = 0;
  private isPolling: boolean = false;
  private readonly POLL_INTERVAL = 5000; // 5 seconds
  private readonly BLOCKS_PER_POLL = 100; // Process 100 blocks at a time

  constructor(
    private contractService: ContractService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService
  ) {}

  async onModuleInit() {
    console.log("Starting blockchain event listeners (polling mode)...");

    // Check if contracts are initialized
    if (!this.contractService.matchManager) {
      console.error(
        "matchManager is undefined - contracts may not be initialized yet"
      );
      console.error("ContractService state:", {
        hasMatchManager: !!this.contractService.matchManager,
        hasGovToken: !!this.contractService.govToken,
        hasBribePool: !!this.contractService.bribePool,
      });
      return; // Skip listener setup if contracts aren't ready
    }

    // Get current block number to start polling from
    try {
      this.lastProcessedBlock =
        await this.contractService.provider.getBlockNumber();
      console.log(
        `Starting event polling from block ${this.lastProcessedBlock}`
      );
      this.isPolling = true;
    } catch (error) {
      console.error("Failed to get current block number:", error);
    }
  }

  onModuleDestroy() {
    this.isPolling = false;
  }

  /**
   * Poll for new events every 5 seconds
   * This runs automatically via @nestjs/schedule
   */
  @Interval(5000)
  async pollEvents() {
    return; // quick switch
    if (!this.isPolling || !this.contractService.matchManager) {
      return;
    }

    try {
      const currentBlock = await this.contractService.provider.getBlockNumber();

      // If no new blocks, skip
      if (currentBlock <= this.lastProcessedBlock) {
        return;
      }

      const fromBlock = this.lastProcessedBlock + 1;
      const toBlock = Math.min(
        currentBlock,
        fromBlock + this.BLOCKS_PER_POLL - 1
      );

      console.log(`Polling events from block ${fromBlock} to ${toBlock}`);

      // Poll all contract events in parallel
      await Promise.all([
        this.pollMatchEvents(fromBlock, toBlock),
        this.pollDelegationEvents(fromBlock, toBlock),
        this.pollGovernanceEvents(fromBlock, toBlock),
      ]);

      this.lastProcessedBlock = toBlock;
    } catch (error) {
      console.error("Error polling events:", error);
    }
  }

  /**
   * Poll MatchManager events using queryFilter
   */
  private async pollMatchEvents(fromBlock: number, toBlock: number) {
    const { matchManager } = this.contractService;

    try {
      // Query all events in parallel
      const [matchCreated, participantJoined, matchStarted, matchCompleted] =
        await Promise.all([
          matchManager.queryFilter(
            matchManager.filters.MatchCreated(),
            fromBlock,
            toBlock
          ),
          matchManager.queryFilter(
            matchManager.filters.ParticipantJoined(),
            fromBlock,
            toBlock
          ),
          matchManager.queryFilter(
            matchManager.filters.MatchStarted(),
            fromBlock,
            toBlock
          ),
          matchManager.queryFilter(
            matchManager.filters.MatchCompleted(),
            fromBlock,
            toBlock
          ),
        ]);

      // Process MatchCreated events
      for (const log of matchCreated) {
        if (!("args" in log)) continue; // Skip plain Logs, only process EventLogs
        const [matchId, creator, entryMargin, duration, maxParticipants] =
          log.args;
        const payload = {
          matchId: matchId?.toString(),
          creator,
          entryMargin: entryMargin?.toString(),
          duration: duration?.toString(),
          maxParticipants: maxParticipants?.toString(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };
        console.log("MatchCreated:", payload);
        this.eventEmitter.emit("match.created", payload);
      }

      // Process ParticipantJoined events
      for (const log of participantJoined) {
        if (!("args" in log)) continue;
        const [matchId, participant, stakedAmount] = log.args;
        const payload = {
          matchId: matchId?.toString(),
          participant,
          stakedAmount: stakedAmount?.toString(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };
        console.log("ParticipantJoined:", payload);
        this.eventEmitter.emit("match.participant-joined", payload);
      }

      // Process MatchStarted events
      for (const log of matchStarted) {
        if (!("args" in log)) continue;
        const [matchId, startTime] = log.args;
        const payload = {
          matchId: matchId?.toString(),
          startTime: startTime?.toString(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };
        console.log("MatchStarted:", payload);
        this.eventEmitter.emit("match.started", payload);
      }

      // Process MatchCompleted events
      for (const log of matchCompleted) {
        if (!("args" in log)) continue;
        const [matchId, winner, totalPrizePool] = log.args;
        const payload = {
          matchId: matchId?.toString(),
          winner,
          totalPrizePool: totalPrizePool?.toString(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };
        console.log("MatchCompleted:", payload);
        this.eventEmitter.emit("match.completed", payload);
      }
    } catch (error) {
      console.error("Error polling match events:", error);
    }
  }

  /**
   * Poll DelegationManager events using queryFilter
   */
  private async pollDelegationEvents(fromBlock: number, toBlock: number) {
    // For now, skip delegation events polling since DelegationManager events
    // are less critical for MVP. Can be added later if needed.
    // The frontend will handle delegation signing, and backend just stores them.
  }

  /**
   * Poll Governance/BribePool events using queryFilter
   */
  private async pollGovernanceEvents(fromBlock: number, toBlock: number) {
    const { bribePool } = this.contractService;

    try {
      // Query all governance events
      const [bribeCreated, votesDelegated] = await Promise.all([
        bribePool.queryFilter(
          bribePool.filters.BribeCreated(),
          fromBlock,
          toBlock
        ),
        bribePool.queryFilter(
          bribePool.filters.VotesDelegated(),
          fromBlock,
          toBlock
        ),
      ]);

      // Process BribeCreated events
      for (const log of bribeCreated) {
        if (!("args" in log)) continue;
        const [bribeId, creator, proposalId, totalReward, deadline] = log.args;
        const payload = {
          bribeId: bribeId?.toString(),
          creator,
          proposalId: proposalId?.toString(),
          totalReward: totalReward?.toString(),
          deadline: deadline?.toString(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };
        console.log("BribeCreated:", payload);
        this.eventEmitter.emit("governance.bribe-created", payload);
      }

      // Process VotesDelegated events
      for (const log of votesDelegated) {
        if (!("args" in log)) continue;
        const [bribeId, delegator, delegatee, votes] = log.args;
        const payload = {
          bribeId: bribeId?.toString(),
          delegator,
          delegatee,
          votes: votes?.toString(),
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
        };
        console.log("VotesDelegated:", payload);
        this.eventEmitter.emit("governance.votes-delegated", payload);
      }
    } catch (error) {
      console.error("Error polling governance events:", error);
    }
  }
}
