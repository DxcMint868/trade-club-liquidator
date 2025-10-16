import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { ethers } from "ethers";
import { ContractService } from "./contract.service";

@Injectable()
export class EventListenerService implements OnModuleInit {
  constructor(
    private contractService: ContractService,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
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
    // Listen to DelegationManager for new DeleGator deployments
    const delegationManagerAddress = this.configService.get<string>(
      "DELEGATION_MANAGER_ADDRESS",
      "0xdb9B1e94B5b69Df7e401DDbedE43491141047dB3",
    );

    const delegationManagerABI = [
      "event NewDeleGator(address indexed delegator, address indexed delegatorAddress)",
      "event DelegationCreated(address indexed delegator, bytes32 indexed delegationHash, address indexed delegate)",
      "event DelegationDisabled(address indexed delegator, bytes32 indexed delegationHash)",
    ];

    const delegationManager = new ethers.Contract(
      delegationManagerAddress,
      delegationManagerABI,
      this.contractService.provider,
    );

    // Listen for new DeleGator deployments
    delegationManager.on(
      "NewDeleGator",
      (delegator, delegatorAddress, event) => {
        const payload = {
          delegator,
          delegatorAddress,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("📢 NewDeleGator deployed:", payload);
        this.eventEmitter.emit("delegation.delegator-created", payload);
      },
    );

    // Listen for delegation creations
    delegationManager.on(
      "DelegationCreated",
      (delegator, delegationHash, delegate, event) => {
        const payload = {
          delegator,
          delegationHash,
          delegate,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("📢 DelegationCreated:", payload);
        this.eventEmitter.emit("delegation.created", payload);
      },
    );

    // Listen for delegation disabling
    delegationManager.on(
      "DelegationDisabled",
      (delegator, delegationHash, event) => {
        const payload = {
          delegator,
          delegationHash,
          blockNumber: event.log.blockNumber,
          transactionHash: event.log.transactionHash,
        };
        console.log("📢 DelegationDisabled:", payload);
        this.eventEmitter.emit("delegation.revoked", payload);
      },
    );

    console.log("✅ MetaMask delegation event listeners active");
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
