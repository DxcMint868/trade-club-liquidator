import { Controller, Post, Get, Body, Query, HttpCode } from "@nestjs/common";
import {
  SmartAccountService,
  DeploySmartAccountDto,
} from "./smart-account.service";

@Controller("smart-account")
export class SmartAccountController {
  constructor(private smartAccountService: SmartAccountService) {}

  @Post("deploy")
  @HttpCode(200)
  async deploySmartAccount(@Body() dto: DeploySmartAccountDto) {
    return await this.smartAccountService.deploySmartAccount(dto);
  }

  @Get("check-deployment")
  async checkDeployment(@Query("ownerAddress") ownerAddress: string) {
    if (!ownerAddress) {
      return { error: "Owner address parameter required" };
    }
    return await this.smartAccountService.checkDeploymentStatus(ownerAddress);
  }

  @Post("register")
  @HttpCode(200)
  async registerSmartAccount(
    @Body() body: { owner: string; smartAccount: string; chain: number }
  ) {
    // Simple registration endpoint for frontend to notify backend
    return {
      success: true,
      message: "Smart account registered",
      ...body,
    };
  }
}
