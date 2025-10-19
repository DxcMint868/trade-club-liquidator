import { Module } from "@nestjs/common";
import { WebhooksController } from "./webhooks.controller";
import { TradingModule } from "../trading/trading.module";
import { DatabaseModule } from "../database/database.module";
import { MatchesModule } from "../matches/matches.module";

@Module({
  imports: [TradingModule, DatabaseModule, MatchesModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
