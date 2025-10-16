import { Module } from "@nestjs/common";
import { GovernanceController } from "./governance.controller";
import { GovernanceService } from "./governance.service";
import { DatabaseModule } from "../database/database.module";
import { BlockchainModule } from "../blockchain/blockchain.module";

@Module({
  imports: [DatabaseModule, BlockchainModule],
  controllers: [GovernanceController],
  providers: [GovernanceService],
  exports: [GovernanceService],
})
export class GovernanceModule {}
