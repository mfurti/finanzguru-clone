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
  type AccountDetail,
  type AccountDto,
  type AccountsOverview,
  type AccountTree,
  isoDate,
  period,
  createAccountInput,
  updateAccountInput,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { AccountsOverviewService } from './accounts-overview.service'
import { AccountsWriteService } from './accounts-write.service'
import { AccountsService } from './accounts.service'

class AccountsQueryDto extends createZodDto(z.object({ accounts: accountsParam })) {}
class DetailQueryDto extends createZodDto(
  z
    .object({
      period: period.default('1Y'),
      from: isoDate.optional(),
      to: isoDate.optional(),
    })
    .refine((q) => !q.from || !q.to || q.from <= q.to, { path: ['from'] }),
) {}
class CreateAccountDto extends createZodDto(createAccountInput) {}
class UpdateAccountDto extends createZodDto(updateAccountInput) {}
class DeleteQueryDto extends createZodDto(
  z.object({ force: z.enum(['true', 'false']).optional() }),
) {}

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly writer: AccountsWriteService,
    private readonly overviewRows: AccountsOverviewService,
  ) {}

  /** Übersicht › Portfolios & Konten: groups with rich rows (003 US2). */
  @Get('overview')
  overview(@Query() query: AccountsQueryDto): AccountsOverview {
    return this.overviewRows.overviewGroups(query.accounts)
  }

  @Get(':id/detail')
  detail(@Param('id') id: string, @Query() query: DetailQueryDto): AccountDetail {
    return this.overviewRows.detail(id, query)
  }

  /** "Aktualisieren": 202 for sync-capable sources, 409 for CSV accounts. */
  @Post(':id/sync')
  @HttpCode(HttpStatus.ACCEPTED)
  sync(@Param('id') id: string): { runId: string } {
    return this.overviewRows.sync(id)
  }

  @Get()
  list(): AccountDto[] {
    return this.accounts.list()
  }

  @Get('tree')
  tree(@Query() query: AccountsQueryDto): AccountTree {
    return this.accounts.tree(query.accounts)
  }

  @Post()
  create(@Body() body: CreateAccountDto): AccountDto {
    return this.writer.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: UpdateAccountDto): AccountDto {
    return this.writer.update(id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Query() query: DeleteQueryDto): void {
    this.writer.remove(id, query.force === 'true')
  }
}
