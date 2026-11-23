import { describe, expect, it } from 'vitest'
import { SHARED_PACKAGE } from '../src/index'

describe('@finance/shared', () => {
  it('exports its package marker', () => {
    expect(SHARED_PACKAGE).toBe('@finance/shared')
  })
})
