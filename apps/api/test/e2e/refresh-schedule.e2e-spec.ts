import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { RefreshScheduler } from '../../src/modules/refresh/refresh.scheduler'
import { RefreshService } from '../../src/modules/refresh/refresh.service'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

/** 014 T007: the refresh schedule setting plans and stops the automatic refresh. */
describe('automatic refresh schedule (014)', () => {
  let app: NestFastifyApplication
  let cookie: string

  beforeAll(async () => {
    app = await createTestApp()
    cookie = await loginCookie(app)
  })

  afterAll(async () => {
    await app?.close()
  })

  const setSchedule = (mode: string) =>
    app.inject({
      method: 'PATCH',
      url: '/api/settings',
      headers: { cookie },
      payload: { refreshSchedule: { mode, time: '06:00', hours: 6 } },
    })

  it('is off by default, planned when switched on, stopped when switched off', async () => {
    const scheduler = app.get(RefreshScheduler)
    expect(scheduler.scheduled).toBe(false)
    expect((await setSchedule('daily')).statusCode).toBe(200)
    expect(scheduler.scheduled).toBe(true)
    expect((await setSchedule('off')).statusCode).toBe(200)
    expect(scheduler.scheduled).toBe(false)
  })

  it('a run refreshes all sources and plans the next one', async () => {
    const scheduler = app.get(RefreshScheduler)
    const refreshAll = vi.spyOn(app.get(RefreshService), 'refreshAll').mockResolvedValue([])
    await setSchedule('interval')
    await scheduler.tick()
    expect(refreshAll).toHaveBeenCalledTimes(1)
    expect(scheduler.scheduled).toBe(true)
    await setSchedule('off')
  })
})
