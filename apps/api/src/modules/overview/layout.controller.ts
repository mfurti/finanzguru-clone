import { Body, Controller, Get, Inject, Put } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { dashboardLayoutInput, type WidgetLayoutItem } from '@finance/shared'
import { asc } from 'drizzle-orm'
import { createZodDto } from 'nestjs-zod'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { dashboardLayout } from '../../database/schema'

class DashboardLayoutDto extends createZodDto(dashboardLayoutInput) {}

/** Order and visibility of the overview widgets ("Anpassen", FR-013). */
@ApiTags('overview')
@Controller('dashboard/layout')
export class LayoutController {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  @Get()
  get(): WidgetLayoutItem[] {
    return this.db.select().from(dashboardLayout).orderBy(asc(dashboardLayout.position)).all()
  }

  @Put()
  put(@Body() body: DashboardLayoutDto): WidgetLayoutItem[] {
    const items = body as unknown as WidgetLayoutItem[]
    this.db.transaction((tx) => {
      for (const item of items) {
        tx.insert(dashboardLayout)
          .values(item)
          .onConflictDoUpdate({
            target: dashboardLayout.widgetKey,
            set: { position: item.position, visible: item.visible },
          })
          .run()
      }
    })
    return this.get()
  }
}
