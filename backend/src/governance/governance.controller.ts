import { Controller, Get, Param, Query } from "@nestjs/common";
import { GovernanceService } from "./governance.service";
import { GovernanceStatus } from "@prisma/client";

@Controller("governance")
export class GovernanceController {
  constructor(private governanceService: GovernanceService) {}

  @Get("proposals")
  async getAllProposals(@Query("status") status?: GovernanceStatus) {
    return await this.governanceService.getAllProposals(status);
  }

  @Get("proposals/active")
  async getActiveProposals() {
    return await this.governanceService.getActiveProposals();
  }

  @Get("proposals/:proposalId")
  async getProposal(@Param("proposalId") proposalId: string) {
    return await this.governanceService.getProposal(proposalId);
  }

  @Get("proposals/:proposalId/bribes")
  async getBribesByProposal(@Param("proposalId") proposalId: string) {
    return await this.governanceService.getBribesByProposal(proposalId);
  }

  @Get("bribes/:bribeId")
  async getBribe(@Param("bribeId") bribeId: string) {
    return await this.governanceService.getBribe(bribeId);
  }

  @Get("bribes/:bribeId/votes")
  async getVotesByBribe(@Param("bribeId") bribeId: string) {
    return await this.governanceService.getVotesByBribe(bribeId);
  }

  @Get("bribes/:bribeId/leaderboard")
  async getBribeLeaderboard(@Param("bribeId") bribeId: string) {
    return await this.governanceService.getBribeLeaderboard(bribeId);
  }

  @Get("bribes/:bribeId/stats")
  async getBribeStats(@Param("bribeId") bribeId: string) {
    return await this.governanceService.getBribeStats(bribeId);
  }

  @Get("user/:address/votes")
  async getUserVotes(@Param("address") address: string) {
    return await this.governanceService.getUserVotes(address);
  }

  @Get("user/:address/activity")
  async getUserGovernanceActivity(@Param("address") address: string) {
    return await this.governanceService.getUserGovernanceActivity(address);
  }
}
