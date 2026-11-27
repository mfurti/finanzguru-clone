import type { Period } from '@finance/shared'

/**
 * Period a chart opens with (014 Anzeige): the owner's default, or 1J when the chart does not
 * offer that period.
 */
export function useDefaultPeriod(allowed?: readonly Period[]): Period {
  const { settings } = useSettings()
  const wanted = settings.value.defaultPeriod
  return !allowed || allowed.includes(wanted) ? wanted : '1Y'
}
