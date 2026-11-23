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
  type AccountDto,
  type AccountTree,
  createAccountInput,
  updateAccountInput,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { AccountsWriteService } from './accounts-write.service'
import { AccountsService } from './accounts.service'

class AccountsQueryDto extends createZodDto(z.object({ accounts: accountsParam })) {}
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
  ) {}

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
