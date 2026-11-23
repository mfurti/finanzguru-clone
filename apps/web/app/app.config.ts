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
    // Body rows highlight on hover.
    table: {
      slots: {
        tbody: '[&>tr]:transition-colors [&>tr:hover]:bg-elevated/50',
      },
    },
  },
})
