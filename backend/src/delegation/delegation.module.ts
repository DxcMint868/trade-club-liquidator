import { Module } from "@nestjs/common";
import { DelegationController } from "./delegation.controller";
import { DelegationService } from "./delegation.service";
import { DelegationGateway } from "./delegation.gateway";
import { DatabaseModule } from "../database/database.module";
import { BlockchainModule } from "../blockchain/blockchain.module";

@Module({
  imports: [DatabaseModule, BlockchainModule],
  controllers: [DelegationController],
  providers: [DelegationService, DelegationGateway],
  exports: [DelegationService],
})
export class DelegationModule {}
