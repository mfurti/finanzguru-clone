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
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  type BreakdownResponse,
  breakdownQuery,
  type CompareResponse,
  compareQuery,
  type GroupingDto,
  groupingInput,
  groupingMembersInput,
  type InflationRates,
  inflationRates,
  type ReturnsResponse,
  returnsQuery,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { AnalysisService } from './analysis.service'
import { GroupingsService } from './groupings.service'

class BreakdownQueryDto extends createZodDto(breakdownQuery) {}
class ReturnsQueryDto extends createZodDto(returnsQuery) {}
class CompareQueryDto extends createZodDto(compareQuery) {}
class GroupingInputDto extends createZodDto(groupingInput) {}
class GroupingMembersDto extends createZodDto(groupingMembersInput) {}
class InflationDto extends createZodDto(z.object({ rates: inflationRates })) {}

@ApiTags('analysis')
@Controller('analysis')
export class AnalysisController {
  constructor(private readonly analysis: AnalysisService) {}

  @Get('breakdown')
  breakdown(@Query() query: BreakdownQueryDto): BreakdownResponse {
    return this.analysis.breakdown(query)
  }

  @Get('returns')
  returns(@Query() query: ReturnsQueryDto): ReturnsResponse {
    return this.analysis.returns(query)
  }

  @Get('compare')
  compare(@Query() query: CompareQueryDto): CompareResponse {
    return this.analysis.compare(query)
  }
}

@ApiTags('analysis')
@Controller('groupings')
export class GroupingsController {
  constructor(private readonly groupings: GroupingsService) {}

  @Get()
  list(): GroupingDto[] {
    return this.groupings.list()
  }

  @Post()
  create(@Body() body: GroupingInputDto): GroupingDto {
    return this.groupings.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: GroupingInputDto): GroupingDto {
    return this.groupings.update(id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.groupings.remove(id)
  }

  @Put(':id/members')
  members(@Param('id') id: string, @Body() body: GroupingMembersDto): GroupingDto {
    return this.groupings.setMembers(id, body)
  }
}

@ApiTags('settings')
@Controller('settings/inflation')
export class InflationController {
  constructor(private readonly groupings: GroupingsService) {}

  @Get()
  list(): InflationRates {
    return this.groupings.inflation()
  }

  /** Replaces the whole list. */
  @Put()
  replace(@Body() body: InflationDto): InflationRates {
    return this.groupings.setInflation(body.rates)
  }
}
