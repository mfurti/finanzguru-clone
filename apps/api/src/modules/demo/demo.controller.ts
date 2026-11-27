import { Controller, Delete, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { type DemoRemoval, DemoService } from './demo.service'

@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  /** Whether demo data is present (the removal button is shown only then). */
  @Get()
  state(): { present: boolean } {
    return { present: this.demo.exists() }
  }

  /** Removes all demo data in one step (013 US1). */
  @Delete()
  remove(): DemoRemoval {
    return this.demo.remove()
  }
}
