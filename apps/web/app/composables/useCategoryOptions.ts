import type { CategoryNode } from '@finance/shared'

/** Category tree plus flat select items ("Main › Sub"), shared between pages. */
export async function useCategoryOptions(kinds?: readonly string[]) {
  const { data: tree, refresh } = await useApi<CategoryNode[]>('/api/categories', {
    key: 'categories',
    default: () => [],
  })
  const items = computed(() =>
    (tree.value ?? [])
      .filter((main) => !kinds || kinds.includes(main.kind))
      .flatMap((main) => [
        { label: main.name, value: main.id },
        ...main.children.map((child) => ({
          label: `${main.name} › ${child.name}`,
          value: child.id,
        })),
      ]),
  )
  return { tree, items, refresh }
}
