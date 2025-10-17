import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

import { DatabaseModule } from "./database/database.module";
import { BlockchainModule } from "./blockchain/blockchain.module";
import { MatchesModule } from "./matches/matches.module";
import { DelegationModule } from "./delegation/delegation.module";
import { TradingModule } from "./trading/trading.module";
import { GovernanceModule } from "./governance/governance.module";
import { SmartAccountModule } from "./smart-account/smart-account.module";
import { HealthController } from "./health.controller";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // Event system
    EventEmitterModule.forRoot(),

    // Scheduling
    ScheduleModule.forRoot(),

    // Core modules
    DatabaseModule,
    BlockchainModule,
    MatchesModule,
    DelegationModule,
    TradingModule,
    GovernanceModule,
    SmartAccountModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
