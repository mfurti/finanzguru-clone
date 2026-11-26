import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  type ClassificationDto,
  classificationDto,
  type InstrumentDto,
  instrumentInput,
  pricesInput,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { ClassificationService } from './classification.service'
import { InstrumentsService } from './instruments.service'

class InstrumentInputDto extends createZodDto(instrumentInput) {}
class PricesInputDto extends createZodDto(pricesInput) {}
class ClassificationInputDto extends createZodDto(classificationDto) {}

@ApiTags('instruments')
@Controller('instruments')
export class InstrumentsController {
  constructor(
    private readonly instruments: InstrumentsService,
    private readonly classification: ClassificationService,
  ) {}

  /** All instruments, for pickers (price import, watchlists, benchmarks). */
  @Get()
  list(): (InstrumentDto & { isBenchmark: boolean })[] {
    return this.instruments.list()
  }

  @Post()
  create(@Body() body: InstrumentInputDto): InstrumentDto {
    return this.instruments.create(body)
  }

  /** Manual daily closes; existing days are overwritten. */
  @Post(':id/prices')
  prices(@Param('id') id: string, @Body() body: PricesInputDto): { stored: number } {
    return this.instruments.addPrices(id, body)
  }

  @Get(':id/classification')
  getClassification(@Param('id') id: string): ClassificationDto {
    return this.classification.get(id)
  }

  @Put(':id/classification')
  setClassification(
    @Param('id') id: string,
    @Body() body: ClassificationInputDto,
  ): ClassificationDto {
    return this.classification.set(id, body)
  }
}
