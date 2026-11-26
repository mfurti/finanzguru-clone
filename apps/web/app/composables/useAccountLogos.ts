import type { AccountDto, LogoRef } from '@finance/shared'

/**
 * Bank and broker logos of the owner's accounts (009): one shared `/api/accounts` request
 * (same cache key as the account filter), looked up by account id or institution name.
 */
export async function useAccountLogos() {
  const { data: accounts, refresh } = await useApi<AccountDto[]>('/api/accounts', {
    key: 'accounts',
    default: () => [],
  })

  const byAccount = (id: string | null | undefined): LogoRef =>
    (id ? accounts.value?.find((acc) => acc.id === id)?.logo : null) ?? null

  /** First account whose institution name contains `name` (case-insensitive). */
  const byInstitution = (name: string | null | undefined): LogoRef => {
    const needle = (name ?? '').trim().toLowerCase()
    if (!needle) return null
    return (
      accounts.value?.find((acc) => acc.institutionName.toLowerCase().includes(needle))?.logo ??
      null
    )
  }

  return { accounts, refresh, byAccount, byInstitution }
}
