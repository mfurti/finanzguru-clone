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
import {
  type CategorizationRuleDto,
  categorizationRuleInput,
  type CategoryNode,
  createCategoryInput,
  ruleDraft,
  type RulePreviewResult,
  updateCategoryInput,
} from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { CategoriesService } from './categories.service'

class CreateCategoryDto extends createZodDto(createCategoryInput) {}
class UpdateCategoryDto extends createZodDto(
  updateCategoryInput.extend({ parentId: z.string().nullable().optional() }),
) {}
class CreateRuleDto extends createZodDto(categorizationRuleInput) {}
class RuleDraftDto extends createZodDto(ruleDraft) {}
class UpdateRuleDto extends createZodDto(
  categorizationRuleInput.partial().extend({ priority: z.number().int().min(1).optional() }),
) {}

@ApiTags('categories')
@Controller()
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get('categories')
  tree(): CategoryNode[] {
    return this.categories.tree()
  }

  @Post('categories')
  create(@Body() body: CreateCategoryDto): CategoryNode {
    return this.categories.create(body)
  }

  @Patch('categories/:id')
  update(@Param('id') id: string, @Body() body: UpdateCategoryDto): CategoryNode {
    return this.categories.update(id, body as never)
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): void {
    this.categories.remove(id)
  }

  @Get('rules')
  rules(): CategorizationRuleDto[] {
    return this.categories.rules()
  }

  @Post('rules')
  createRule(@Body() body: CreateRuleDto): CategorizationRuleDto {
    return this.categories.createRule(body)
  }

  /** Matches and changes a draft rule would cause (006 R6); before `rules/:id`. */
  @Post('rules/preview')
  @HttpCode(HttpStatus.OK)
  preview(@Body() body: RuleDraftDto): RulePreviewResult {
    return this.categories.preview(body)
  }

  /** Must be declared before `rules/:id`. */
  @Post('rules/apply')
  @HttpCode(HttpStatus.OK)
  apply(): { updated: number } {
    return this.categories.applyRules()
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() body: UpdateRuleDto): CategorizationRuleDto {
    return this.categories.updateRule(id, body)
  }

  @Delete('rules/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeRule(@Param('id') id: string): void {
    this.categories.removeRule(id)
  }
}
