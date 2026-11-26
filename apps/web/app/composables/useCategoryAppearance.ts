import type { CategoryNode } from '@finance/shared'

interface Appearance {
  color: string
  icon: string
  depth: number
}

/**
 * Color and icon per category id (research R9). Sub categories inherit the
 * color of their main category; an own icon wins over the parent's.
 */
export async function useCategoryAppearance() {
  const { tree } = await useCategoryOptions()
  const map = computed(() => {
    const result = new Map<string, Appearance>()
    for (const main of (tree.value ?? []) as CategoryNode[]) {
      const color = categoryHex(main.color)
      result.set(main.id, { color, icon: main.icon, depth: 0 })
      for (const child of main.children) {
        result.set(child.id, {
          color,
          icon: child.icon === 'tag' ? main.icon : child.icon,
          depth: 1,
        })
      }
    }
    return result
  })
  const colorOf = (id: string | null | undefined) =>
    (id && map.value.get(id)?.color) || categoryHex(null)
  const iconOf = (id: string | null | undefined) =>
    `i-lucide-${(id && map.value.get(id)?.icon) || 'tag'}`
  const shade = (id: string | null | undefined, depth = id ? (map.value.get(id)?.depth ?? 0) : 0) =>
    shadeHex(colorOf(id), depth)
  return { colorOf, iconOf, shade }
}
