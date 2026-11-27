import { Controller, Get, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { type DataState, type RefreshResult, RefreshService } from './refresh.service'

@ApiTags('sources')
@Controller('sources')
export class RefreshController {
  constructor(private readonly refresh: RefreshService) {}

  /** Fetches every connected source one after another (013 US2). */
  @Post('refresh-all')
  refreshAll(): Promise<RefreshResult[]> {
    return this.refresh.refreshAll()
  }

  /** Data state: oldest last success of the connected sources, per-source times. */
  @Get('state')
  state(): DataState {
    return this.refresh.state()
  }
}
