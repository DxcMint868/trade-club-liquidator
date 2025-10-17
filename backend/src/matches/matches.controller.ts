import { Controller, Get, Post, Param, Query, Body } from "@nestjs/common";
import { MatchesService } from "./matches.service";
import { MatchStatus } from "@prisma/client";

@Controller("matches")
export class MatchesController {
  constructor(private matchesService: MatchesService) {}

  @Get()
  async getAllMatches(@Query("status") status?: MatchStatus) {
    return await this.matchesService.getAllMatches(status);
  }

  @Get("active")
  async getActiveMatches() {
    return await this.matchesService.getActiveMatches();
  }

  @Get("user/:address")
  async getUserMatches(@Param("address") address: string) {
    return await this.matchesService.getUserMatches(address);
  }

  @Get(":matchId")
  async getMatch(@Param("matchId") matchId: string) {
    return await this.matchesService.getMatch(matchId);
  }

  @Get(":matchId/participants")
  async getMatchParticipants(@Param("matchId") matchId: string) {
    return await this.matchesService.getMatchParticipants(matchId);
  }

  @Get(":matchId/leaderboard")
  async getMatchLeaderboard(@Param("matchId") matchId: string) {
    return await this.matchesService.getMatchLeaderboard(matchId);
  }

  @Post("join")
  async joinMatch(
    @Body()
    body: {
      matchId: string;
      address: string;
      smartAccountAddress: string;
      signedDelegation: any;
    },
  ) {
    return await this.matchesService.joinMatch(
      body.matchId,
      body.address,
      body.smartAccountAddress,
      body.signedDelegation,
    );
  }

  @Post(":matchId/update-pnl")
  async updatePnL(
    @Param("matchId") matchId: string,
    @Body() body: { participant: string; tradePnL: string },
  ) {
    return await this.matchesService.updatePnLFromTrade(
      matchId,
      body.participant,
      body.tradePnL,
    );
  }
}
