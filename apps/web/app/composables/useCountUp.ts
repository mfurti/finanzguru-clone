/**
 * Animated number for headline amounts: when `source` changes on the client,
 * the returned ref counts from the old to the new value (ease-out, 600 ms).
 * The first render and SSR show the final value; prefers-reduced-motion skips
 * the animation.
 */
export function useCountUp(
  source: () => number | null | undefined,
  duration = 600,
): Ref<number | null | undefined> {
  const shown = ref(source())
  let frame = 0

  watch(source, (to, from) => {
    if (import.meta.server) return
    cancelAnimationFrame(frame)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || to == null || from == null || to === from) {
      shown.value = to
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - progress) ** 3
      shown.value = progress === 1 ? to : Math.round(from + (to - from) * eased)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
  })

  onBeforeUnmount(() => cancelAnimationFrame(frame))
  return shown
}
