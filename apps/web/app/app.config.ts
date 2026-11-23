export default defineAppConfig({
  ui: {
    colors: {
      // Own brand: indigo accent on zinc neutrals (research R15).
      primary: 'indigo',
      neutral: 'zinc',
      success: 'emerald',
      error: 'rose',
    },
    // Press feedback on every button; motion-reduce keeps it still.
    button: {
      slots: {
        base: 'transition-[color,background-color,border-color,box-shadow,scale] duration-150 active:scale-[0.97] motion-reduce:active:scale-100',
      },
    },
    // Cards like the reference: own surface color, 16 px radius, no border, 24 px padding.
    card: {
      slots: {
        root: 'rounded-2xl bg-(--app-card) ring-0 divide-y-0',
        header: 'px-4 pt-5 pb-0 sm:px-6 sm:pt-6',
        body: 'p-4 sm:p-6',
        footer: 'px-4 pb-5 pt-0 sm:px-6 sm:pb-6',
      },
      // The default variant adds bg-default + ring + dividers; replace them here,
      // otherwise they win over the root slot classes above.
      variants: {
        variant: {
          outline: { root: 'bg-(--app-card) ring-0 divide-y-0' },
        },
      },
    },
    // Body rows highlight on hover.
    table: {
      slots: {
        th: 'text-sm font-semibold text-highlighted whitespace-nowrap',
        tbody: '[&>tr]:transition-colors [&>tr:hover]:bg-(--app-card-hover)',
      },
    },
  },
})
