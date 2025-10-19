import { Controller, Get, Param } from "@nestjs/common";
import { DelegationService } from "./delegation.service";

@Controller("delegations")
export class DelegationController {
  constructor(private delegationService: DelegationService) {}

  @Get(":delegationHash")
  async getDelegation(@Param("delegationHash") delegationHash: string) {
    return await this.delegationService.getDelegation(delegationHash);
  }

  @Get(":delegationHash/valid")
  async isValidDelegation(@Param("delegationHash") delegationHash: string) {
    const delegation =
      await this.delegationService.getDelegation(delegationHash);
    const isValid =
      await this.delegationService.isDelegationValidAndNotExpired(delegation);
    return { delegationHash, isValid };
  }

  @Get("user/:address")
  async getUserDelegations(@Param("address") address: string) {
    return await this.delegationService.getUserDelegations(address);
  }

  @Get("user/:address/stats")
  async getDelegationStats(@Param("address") address: string) {
    return await this.delegationService.getDelegationStats(address);
  }

  @Get("monachad/:address")
  async getActiveDelegationsForMonachad(@Param("address") address: string) {
    return await this.delegationService.getActiveDelegationsForMonachad(
      address
    );
  }

  @Get("monachad/:address/supporters")
  async getMonachadSupporters(@Param("address") address: string) {
    return await this.delegationService.getMonachadSupporters(address);
  }

  @Get("match/:matchId")
  async getDelegationsByMatch(@Param("matchId") matchId: string) {
    return await this.delegationService.getDelegationsByMatch(matchId);
  }
}
