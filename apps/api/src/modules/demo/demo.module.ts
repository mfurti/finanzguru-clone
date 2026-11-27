import { Module } from '@nestjs/common'
import { ImportModule } from '../import/import.module'
import { DemoController } from './demo.controller'
import { DemoService } from './demo.service'

@Module({
  imports: [ImportModule],
  controllers: [DemoController],
  providers: [DemoService],
})
export class DemoModule {}
