import { Inject, Injectable } from '@nestjs/common'
import {
  DEFAULT_OWNER_SETTINGS,
  type OwnerSettings,
  type OwnerSettingsPatch,
  ownerSettings,
} from '@finance/shared'
import { like } from 'drizzle-orm'
import { EventEmitter } from 'node:events'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { userSetting } from '../../database/schema'

const PREFIX = 'settings.'

/**
 * Owner settings (014 R1): one `user_setting` row per changed key (`settings.<name>` → JSON).
 * Missing or unreadable rows fall back to the default, so new settings need no migration.
 */
@Injectable()
export class SettingsService {
  /** Emits `change` with the merged settings after every successful PATCH. */
  readonly events = new EventEmitter()

  constructor(@Inject(DB) private readonly db: AppDatabase) {}

  get(): OwnerSettings {
    const merged: Record<string, unknown> = { ...DEFAULT_OWNER_SETTINGS }
    const rows = this.db
      .select()
      .from(userSetting)
      .where(like(userSetting.key, `${PREFIX}%`))
      .all()
    for (const row of rows) {
      const name = row.key.slice(PREFIX.length)
      if (!(name in DEFAULT_OWNER_SETTINGS) || row.value === null) continue
      try {
        const value: unknown = JSON.parse(row.value)
        const checked = ownerSettings.shape[name as keyof OwnerSettings].safeParse(value)
        if (checked.success) merged[name] = checked.data
      } catch {
        // Unreadable value: keep the default.
      }
    }
    return merged as OwnerSettings
  }

  /** Stores the given keys only; the body is validated by the controller DTO. */
  update(patch: OwnerSettingsPatch): OwnerSettings {
    this.db.transaction((tx) => {
      for (const [name, value] of Object.entries(patch)) {
        if (value === undefined) continue
        const json = JSON.stringify(value)
        tx.insert(userSetting)
          .values({ key: PREFIX + name, value: json })
          .onConflictDoUpdate({ target: userSetting.key, set: { value: json } })
          .run()
      }
    })
    const settings = this.get()
    this.events.emit('change', settings, patch)
    return settings
  }
}
