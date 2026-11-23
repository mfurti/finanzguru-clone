import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  accountsParam,
  type DividendCalendarEntry,
  dividendCalendarQuery,
  type DividendSummary,
  expectedDividendInput,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { DividendsService } from './dividends.service'

class SummaryQueryDto extends createZodDto(
  z.object({
    accounts: accountsParam,
    year: z.coerce.number().int().min(1990).max(2100).optional(),
  }),
) {}
class CalendarQueryDto extends createZodDto(dividendCalendarQuery) {}
class ExpectedInputDto extends createZodDto(expectedDividendInput) {}

@ApiTags('dividends')
@Controller('dividends')
export class DividendsController {
  constructor(private readonly dividends: DividendsService) {}

  @Get('summary')
  summary(@Query() query: SummaryQueryDto): DividendSummary {
    return this.dividends.summary(query)
  }

  @Get('calendar')
  calendar(@Query() query: CalendarQueryDto): DividendCalendarEntry[] {
    return this.dividends.calendar(query)
  }

  @Post('expected')
  create(@Body() body: ExpectedInputDto): { id: string } {
    return this.dividends.create(body)
  }

  @Patch('expected/:id')
  update(@Param('id') id: string, @Body() body: ExpectedInputDto): { id: string } {
    return this.dividends.update(id, body)
  }

  @Delete('expected/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.dividends.remove(id)
  }
}
