import { Body, Controller, Param, Post } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { type InstrumentDto, instrumentInput, pricesInput } from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { InstrumentsService } from './instruments.service'

class InstrumentInputDto extends createZodDto(instrumentInput) {}
class PricesInputDto extends createZodDto(pricesInput) {}

@ApiTags('instruments')
@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly instruments: InstrumentsService) {}

  @Post()
  create(@Body() body: InstrumentInputDto): InstrumentDto {
    return this.instruments.create(body)
  }

  /** Manual daily closes; existing days are overwritten. */
  @Post(':id/prices')
  prices(@Param('id') id: string, @Body() body: PricesInputDto): { stored: number } {
    return this.instruments.addPrices(id, body)
  }
}
