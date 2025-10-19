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

  @Get(":matchId/participant/:address")
  async getMatchParticipant(
    @Param("matchId") matchId: string,
    @Param("address") address: string
  ) {
    return await this.matchesService.getMatchParticipant(matchId, address);
  }

  @Get(":matchId")
  async getMatch(@Param("matchId") matchId: string) {
    return await this.matchesService.getMatch(matchId);
  }

  @Get(":matchId/participants")
  async getMatchParticipants(@Param("matchId") matchId: string) {
    return await this.matchesService.getMatchParticipants(matchId);
  }

  @Get(":matchId/monachads")
  async getMatchMonachads(@Param("matchId") matchId: string) {
    return await this.matchesService.getMatchMonachads(matchId);
  }

  @Get(":matchId/supporters")
  async getMatchSupporters(@Param("matchId") matchId: string) {
    return await this.matchesService.getMatchSupporters(matchId);
  }

  @Get(":matchId/monachads/:monachadAddress/supporters")
  async getMonachadSupporters(
    @Param("matchId") matchId: string,
    @Param("monachadAddress") monachadAddress: string
  ) {
    return await this.matchesService.getMonachadSupporters(
      matchId,
      monachadAddress
    );
  }

  @Get(":matchId/leaderboard")
  async getMatchLeaderboard(@Param("matchId") matchId: string) {
    return await this.matchesService.getMatchLeaderboard(matchId);
  }

  @Post(":matchId/join-as-monachad")
  async joinAsMonachad(
    @Param("matchId") matchId: string,
    @Body()
    body: {
      address: string;
      smartAccountAddress: string;
    }
  ) {
    return await this.matchesService.joinAsMonachad(
      matchId,
      body.address,
      body.smartAccountAddress
    );
  }

  @Post(":matchId/delegate")
  async followMonachad(
    @Param("matchId") matchId: string,
    @Body()
    body: {
      supporterAddress: string;
      monachadAddress: string;
      smartAccountAddress: string;
      signedDelegation: any;
      entryFee?: string;
      fundedAmount?: string;
      stakedAmount?: string;
    }
  ) {
    return await this.matchesService.delegate(
      matchId,
      body.supporterAddress,
      body.monachadAddress,
      body.smartAccountAddress,
      body.signedDelegation,
      body.entryFee,
      body.fundedAmount,
      body.stakedAmount
    );
  }

  /**
   * @deprecated Use join-as-monachad or follow-monachad instead
   */
  @Post("join")
  async joinMatch(
    @Body()
    body: {
      matchId: string;
      address: string;
      smartAccountAddress: string;
      signedDelegation: any;
    }
  ) {
    return await this.matchesService.joinMatch(
      body.matchId,
      body.address,
      body.smartAccountAddress,
      body.signedDelegation
    );
  }

  @Post(":matchId/update-pnl")
  async updatePnL(
    @Param("matchId") matchId: string,
    @Body() body: { participant: string; tradePnL: string }
  ) {
    return await this.matchesService.updatePnLFromTrade(
      matchId,
      body.participant,
      body.tradePnL
    );
  }
}
