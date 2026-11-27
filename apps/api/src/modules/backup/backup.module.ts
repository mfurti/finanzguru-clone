import { Module } from '@nestjs/common'
import { LogosModule } from '../logos/logos.module'
import { BackupController } from './backup.controller'
import { BackupService } from './backup.service'

@Module({
  imports: [LogosModule],
  controllers: [BackupController],
  providers: [BackupService],
  exports: [BackupService],
})
export class BackupModule {}
