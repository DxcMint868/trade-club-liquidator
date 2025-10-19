import { FUNDex } from "../../generated/src/Handlers.res.js";
import { notifyBackend, getMonachadIfTraderIsVault } from "./webhook.ts";
import { encodeFunctionData } from "viem";

/**
 * FUNDex DEX Event Handlers
 * Only notifies backend for trades by Monachads (for copy-trading)
 * Sends pre-encoded calldata so backend is DEX-agnostic
 */

// FUNDex ABI for encoding function calls
const fundexAbi = [
  {
    inputs: [
      { name: "assetId", type: "uint256" },
      { name: "positionType", type: "uint8" },
      { name: "leverage", type: "uint256" },
    ],
    name: "openPosition",
    outputs: [{ name: "positionId", type: "uint256" }],
    stateMutability: "payable",
    type: "function",
  },
  {
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "assetId", type: "uint256" },
    ],
    name: "closePosition",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const BPS_DENOMINATOR = 10_000n;

async function getLatestVaultSnapshot(
  context: any,
  matchVaultAddress: string,
  blockNumber: bigint
) {
  const records = await context.MatchVaultBalance.getWhere.matchVaultAddress.eq(
    matchVaultAddress
  );

  if (!Array.isArray(records) || records.length === 0) {
    return null;
  }

  let latest: any = null;
  for (const record of records) {
    const recordBlock = BigInt(record.blockNumber);
    if (recordBlock > blockNumber) {
      continue;
    }

    if (
      !latest ||
      recordBlock > BigInt(latest.blockNumber) ||
      (recordBlock === BigInt(latest.blockNumber) &&
        BigInt(record.timestamp) > BigInt(latest.timestamp))
    ) {
      latest = record;
    }
  }

  return latest;
}

async function calculateSizeToPortfolioBps(
  context: any,
  matchVaultAddress: string,
  blockNumber: bigint,
  tradeValue: bigint
): Promise<bigint | null> {
  const snapshot = await getLatestVaultSnapshot(
    context,
    matchVaultAddress,
    blockNumber
  );

  if (!snapshot) {
    return null;
  }

  const preBalance = BigInt(snapshot.postBalance);
  if (preBalance == 0n) {
    return null;
  }

  let ratio = (tradeValue * BPS_DENOMINATOR) / preBalance;

  if (ratio > BPS_DENOMINATOR) {
    ratio = BPS_DENOMINATOR;
  }

  return ratio;
}

FUNDex.PositionOpened.handler(async ({ event, context }) => {
  console.log("FUNDex PositionOpened event:", event);

  const blockNumber = BigInt(event.block.number);
  const traderAddress = event.params.trader.toLowerCase();
  const vaultContext = await getMonachadIfTraderIsVault(context, traderAddress);

  let sizeToPortfolioBps: bigint | null = null;

  if (vaultContext) {
    sizeToPortfolioBps = await calculateSizeToPortfolioBps(
      context,
      vaultContext.matchVaultAddress,
      blockNumber,
      event.params.collateral
    );
  }

  const entity: any = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    positionId: event.params.positionId,
    trader: traderAddress,
    assetId: event.params.assetId,
    positionType: Number(event.params.positionType),
    collateral: event.params.collateral,
    size: event.params.size,
    leverage: event.params.leverage,
    entryPrice: event.params.entryPrice,
    timestamp: event.params.timestamp,
    blockNumber,
    transactionHash: event.transaction.hash,
  };

  if (sizeToPortfolioBps !== null) {
    entity.sizeToPortfolioBps = sizeToPortfolioBps;
  }

  // Always index the event for data completeness
  context.PositionOpened.set(entity);

  if (vaultContext) {
    console.log("Is trader a Monachad?", true);

    const openPositionData = encodeFunctionData({
      abi: fundexAbi,
      functionName: "openPosition",
      args: [
        event.params.assetId,
        event.params.positionType,
        event.params.leverage,
      ],
    });

    await notifyBackend("trade_opened", {
      monachadAddress: vaultContext.monachad,
      trade: {
        target: event.srcAddress,
        value: event.params.collateral.toString(),
        data: openPositionData,
      },
      metadata: {
        dex: "FUNDex",
        positionId: event.params.positionId.toString(),
        assetId: event.params.assetId.toString(),
        positionType: event.params.positionType,
        leverage: event.params.leverage.toString(),
        transactionHash: event.transaction.hash,
        matchId: vaultContext.matchId,
        sizeToPortfolioBps: sizeToPortfolioBps?.toString(),
      },
    });
  } else {
    console.log("Is trader a Monachad?", false);
  }
});

FUNDex.PositionClosed.handler(async ({ event, context }) => {
  const blockNumber = BigInt(event.block.number);
  const traderAddress = event.params.trader.toLowerCase();
  const vaultContext = await getMonachadIfTraderIsVault(context, traderAddress);

  let sizeToPortfolioBps: bigint | null = null;

  if (vaultContext) {
    const openPositions = await context.PositionOpened.getWhere.positionId.eq(
      event.params.positionId
    );

    if (Array.isArray(openPositions) && openPositions.length > 0) {
      let latestOpen: any = null;

      for (const record of openPositions) {
        const recordBlock = BigInt(record.blockNumber);
        if (recordBlock > blockNumber) {
          continue;
        }

        if (!latestOpen) {
          latestOpen = record;
          continue;
        }

        const latestBlock = BigInt(latestOpen.blockNumber);
        if (
          recordBlock > latestBlock ||
          (recordBlock === latestBlock &&
            BigInt(record.timestamp) > BigInt(latestOpen.timestamp))
        ) {
          latestOpen = record;
        }
      }

      if (
        latestOpen &&
        latestOpen.sizeToPortfolioBps !== undefined &&
        latestOpen.sizeToPortfolioBps !== null
      ) {
        sizeToPortfolioBps = BigInt(latestOpen.sizeToPortfolioBps);
      }
    }
  }

  const entity: any = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    positionId: event.params.positionId,
    trader: traderAddress,
    assetId: event.params.assetId,
    exitPrice: event.params.exitPrice,
    pnl: event.params.pnl,
    timestamp: event.params.timestamp,
    blockNumber,
    transactionHash: event.transaction.hash,
  };

  if (sizeToPortfolioBps !== null) {
    entity.sizeToPortfolioBps = sizeToPortfolioBps;
  }

  context.PositionClosed.set(entity);

  if (vaultContext) {
    console.log("Is trader a Monachad?", true);

    const closePositionData = encodeFunctionData({
      abi: fundexAbi,
      functionName: "closePosition",
      args: [event.params.positionId, event.params.assetId],
    });

    await notifyBackend("trade_closed", {
      monachadAddress: vaultContext.monachad,
      trade: {
        target: event.srcAddress,
        value: "0",
        data: closePositionData,
      },
      metadata: {
        dex: "FUNDex",
        monachadPositionId: event.params.positionId.toString(),
        assetId: event.params.assetId.toString(),
        exitPrice: event.params.exitPrice.toString(),
        pnl: event.params.pnl.toString(),
        transactionHash: event.transaction.hash,
        matchId: vaultContext.matchId,
        sizeToPortfolioBps: sizeToPortfolioBps?.toString(),
      },
    });
  } else {
    console.log("Is trader a Monachad?", false);
  }
});

FUNDex.PriceUpdated.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    assetId: event.params.assetId,
    symbol: event.params.symbol,
    oldPrice: event.params.oldPrice,
    newPrice: event.params.newPrice,
    timestamp: event.params.timestamp,
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.PriceUpdated.set(entity);
});

FUNDex.Deposited.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user.toLowerCase(),
    amount: event.params.amount,
    newBalance: event.params.newBalance,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.Deposited.set(entity);
});

FUNDex.Withdrawn.handler(async ({ event, context }) => {
  const entity = {
    id: `${event.chainId}_${event.block.number}_${event.logIndex}`,
    user: event.params.user.toLowerCase(),
    amount: event.params.amount,
    newBalance: event.params.newBalance,
    timestamp: BigInt(event.block.timestamp),
    blockNumber: BigInt(event.block.number),
    transactionHash: event.transaction.hash,
  };

  context.Withdrawn.set(entity);
});
