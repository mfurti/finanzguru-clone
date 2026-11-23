import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { OverviewModule } from '../overview/overview.module'
import { AccountsWriteService } from './accounts-write.service'
import { AccountsController } from './accounts.controller'
import { AccountsService } from './accounts.service'

@Module({
  imports: [OverviewModule, ImportModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountsWriteService],
  exports: [AccountsService],
})
export class AccountsModule {}
