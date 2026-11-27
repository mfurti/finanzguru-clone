import { describe, expect, it } from 'vitest'
import { startPageRedirect } from '~/composables/useStartPage'

describe('start page (014 T008)', () => {
  it('sends only the Übersicht to the chosen start page', () => {
    expect(startPageRedirect('/', 'budget')).toBe('/budget')
    expect(startPageRedirect('/', 'transactions')).toBe('/transactions')
    expect(startPageRedirect('/', 'dashboard')).toBeNull()
    expect(startPageRedirect('/investments', 'budget')).toBeNull()
  })
})
