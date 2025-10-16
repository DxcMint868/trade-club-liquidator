import { Injectable } from "@nestjs/common";
import { DatabaseService } from "../database/database.service";
import { ContractService } from "../blockchain/contract.service";
import { TradeType } from "@prisma/client";

export interface ExecuteTradeDto {
  matchId: string;
  trader: string;
  target: string;
  value: string;
  data: string;
  tradeType: TradeType;
}

@Injectable()
export class TradingService {
  constructor(
    private db: DatabaseService,
    private contractService: ContractService,
  ) {}

  async recordTrade(dto: any, blockNumber: number, txHash: string) {
    const trade = await this.db.trade.create({
      data: {
        matchId: dto.matchId,
        participantId: dto.participantId,
        delegationId: dto.delegationId || null,
        tradeType: dto.tradeType,
        tokenIn: dto.tokenIn,
        tokenOut: dto.tokenOut,
        amountIn: dto.amountIn,
        amountOut: dto.amountOut,
        targetContract: dto.targetContract,
        blockNumber,
        transactionHash: txHash,
      },
    });

    return trade;
  }

  async getTradesByMatch(matchId: string) {
    return await this.db.trade.findMany({
      where: { matchId },
      orderBy: {
        timestamp: "desc",
      },
    });
  }

  async getTradesByTrader(trader: string) {
    return await this.db.trade.findMany({
      where: {
        participant: {
          address: trader.toLowerCase(),
        },
      },
      include: {
        participant: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });
  }

  async getTradeHistory(matchId: string, trader: string) {
    return await this.db.trade.findMany({
      where: {
        matchId,
        participant: {
          address: trader.toLowerCase(),
        },
      },
      include: {
        participant: true,
      },
      orderBy: {
        timestamp: "desc",
      },
    });
  }

  async getTradingStats(trader: string, matchId?: string) {
    const where: any = {
      participant: {
        address: trader.toLowerCase(),
      },
    };

    if (matchId) {
      where.matchId = matchId;
    }

    const trades = await this.db.trade.findMany({
      where,
      include: {
        participant: true,
      },
    });

    const totalTrades = trades.length;
    let totalVolume = BigInt(0);
    let totalPnL = BigInt(0);

    for (const trade of trades) {
      // Calculate volume from amountIn or amountOut
      totalVolume += BigInt(trade.amountIn);
      // Get PnL from participant
      if (trade.participant) {
        totalPnL += BigInt(trade.participant.pnl);
      }
    }

    return {
      trader,
      matchId: matchId || "all",
      totalTrades,
      totalVolume: totalVolume.toString(),
      totalPnL: totalPnL.toString(),
      avgTradeSize:
        totalTrades > 0 ? (totalVolume / BigInt(totalTrades)).toString() : "0",
    };
  }
}
