import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { DB } from './database.constants'
import { openDatabase } from './open-database'

export type AppDatabase = BetterSQLite3Database & { $client: Database.Database }

@Global()
@Module({
  providers: [
    {
      provide: DB,
      inject: [ConfigService],
      useFactory: (config: ConfigService): AppDatabase => {
        const sqlite = openDatabase(config.getOrThrow<string>('DATABASE_PATH'))
        return drizzle({ client: sqlite })
      },
    },
  ],
  exports: [DB],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  onApplicationShutdown(): void {
    this.db.$client.close()
  }
}
