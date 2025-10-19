import { MatchManager } from "../../generated/src/Handlers.res.js";
import { notifyBackend } from "./webhook.ts";

/**
 * TradeClub MatchManager Event Handlers
 * These are our protocol's core events for match lifecycle
 */

MatchManager.MatchCreated.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    matchId: event.params.matchId,
    creator: event.params.creator.toLowerCase(),
    entryMargin: event.params.entryMargin,
    duration: event.params.duration,
    maxMonachads: event.params.maxMonachads,
    maxSupportersPerMonachad: event.params.maxSupportersPerMonachad,
    allowedDexes: event.params.allowedDexes.map((addr) => addr.toLowerCase()),
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.MatchCreated.set(entity);

  await notifyBackend("match_created", {
    matchId: event.params.matchId.toString(),
    creator: event.params.creator.toLowerCase(),
    entryMargin: event.params.entryMargin.toString(),
    duration: event.params.duration.toString(),
    maxParticipants: (
      event.params.maxMonachads * event.params.maxSupportersPerMonachad
    ).toString(),
    maxSupportersPerMonachad: event.params.maxSupportersPerMonachad.toString(),
    allowedDexes: event.params.allowedDexes.map((addr) => addr.toLowerCase()),
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

MatchManager.MonachadJoined.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    matchId: event.params.matchId,
    monachad: event.params.monachad.toLowerCase(),
    marginAmount: event.params.marginAmount,
    entryFee: event.params.entryFee,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.MonachadJoined.set(entity);

  await notifyBackend("monachad_joined", {
    matchId: event.params.matchId.toString(),
    monachad: event.params.monachad.toLowerCase(),
    marginAmount: event.params.marginAmount.toString(),
    entryFee: event.params.entryFee.toString(),
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

MatchManager.GaveChadAMatchVault.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    matchId: event.params.matchId,
    monachad: event.params.monachad.toLowerCase(),
    matchVaultAddress: event.params.matchVaultAddress.toLowerCase(),
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.MatchVault.set(entity);
});

MatchManager.MatchVaultBalanceRecorded.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    matchId: event.params.matchId,
    monachad: event.params.monachad.toLowerCase(),
    matchVaultAddress: event.params.matchVault.toLowerCase(),
    preBalance: event.params.preBalance,
    postBalance: event.params.postBalance,
    delta: event.params.delta,
    changeType: Number(event.params.changeType),
    timestamp: BigInt(event.params.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.MatchVaultBalance.set(entity);
});

MatchManager.SupporterJoined.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    matchId: event.params.matchId,
    supporter: event.params.supporter.toLowerCase(),
    monachad: event.params.monachad.toLowerCase(),
    smartAccount: event.params.smartAccount.toLowerCase(),
    entryFee: event.params.entryFee,
    fundedAmount: event.params.fundedAmount,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.SupporterJoined.set(entity);

  await notifyBackend("supporter_joined", {
    matchId: event.params.matchId.toString(),
    supporter: event.params.supporter.toLowerCase(),
    monachad: event.params.monachad.toLowerCase(),
    smartAccount: event.params.smartAccount.toLowerCase(),
    entryFee: event.params.entryFee.toString(),
    fundedAmount: event.params.fundedAmount.toString(),
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

MatchManager.MatchStarted.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    matchId: event.params.matchId,
    startTime: event.params.startTime,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.MatchStarted.set(entity);

  await notifyBackend("match_started", {
    matchId: event.params.matchId.toString(),
    startTime: event.params.startTime.toString(),
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

MatchManager.MatchCompleted.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    matchId: event.params.matchId,
    winner: event.params.winner.toLowerCase(),
    prizeAmount: event.params.prizeAmount,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.MatchCompleted.set(entity);

  await notifyBackend("match_completed", {
    matchId: event.params.matchId.toString(),
    winner: event.params.winner.toLowerCase(),
    prizePool: event.params.prizeAmount.toString(),
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});

MatchManager.PnLUpdated.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    matchId: event.params.matchId,
    participant: event.params.participant.toLowerCase(),
    pnl: event.params.pnl,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.PnLUpdated.set(entity);

  await notifyBackend("pnl_updated", {
    matchId: event.params.matchId.toString(),
    participant: event.params.participant.toLowerCase(),
    pnl: event.params.pnl.toString(),
    blockNumber: event.block.number,
    transactionHash: event.transaction.hash,
  });
});
