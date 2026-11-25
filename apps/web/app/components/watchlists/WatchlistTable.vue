<script setup lang="ts">
import { formatDate, type WatchlistEntryDto } from '@finance/shared'

/**
 * Securities of a watchlist with price, date and change (US6). With a broker quote (005 US4)
 * the time of the quote is shown instead of the date, plus a 30-day sparkline.
 */
defineProps<{ entries: WatchlistEntryDto[] }>()
const emit = defineEmits<{ remove: [entry: WatchlistEntryDto] }>()
const { t } = useI18n()

/** "Kurs vom 25.11.2026, 12:12" from an ISO time. */
const quoteTime = (iso: string) =>
  t('marketData.quotedAt', {
    time: new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }),
  })
</script>

<template>
  <p v-if="entries.length === 0" class="text-sm text-muted">{{ t('watchlists.empty') }}</p>
  <ul v-else class="divide-y divide-default text-sm" data-testid="watchlist-entries">
    <li
      v-for="entry in entries"
      :key="entry.instrumentId"
      class="row-hover flex items-center justify-between gap-3 py-2"
    >
      <span class="min-w-0">
        <NuxtLink
          :to="`/investments/${entry.instrumentId}`"
          class="link-hover block truncate font-medium"
        >
          {{ entry.name }}
        </NuxtLink>
        <span class="text-xs text-muted">{{ entry.isin }}</span>
      </span>
      <span class="flex shrink-0 items-center gap-3">
        <template v-if="entry.hasPrices">
          <Sparkline
            v-if="entry.sparkline && entry.sparkline.length > 1"
            :values="entry.sparkline"
            class="hidden sm:block"
          />
          <span class="text-right">
            <Money :cents="entry.priceCents" class="block" />
            <span class="text-xs text-muted" data-testid="watchlist-price-time">
              {{
                entry.quotedAt && entry.quotedAt.slice(0, 10) === entry.priceDate
                  ? quoteTime(entry.quotedAt)
                  : formatDate(entry.priceDate!)
              }}
              <UBadge v-if="entry.stale" color="warning" variant="soft" size="sm">
                {{ t('benchmark.stale') }}
              </UBadge>
            </span>
          </span>
          <span class="w-24 text-right">
            <Percent :value="entry.changePct" signed class="block" />
            <Money :cents="entry.changeCents" signed class="text-xs" />
          </span>
        </template>
        <UButton
          v-else
          size="xs"
          variant="soft"
          color="neutral"
          to="/settings/sources"
          :label="t('watchlists.noPrices')"
          data-testid="watchlist-no-prices"
        />
        <UButton
          icon="i-lucide-x"
          size="xs"
          variant="ghost"
          color="neutral"
          :aria-label="t('watchlists.remove')"
          data-testid="watchlist-remove"
          @click="emit('remove', entry)"
        />
      </span>
    </li>
  </ul>
</template>
