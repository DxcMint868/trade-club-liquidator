import { Module, Global } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ContractService } from "./contract.service";
import { EventListenerService } from "./event-listener.service";

@Global()
@Module({
  imports: [ConfigModule],
  providers: [ContractService, EventListenerService],
  exports: [ContractService, EventListenerService],
})
export class BlockchainModule {}
