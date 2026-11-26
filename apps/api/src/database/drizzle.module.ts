import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { DB } from './database.constants'
import { runMigrations } from './migrate'
import { seedDefaults } from './seed'
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
        const db = drizzle({ client: sqlite })
        // Containers start with an empty or older file: bring it to the current schema
        // and make sure the default categories and sources exist.
        runMigrations(db)
        seedDefaults(db)
        return db
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
