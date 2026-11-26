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
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { type InsuranceDto, insuranceInput } from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { InsuranceService } from './insurance.service'

class InsuranceInputDto extends createZodDto(insuranceInput) {}

@ApiTags('insurance')
@Controller('insurance')
export class InsuranceController {
  constructor(private readonly insurance: InsuranceService) {}

  @Get()
  list(): InsuranceDto[] {
    return this.insurance.list()
  }

  @Post()
  create(@Body() body: InsuranceInputDto): InsuranceDto {
    return this.insurance.create(body)
  }

  /** Full replacement of the editable fields. */
  @Patch(':id')
  update(@Param('id') id: string, @Body() body: InsuranceInputDto): InsuranceDto {
    return this.insurance.update(id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.insurance.remove(id)
  }
}
