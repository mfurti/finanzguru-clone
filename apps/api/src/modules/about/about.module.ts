import { Module } from '@nestjs/common'
import { RefreshModule } from '../refresh/refresh.module'
import { AboutController } from './about.controller'

@Module({
  imports: [RefreshModule],
  controllers: [AboutController],
})
export class AboutModule {}
