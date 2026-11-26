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
import { type TagDto, tagInput, updateTagInput } from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { TagsService } from './tags.service'

class TagInputDto extends createZodDto(tagInput) {}
class TagPatchDto extends createZodDto(updateTagInput) {}

@ApiTags('tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(): TagDto[] {
    return this.tags.list()
  }

  @Post()
  create(@Body() body: TagInputDto): TagDto {
    return this.tags.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: TagPatchDto): TagDto {
    return this.tags.update(id, body)
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.tags.remove(id)
  }
}
