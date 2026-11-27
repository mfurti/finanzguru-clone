import { Global, Module } from '@nestjs/common'
import { SettingsController } from './settings.controller'
import { SettingsService } from './settings.service'

/** Global so tax, cash flow, auth and the scheduler can read the owner settings. */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
