import { NotFoundException } from '@nestjs/common'
import { describe, expect, it } from 'vitest'
import { emptyBatch, type DataSource } from '../../src/modules/sources/data-source.interface'
import { ForbiddenToolError, NotImplementedError } from '../../src/modules/sources/errors'
import { SourcesRegistry } from '../../src/modules/sources/sources.registry'

const fake = (kind: DataSource['kind']): DataSource => ({
  kind,
  status: async () => 'active',
  fetch: async () => emptyBatch(),
})

describe('SourcesRegistry', () => {
  it('resolves sources by kind', () => {
    const csv = fake('csv')
    const registry = new SourcesRegistry([csv, fake('sparkasse_fints')])
    expect(registry.get('csv')).toBe(csv)
    expect(registry.kinds().sort()).toEqual(['csv', 'sparkasse_fints'])
    expect(registry.has('scalable_mcp')).toBe(false)
  })

  it('throws 404 for unknown kinds', () => {
    expect(() => new SourcesRegistry([]).get('csv')).toThrow(NotFoundException)
  })

  it('rejects duplicate registrations', () => {
    expect(() => new SourcesRegistry([fake('csv'), fake('csv')])).toThrow(/Duplicate/)
  })
})

describe('source errors', () => {
  it('carry names and messages', () => {
    const error = new ForbiddenToolError('place_order')
    expect(error.name).toBe('ForbiddenToolError')
    expect(error.message).toContain('place_order')
    expect(new NotImplementedError()).toBeInstanceOf(Error)
  })
})
