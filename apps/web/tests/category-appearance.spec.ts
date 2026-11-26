import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { useCategoryAppearance } from '~/composables/useCategoryAppearance'
import { CATEGORY_COLORS, categoryHex, nameHex, shadeHex } from '~/utils/category-colors'

registerEndpoint('/api/categories', () => [
  {
    id: 'home',
    parentId: null,
    name: 'Wohnen',
    kind: 'expense',
    color: 'blue',
    icon: 'house',
    isDefault: true,
    children: [
      {
        id: 'rent',
        parentId: 'home',
        name: 'Miete',
        kind: 'expense',
        color: 'red',
        icon: 'tag',
        isDefault: true,
        children: [],
      },
      {
        id: 'power',
        parentId: 'home',
        name: 'Strom',
        kind: 'expense',
        color: 'blue',
        icon: 'zap',
        isDefault: true,
        children: [],
      },
    ],
  },
])

describe('category colors', () => {
  it('maps stored keys to one hex and unknown keys to a stable slot', () => {
    expect(categoryHex('blue')).toBe(CATEGORY_COLORS.blue)
    expect(categoryHex('mystery')).toBe(categoryHex('mystery'))
    expect(Object.values(CATEGORY_COLORS)).toContain(categoryHex('mystery'))
    expect(categoryHex(null)).toBe(CATEGORY_COLORS.neutral)
  })

  it('lightens deeper levels and keeps names stable', () => {
    expect(shadeHex('#123456', 0)).toBe('#123456')
    expect(shadeHex('#123456', 1)).toContain('white')
    expect(nameHex('Girokonto')).toBe(nameHex('girokonto'))
  })
})

describe('useCategoryAppearance', () => {
  it('lets sub categories inherit the main color and fall back to its icon', async () => {
    let api: Awaited<ReturnType<typeof useCategoryAppearance>> | undefined
    await mountSuspended(
      defineComponent({
        async setup() {
          api = await useCategoryAppearance()
          return () => h('div')
        },
      }),
    )
    expect(api!.colorOf('rent')).toBe(CATEGORY_COLORS.blue)
    expect(api!.colorOf('home')).toBe(CATEGORY_COLORS.blue)
    expect(api!.iconOf('rent')).toBe('i-lucide-house')
    expect(api!.iconOf('power')).toBe('i-lucide-zap')
    expect(api!.shade('rent')).toContain('white')
    expect(api!.colorOf('unknown')).toBe(CATEGORY_COLORS.neutral)
  })
})
