import { Body, Controller, Get, Patch } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { type OwnerSettings, ownerSettingsPatch } from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { SettingsService } from './settings.service'

class SettingsPatchDto extends createZodDto(ownerSettingsPatch) {}

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Merged owner settings with defaults (014). */
  @Get()
  get(): OwnerSettings {
    return this.settings.get()
  }

  /** Validates and stores a partial update; returns the merged settings. */
  @Patch()
  update(@Body() body: SettingsPatchDto): OwnerSettings {
    return this.settings.update(body)
  }
}
