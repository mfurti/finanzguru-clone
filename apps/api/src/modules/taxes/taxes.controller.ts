import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import {
  accountsParam,
  exemptionOrderInput,
  type TaxYearDto,
  taxYearInput,
  type VorabpauschaleResponse,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { TaxesService } from './taxes.service'

class TaxYearInputDto extends createZodDto(taxYearInput) {}
class OrderInputDto extends createZodDto(exemptionOrderInput) {}
class OrderAmountDto extends createZodDto(exemptionOrderInput.pick({ amountCents: true })) {}
class AccountsQueryDto extends createZodDto(z.object({ accounts: accountsParam })) {}

const year = new ParseIntPipe({ errorHttpStatusCode: HttpStatus.BAD_REQUEST })

@ApiTags('taxes')
@Controller('taxes')
export class TaxesController {
  constructor(private readonly taxes: TaxesService) {}

  /** `/orders/:id` routes come first so they are not taken for a year. */
  @Patch('orders/:id')
  updateOrder(@Param('id') id: string, @Body() body: OrderAmountDto): TaxYearDto {
    return this.taxes.updateOrder(id, body.amountCents)
  }

  @Delete('orders/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeOrder(@Param('id') id: string): void {
    this.taxes.removeOrder(id)
  }

  @Get(':year')
  get(@Param('year', year) y: number): TaxYearDto {
    return this.taxes.year(y)
  }

  @Put(':year')
  set(@Param('year', year) y: number, @Body() body: TaxYearInputDto): TaxYearDto {
    return this.taxes.setYear(y, body)
  }

  @Post(':year/orders')
  createOrder(@Param('year', year) y: number, @Body() body: OrderInputDto): TaxYearDto {
    return this.taxes.createOrder(y, body)
  }

  @Get(':year/vorabpauschale')
  vorabpauschale(
    @Param('year', year) y: number,
    @Query() query: AccountsQueryDto,
  ): VorabpauschaleResponse {
    return this.taxes.vorabpauschale(y, query.accounts)
  }
}
