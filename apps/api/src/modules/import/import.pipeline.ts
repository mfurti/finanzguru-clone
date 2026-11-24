import { Inject, Injectable, Logger } from '@nestjs/common'
import type { ImportJobDto, RowError, TransactionSource } from '@finance/shared'
import { and, asc, eq, inArray, isNotNull, or } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  account,
  deletedImportMarker,
  categorizationRule,
  importJob,
  institution,
  instrument,
  positionLot,
  price,
  transaction,
} from '../../database/schema'
import { categorize, type Rule } from '../../domain/categorize'
import { fingerprintBatch } from '../../domain/dedupe'
import { D } from '../../domain/money'
import type { NormalizedAccount, SyncBatch } from '../sources/data-source.interface'
import { RecomputeService } from './recompute.service'

/** Row errors kept per job (data-model.md). */
export const MAX_STORED_ERRORS = 500

type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0]

export interface PipelineOptions {
  jobId: string
  source: TransactionSource
  sourceId: string
  /** Put every batch account's transactions into this existing account (CSV confirm). */
  targetAccountId?: string
}

export interface PipelineResult {
  imported: number
  skipped: number
  failed: number
  accountIds: string[]
}

/**
 * Shared import pipeline for all data sources: resolve accounts and
 * instruments, store prices, dedupe, categorize, insert, recompute derived
 * tables and record the job, all in one DB transaction.
 */
@Injectable()
export class ImportPipeline {
  private readonly logger = new Logger(ImportPipeline.name)

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly recompute: RecomputeService,
  ) {}

  run(batch: SyncBatch, options: PipelineOptions): ImportJobDto {
    const rowErrors = batch.rowErrors
    try {
      const result = this.db.transaction((tx) => this.apply(tx, batch, options))
      const status =
        rowErrors.length === 0
          ? 'succeeded'
          : result.imported + result.skipped > 0
            ? 'partial'
            : 'failed'
      return this.finish(options.jobId, {
        status,
        imported: result.imported,
        skipped: result.skipped,
        failed: rowErrors.length,
        errors: rowErrors,
        accountId: options.targetAccountId ?? result.accountIds[0] ?? null,
      })
    } catch (error) {
      this.logger.error(`Import ${options.jobId} failed: ${String(error)}`)
      return this.finish(options.jobId, {
        status: 'failed',
        imported: 0,
        skipped: 0,
        failed: batch.transactions.length + rowErrors.length,
        errors: [...rowErrors, { reason: error instanceof Error ? error.message : String(error) }],
        accountId: options.targetAccountId ?? null,
      })
    }
  }

  private finish(
    jobId: string,
    values: {
      status: ImportJobDto['status']
      imported: number
      skipped: number
      failed: number
      errors: RowError[]
      accountId: string | null
    },
  ): ImportJobDto {
    return this.db
      .update(importJob)
      .set({
        ...values,
        errors: values.errors.slice(0, MAX_STORED_ERRORS),
        finishedAt: new Date().toISOString(),
      })
      .where(eq(importJob.id, jobId))
      .returning()
      .get() as ImportJobDto
  }

  private apply(tx: Tx, batch: SyncBatch, options: PipelineOptions): PipelineResult {
    const accountIds = this.resolveAccounts(tx, batch, options)
    const createdAccounts = new Set(accountIds.created)
    const instrumentIds = this.resolveInstruments(tx, batch)

    for (const point of batch.prices) {
      const instrumentId = instrumentIds.get(point.isin)
      if (!instrumentId) continue
      tx.insert(price)
        .values({
          instrumentId,
          date: point.date,
          close: point.close,
          source: options.source === 'scalable_mcp' ? 'scalable' : 'csv',
        })
        .onConflictDoNothing()
        .run()
    }

    const rules = tx
      .select()
      .from(categorizationRule)
      .orderBy(asc(categorizationRule.priority))
      .all() as Rule[]
    const ownIbans = new Set(
      tx
        .select({ iban: account.iban })
        .from(account)
        .where(isNotNull(account.iban))
        .all()
        .map((row) => row.iban!),
    )

    let imported = 0
    let skipped = 0
    const firstDate = new Map<string, string>()
    const importedSum = new Map<string, number>()

    const byAccount = new Map<string, SyncBatch['transactions']>()
    for (const item of batch.transactions) {
      const accountId = accountIds.byRef.get(item.accountExternalRef)
      if (!accountId) throw new Error(`No account for "${item.accountExternalRef}"`)
      const list = byAccount.get(accountId) ?? []
      list.push(item)
      byAccount.set(accountId, list)
    }

    for (const [accountId, items] of byAccount) {
      const fingerprints = fingerprintBatch(accountId, items)
      items.forEach((item, index) => {
        const fingerprint = fingerprints[index]!
        const duplicate =
          (item.sourceRef &&
            tx
              .select({ id: transaction.id })
              .from(transaction)
              .where(
                and(
                  eq(transaction.source, options.source),
                  eq(transaction.sourceRef, item.sourceRef),
                ),
              )
              .get()) ||
          tx
            .select({ id: transaction.id })
            .from(transaction)
            .where(eq(transaction.fingerprint, fingerprint))
            .get() ||
          // Deleted by the owner earlier: never bring it back (003 FR-007).
          tx
            .select({ id: deletedImportMarker.id })
            .from(deletedImportMarker)
            .where(
              and(
                eq(deletedImportMarker.source, options.source),
                item.sourceRef
                  ? or(
                      eq(deletedImportMarker.fingerprint, fingerprint),
                      eq(deletedImportMarker.sourceRef, item.sourceRef),
                    )
                  : eq(deletedImportMarker.fingerprint, fingerprint),
              ),
            )
            .get()
        if (duplicate) {
          skipped++
          return
        }
        const instrumentId = item.isin ? instrumentIds.get(item.isin) : undefined
        if (item.isin && !instrumentId) throw new Error(`Unknown instrument ${item.isin}`)
        const category = categorize(item, rules, ownIbans)
        tx.insert(transaction)
          .values({
            accountId,
            bookingDate: item.bookingDate,
            valueDate: item.valueDate ?? null,
            amountCents: item.amountCents,
            type: category.type,
            counterparty: item.counterparty ?? null,
            counterpartyIban: item.counterpartyIban ?? null,
            purpose: item.purpose ?? null,
            instrumentId: instrumentId ?? null,
            quantity: item.quantity ?? null,
            unitPrice: item.unitPrice ?? null,
            feeCents: item.feeCents ?? 0,
            taxCents: item.taxCents ?? 0,
            categoryId: category.categoryId,
            categorySource: category.categorySource,
            reviewStatus: 'unreviewed',
            source: options.source,
            sourceRef: item.sourceRef ?? null,
            fingerprint,
            importJobId: options.jobId,
          })
          .run()
        imported++
        importedSum.set(accountId, (importedSum.get(accountId) ?? 0) + item.amountCents)
        const first = firstDate.get(accountId)
        if (!first || item.bookingDate < first) firstDate.set(accountId, item.bookingDate)
      })
    }

    // Balances: an explicit balance from the source wins; an account created by
    // this import starts at the sum of its bookings; existing accounts keep theirs.
    for (const normalized of batch.accounts) {
      const accountId = accountIds.byRef.get(normalized.externalRef)!
      if (normalized.balanceCents !== undefined) {
        tx.update(account)
          .set({ balanceCents: normalized.balanceCents })
          .where(eq(account.id, accountId))
          .run()
      } else if (createdAccounts.has(accountId) && normalized.type !== 'depot') {
        tx.update(account)
          .set({ balanceCents: importedSum.get(accountId) ?? 0 })
          .where(eq(account.id, accountId))
          .run()
      }
    }

    // Accounts whose balance came with the batch (sync) are rebuilt too, even without new bookings.
    const balanced = batch.accounts
      .filter((item) => item.balanceCents !== undefined)
      .map((item) => accountIds.byRef.get(item.externalRef))
      .filter((id): id is string => !!id)
    const touched = [...new Set([...firstDate.keys(), ...balanced])]
    const earliest = [...firstDate.values()].sort()[0]
    if (touched.length > 0) this.recompute.recompute(tx, touched, earliest)

    // Positions the source reports vs. positions from the imported bookings (004 T007).
    for (const item of batch.positionsSnapshot ?? []) {
      const accountId = accountIds.byRef.get(item.accountExternalRef)
      const instrumentId = instrumentIds.get(item.isin)
      if (!accountId || !instrumentId) continue
      const lots = tx
        .select({ quantity: positionLot.quantityOpen })
        .from(positionLot)
        .where(
          and(eq(positionLot.accountId, accountId), eq(positionLot.instrumentId, instrumentId)),
        )
        .all()
      const held = lots.reduce((sum, lot) => sum.plus(lot.quantity), new D(0))
      if (held.minus(item.quantity).abs().gt('0.000001')) {
        batch.rowErrors.push({
          reason: `positions_mismatch:${item.isin}: Quelle ${item.quantity}, Buchungen ${held.toString()}`,
        })
      }
    }

    return { imported, skipped, failed: 0, accountIds: [...new Set(accountIds.byRef.values())] }
  }

  private resolveAccounts(
    tx: Tx,
    batch: SyncBatch,
    options: PipelineOptions,
  ): { byRef: Map<string, string>; created: string[] } {
    const byRef = new Map<string, string>()
    const created: string[] = []
    const refs = new Set(batch.transactions.map((item) => item.accountExternalRef))

    if (options.targetAccountId) {
      const target = tx.select().from(account).where(eq(account.id, options.targetAccountId)).get()
      if (!target) throw new Error('Target account not found')
      for (const ref of refs) byRef.set(ref, target.id)
      for (const normalized of batch.accounts) byRef.set(normalized.externalRef, target.id)
      return { byRef, created }
    }

    const ordered = [...batch.accounts].sort(
      (a, b) => Number(!!a.parentExternalRef) - Number(!!b.parentExternalRef),
    )
    for (const normalized of ordered) {
      const existing = this.findAccount(tx, normalized)
      if (existing) {
        byRef.set(normalized.externalRef, existing)
        continue
      }
      const institutionId = this.institutionId(tx, normalized.institutionName)
      const parentAccountId = normalized.parentExternalRef
        ? byRef.get(normalized.parentExternalRef)
        : undefined
      const id = tx
        .insert(account)
        .values({
          institutionId,
          name: normalized.name.slice(0, 80),
          type: normalized.type,
          iban: normalized.iban ?? null,
          parentAccountId: parentAccountId ?? null,
          sourceId: options.sourceId,
          balanceCents: normalized.balanceCents ?? 0,
        })
        .returning({ id: account.id })
        .get().id
      byRef.set(normalized.externalRef, id)
      created.push(id)
    }
    for (const ref of refs) {
      if (!byRef.has(ref)) throw new Error(`Batch references unknown account "${ref}"`)
    }
    return { byRef, created }
  }

  /** Same IBAN, or same institution + name + type. */
  private findAccount(tx: Tx, normalized: NormalizedAccount): string | undefined {
    if (normalized.iban) {
      const byIban = tx
        .select({ id: account.id })
        .from(account)
        .where(eq(account.iban, normalized.iban))
        .get()
      if (byIban) return byIban.id
    }
    const inst = tx
      .select({ id: institution.id })
      .from(institution)
      .where(eq(institution.name, normalized.institutionName))
      .get()
    if (!inst) return undefined
    return tx
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.institutionId, inst.id),
          eq(account.name, normalized.name),
          eq(account.type, normalized.type),
        ),
      )
      .get()?.id
  }

  private institutionId(tx: Tx, name: string): string {
    const existing = tx
      .select({ id: institution.id })
      .from(institution)
      .where(eq(institution.name, name))
      .get()
    if (existing) return existing.id
    return tx.insert(institution).values({ name }).returning({ id: institution.id }).get().id
  }

  private resolveInstruments(tx: Tx, batch: SyncBatch): Map<string, string> {
    const isins = new Set([
      ...batch.instruments.map((item) => item.isin),
      ...batch.transactions.flatMap((item) => (item.isin ? [item.isin] : [])),
    ])
    const ids = new Map<string, string>()
    if (isins.size === 0) return ids
    for (const row of tx
      .select({ id: instrument.id, isin: instrument.isin })
      .from(instrument)
      .where(inArray(instrument.isin, [...isins]))
      .all()) {
      ids.set(row.isin, row.id)
    }
    for (const item of batch.instruments) {
      if (ids.has(item.isin)) continue
      const id = tx
        .insert(instrument)
        .values({
          isin: item.isin,
          wkn: item.wkn ?? null,
          name: item.name,
          assetClass: item.assetClass,
          currency: item.currency.length === 3 ? item.currency : 'EUR',
          // Default partial exemption class for funds (feature 002).
          fundType: item.assetClass === 'etf' || item.assetClass === 'fund' ? 'equity' : null,
        })
        .returning({ id: instrument.id })
        .get().id
      ids.set(item.isin, id)
    }
    return ids
  }
}
