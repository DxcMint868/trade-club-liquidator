import { Module } from "@nestjs/common";
import { TradingController } from "./trading.controller";
import { TradingService } from "./trading.service";
import { CopyEngineService } from "./copy-engine.service";
import { DatabaseModule } from "../database/database.module";
import { BlockchainModule } from "../blockchain/blockchain.module";
import { DelegationModule } from "../delegation/delegation.module";

@Module({
  imports: [DatabaseModule, BlockchainModule, DelegationModule],
  controllers: [TradingController],
  providers: [TradingService, CopyEngineService],
  exports: [TradingService, CopyEngineService],
})
export class TradingModule {}
