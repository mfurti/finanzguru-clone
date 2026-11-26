import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { LogosModule } from '../logos/logos.module'
import { OverviewModule } from '../overview/overview.module'
import { SyncModule } from '../sources/sync.module'
import { AccountsOverviewService } from './accounts-overview.service'
import { AccountsWriteService } from './accounts-write.service'
import { AccountsController } from './accounts.controller'
import { AccountsService } from './accounts.service'

@Module({
  imports: [OverviewModule, ImportModule, SyncModule, LogosModule],
  controllers: [AccountsController],
  providers: [AccountsService, AccountsWriteService, AccountsOverviewService],
  exports: [AccountsService],
})
export class AccountsModule {}
