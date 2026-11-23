import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { accountsParam, type AccountDto, type AccountTree } from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { AccountsService } from './accounts.service'

class AccountsQueryDto extends createZodDto(z.object({ accounts: accountsParam })) {}

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accounts: AccountsService) {}

  @Get()
  list(): AccountDto[] {
    return this.accounts.list()
  }

  @Get('tree')
  tree(@Query() query: AccountsQueryDto): AccountTree {
    return this.accounts.tree(query.accounts)
  }
}
