import { Module } from '@nestjs/common';
import { SmartAccountController } from './smart-account.controller';
import { SmartAccountService } from './smart-account.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SmartAccountController],
  providers: [SmartAccountService],
  exports: [SmartAccountService],
})
export class SmartAccountModule {}
