import { Injectable, OnModuleInit } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ContractService } from "./contract.service";

@Injectable()
export class EventListenerService implements OnModuleInit {
  constructor(
    private contractService: ContractService,
    private eventEmitter: EventEmitter2,
  ) {}

  onModuleInit() {
    console.log("👂 Starting blockchain event listeners...");
    this.listenToMatchEvents();
    this.listenToDelegationEvents();
    this.listenToGovernanceEvents();
  }

  private listenToMatchEvents() {
    const { matchManager } = this.contractService;

    // Match created
    matchManager.on(
      "MatchCreated",
      (matchId, creator, entryMargin, duration, maxParticipants, event) => {
        const payload = {
          matchId: matchId.toString(),
          creator,
          entryMargin: entryMargin.toString(),
          duration: duration.toString(),
          maxParticipants: maxParticipants.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("MatchCreated:", payload);
        this.eventEmitter.emit("match.created", payload);
      },
    );

    // Participant joined
    matchManager.on(
      "ParticipantJoined",
      (matchId, participant, stakedAmount, event) => {
        const payload = {
          matchId: matchId.toString(),
          participant,
          stakedAmount: stakedAmount.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("📢 ParticipantJoined:", payload);
        this.eventEmitter.emit("match.participant-joined", payload);
      },
    );

    // Match started
    matchManager.on("MatchStarted", (matchId, startTime, event) => {
      const payload = {
        matchId: matchId.toString(),
        startTime: startTime.toString(),
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
      };
      console.log("📢 MatchStarted:", payload);
      this.eventEmitter.emit("match.started", payload);
    });

    // Match completed
    matchManager.on("MatchCompleted", (matchId, winner, prizePool, event) => {
      const payload = {
        matchId: matchId.toString(),
        winner,
        prizePool: prizePool.toString(),
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
      };
      console.log("📢 MatchCompleted:", payload);
      this.eventEmitter.emit("match.completed", payload);
    });

    // PnL updated
    matchManager.on("PnLUpdated", (matchId, participant, pnl, event) => {
      const payload = {
        matchId: matchId.toString(),
        participant,
        pnl: pnl.toString(),
        blockNumber: event.log.blockNumber,
        transactionHash: event.log.transactionHash,
      };
      console.log("📢 PnLUpdated:", payload);
      this.eventEmitter.emit("match.pnl-updated", payload);
    });

    console.log("✅ Match event listeners active");
  }

  private listenToDelegationEvents() {
    const { delegationRegistry } = this.contractService;

    // Delegation created
    delegationRegistry.on(
      "DelegationCreated",
      (
        delegationHash,
        supporter,
        monachad,
        matchId,
        amount,
        expiresAt,
        event,
      ) => {
        const payload = {
          delegationHash,
          supporter,
          monachad,
          matchId: matchId.toString(),
          amount: amount.toString(),
          expiresAt: expiresAt.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("DelegationCreated:", payload);
        this.eventEmitter.emit("delegation.created", payload);
      },
    );

    // Delegation revoked
    delegationRegistry.on(
      "DelegationRevoked",
      (delegationHash, supporter, timestamp, event) => {
        const payload = {
          delegationHash,
          supporter,
          timestamp: timestamp.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("DelegationRevoked:", payload);
        this.eventEmitter.emit("delegation.revoked", payload);
      },
    );

    // Delegation executed
    delegationRegistry.on(
      "DelegationExecuted",
      (delegationHash, executor, target, value, data, event) => {
        const payload = {
          delegationHash,
          executor,
          target,
          value: value.toString(),
          data,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("DelegationExecuted:", payload);
        this.eventEmitter.emit("delegation.executed", payload);
      },
    );

    console.log("✅ Delegation event listeners active");
  }

  private listenToGovernanceEvents() {
    const { bribePool } = this.contractService;

    // Bribe created
    bribePool.on(
      "BribeCreated",
      (bribeId, creator, proposalId, totalReward, deadline, event) => {
        const payload = {
          bribeId: bribeId.toString(),
          creator,
          proposalId: proposalId.toString(),
          totalReward: totalReward.toString(),
          deadline: deadline.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("BribeCreated:", payload);
        this.eventEmitter.emit("governance.bribe-created", payload);
      },
    );

    // Votes delegated
    bribePool.on(
      "VotesDelegated",
      (bribeId, delegator, delegatee, votes, event) => {
        const payload = {
          bribeId: bribeId.toString(),
          delegator,
          delegatee,
          votes: votes.toString(),
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("VotesDelegated:", payload);
        this.eventEmitter.emit("governance.votes-delegated", payload);
      },
    );

    console.log("✅ Governance event listeners active");
  }
}
