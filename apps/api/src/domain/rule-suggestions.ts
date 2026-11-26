/**
 * When to suggest "Regel anlegen?" (006 US2, research R4): from the second identical manual
 * categorization of a recipient, as long as the owner has neither accepted nor declined the
 * suggestion and no enabled rule already covers the recipient.
 */

/** Manual categorizations of the same recipient into the same category before a suggestion. */
export const SUGGESTION_THRESHOLD = 2

export type SuggestionStatus = 'open' | 'accepted' | 'declined'

export function shouldSuggest(
  count: number,
  status: SuggestionStatus,
  coveredByRule: boolean,
): boolean {
  return status === 'open' && !coveredByRule && count >= SUGGESTION_THRESHOLD
}
