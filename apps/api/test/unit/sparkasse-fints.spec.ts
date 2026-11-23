import { describe, expect, it } from 'vitest'
import { NotImplementedError } from '../../src/modules/sources/errors'
import { SparkasseFintsSource } from '../../src/modules/sources/sparkasse-fints/sparkasse-fints.source'
import { SourcesRegistry } from '../../src/modules/sources/sources.registry'

describe('Sparkasse FinTS placeholder (US7)', () => {
  it('is planned and cannot fetch', async () => {
    const source = new SparkasseFintsSource()
    expect(await source.status()).toBe('planned')
    await expect(source.fetch({ kind: 'pull' })).rejects.toBeInstanceOf(NotImplementedError)
  })

  it('is registered next to other sources', () => {
    const registry = new SourcesRegistry([new SparkasseFintsSource()])
    expect(registry.get('sparkasse_fints').kind).toBe('sparkasse_fints')
  })
})
