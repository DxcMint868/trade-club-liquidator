import { Module } from "@nestjs/common";
import { MatchesController } from "./matches.controller";
import { MatchesService } from "./matches.service";
import { MatchesGateway } from "./matches.gateway";
import { DatabaseModule } from "../database/database.module";
import { BlockchainModule } from "../blockchain/blockchain.module";

@Module({
  imports: [DatabaseModule, BlockchainModule],
  controllers: [MatchesController],
  providers: [MatchesService, MatchesGateway],
  exports: [MatchesService],
})
export class MatchesModule {}
