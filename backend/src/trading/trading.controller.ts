import { Controller, Get, Post, Param, Query, Body } from "@nestjs/common";
import { TradingService } from "./trading.service";
import { CopyEngineService } from "./copy-engine.service";

@Controller("trading")
export class TradingController {
  constructor(
    private tradingService: TradingService,
    private copyEngineService: CopyEngineService,
  ) {}

  @Get("match/:matchId/trades")
  async getTradesByMatch(@Param("matchId") matchId: string) {
    return await this.tradingService.getTradesByMatch(matchId);
  }

  @Get("trader/:address/trades")
  async getTradesByTrader(@Param("address") address: string) {
    return await this.tradingService.getTradesByTrader(address);
  }

  @Get("match/:matchId/trader/:address/history")
  async getTradeHistory(
    @Param("matchId") matchId: string,
    @Param("address") address: string,
  ) {
    return await this.tradingService.getTradeHistory(matchId, address);
  }

  @Get("trader/:address/stats")
  async getTradingStats(
    @Param("address") address: string,
    @Query("matchId") matchId?: string,
  ) {
    return await this.tradingService.getTradingStats(address, matchId);
  }

  @Get("monachad/:address/copy-stats")
  async getCopyTradingStats(
    @Param("address") address: string,
    @Query("matchId") matchId?: string,
  ) {
    return await this.copyEngineService.getCopyTradingStats(address, matchId);
  }

  @Get("supporter/:address/performance")
  async getSupporterPerformance(
    @Param("address") address: string,
    @Query("matchId") matchId?: string,
  ) {
    return await this.copyEngineService.getCopyTradeStats(address, matchId);
  }

  @Post("copy-trades/execute")
  async executeCopyTrades(
    @Body()
    body: {
      monachadAddress: string;
      matchId: string;
      originalTrade: {
        target: string;
        value: string;
        data: string;
      };
    },
  ) {
    await this.copyEngineService.executeCopyTrades(body);
    return { success: true, message: "Copy trades executed" };
  }
}
