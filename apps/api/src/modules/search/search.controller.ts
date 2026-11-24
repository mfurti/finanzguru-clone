import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { searchQuery, type SearchResult } from '@finance/shared'
import { createZodDto } from 'nestjs-zod'
import { SearchService } from './search.service'

class SearchQueryDto extends createZodDto(searchQuery) {}

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  /** Header search / Ctrl+K (003 US7). */
  @Get()
  search(@Query() query: SearchQueryDto): SearchResult {
    return this.searchService.search(query.q)
  }
}
