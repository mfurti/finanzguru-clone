import { describe, expect, it } from 'vitest'
import { shouldSuggest, SUGGESTION_THRESHOLD } from '../../src/domain/rule-suggestions'

describe('rule suggestions (006 T010)', () => {
  it('suggests from the second identical manual categorization', () => {
    expect(SUGGESTION_THRESHOLD).toBe(2)
    expect(shouldSuggest(1, 'open', false)).toBe(false)
    expect(shouldSuggest(2, 'open', false)).toBe(true)
    expect(shouldSuggest(5, 'open', false)).toBe(true)
  })

  it('never suggests again once accepted or declined', () => {
    expect(shouldSuggest(3, 'accepted', false)).toBe(false)
    expect(shouldSuggest(3, 'declined', false)).toBe(false)
  })

  it('stays quiet when a rule already covers the recipient', () => {
    expect(shouldSuggest(3, 'open', true)).toBe(false)
  })
})
