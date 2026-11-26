import type { BenchmarkDto, BenchmarkSeries, ChartSettings } from '@finance/shared'

/**
 * "Vergleichen mit" (US5): the benchmark chosen for one chart, remembered via
 * /api/settings/charts, and its return per date over the chart's range.
 */
export function useBenchmark(
  chart: keyof ChartSettings,
  range: () => { from: string; to: string } | null,
) {
  const { data: benchmarks } = useApi<BenchmarkDto[]>('/api/benchmarks', {
    key: 'benchmarks',
    default: () => [],
  })
  const { data: settings } = useApi<ChartSettings>('/api/settings/charts', {
    key: 'chart-settings',
  })

  const selected = computed<string | null>({
    get: () => settings.value?.[chart] ?? null,
    set: (value) => {
      const next = {
        ...settings.value,
        networthBenchmark: settings.value?.networthBenchmark ?? null,
        investmentsBenchmark: settings.value?.investmentsBenchmark ?? null,
        [chart]: value,
      }
      settings.value = next
      void apiFetch('/api/settings/charts', { method: 'PUT', body: next })
    },
  })
  const name = computed(
    () => benchmarks.value?.find((b) => b.instrumentId === selected.value)?.name ?? null,
  )

  const series = ref<BenchmarkSeries | null>(null)
  watch(
    [selected, range],
    async ([id, current]) => {
      if (!id || !current) {
        series.value = null
        return
      }
      try {
        series.value = await apiFetch<BenchmarkSeries>(`/api/benchmarks/${id}/series`, {
          query: current,
        })
      } catch {
        series.value = null
      }
    },
    { immediate: import.meta.client },
  )

  /** Benchmark return (ratio) by ISO date. */
  const byDate = computed(
    () => new Map((series.value?.points ?? []).map((p) => [p.date, Number(p.return)])),
  )

  return { benchmarks, selected, name, series, byDate }
}
