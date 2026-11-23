import { createHash } from 'node:crypto'
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type {
  CsvConfirmInput,
  CsvMapping,
  CsvMappingDto,
  CsvUploadResponse,
  ImportJobDto,
} from '@finance/shared'
import { and, eq, inArray } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import {
  account,
  csvMapping,
  importJob,
  instrument,
  price,
  transaction,
} from '../../database/schema'
import { CsvSource, NeedsMappingError } from '../sources/csv/csv.source'
import { parseCsv } from '../sources/csv/detector'
import { MAPPED_ACCOUNT_REF } from '../sources/csv/generic-mapped'
import { parsePriceList } from '../sources/csv/price-list'
import { ImportPipeline } from './import.pipeline'
import { RecomputeService } from './recompute.service'

/** Uploaded files wait here until confirmed (single process, cleared after 30 min). */
const PENDING_TTL_MS = 30 * 60 * 1000

interface PendingUpload {
  file: Buffer
  signature: string
  layout: string | null
  expiresAt: number
}

@Injectable()
export class ImportService {
  private readonly pending = new Map<string, PendingUpload>()

  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly csv: CsvSource,
    private readonly pipeline: ImportPipeline,
    private readonly recompute: RecomputeService,
  ) {}

  upload(file: Buffer, fileName: string): CsvUploadResponse {
    this.prune()
    let parsed
    try {
      parsed = parseCsv(file)
    } catch {
      throw new BadRequestException('Datei ist keine lesbare CSV-Datei')
    }
    if (parsed.headers.length < 2)
      throw new BadRequestException('Datei ist keine lesbare CSV-Datei')
    const saved = this.mappingBySignature(parsed.signature)
    const job = this.db
      .insert(importJob)
      .values({
        sourceId: 'csv',
        kind: 'csv_upload',
        fileName: fileName.slice(0, 200),
        fileSha256: createHash('sha256').update(file).digest('hex'),
        format: parsed.layout ?? (saved ? `mapping:${saved.name}` : null),
      })
      .returning()
      .get()
    this.pending.set(job.id, {
      file,
      signature: parsed.signature,
      layout: parsed.layout,
      expiresAt: Date.now() + PENDING_TTL_MS,
    })
    return {
      jobId: job.id,
      detectedFormat: job.format,
      needsMapping: !parsed.layout && !saved,
      headers: parsed.headers,
      preview: parsed.rows.slice(0, 10),
      delimiter: parsed.delimiter,
      encoding: parsed.encoding,
    }
  }

  async confirm(jobId: string, input: CsvConfirmInput): Promise<ImportJobDto> {
    const upload = this.pending.get(jobId)
    const job = this.db.select().from(importJob).where(eq(importJob.id, jobId)).get()
    if (!job || !upload) throw new NotFoundException('Upload nicht gefunden oder abgelaufen')
    if (job.status !== 'pending') throw new BadRequestException('Upload wurde bereits verarbeitet')
    if (upload.layout === 'price-list') {
      const result = this.importPrices(jobId, upload.file, input.instrumentId)
      this.pending.delete(jobId)
      return result
    }

    if (input.accountId) {
      const exists = this.db
        .select({ id: account.id })
        .from(account)
        .where(eq(account.id, input.accountId))
        .get()
      if (!exists) throw new BadRequestException('Zielkonto nicht gefunden')
    }

    let mapping: CsvMapping | undefined = input.mapping
    if (!upload.layout && !mapping) {
      const saved = this.mappingBySignature(upload.signature)
      if (saved) mapping = saved
    }
    if (mapping && input.saveMappingAs) {
      this.db
        .insert(csvMapping)
        .values({
          name: input.saveMappingAs,
          headerSignature: upload.signature,
          delimiter: mapping.delimiter,
          encoding: mapping.encoding,
          dateFormat: mapping.dateFormat,
          decimalSeparator: mapping.decimalSeparator,
          skipRows: mapping.skipRows,
          columns: mapping.columns as unknown as Record<string, number>,
          defaultAccountId: input.accountId ?? null,
        })
        .onConflictDoUpdate({
          target: csvMapping.headerSignature,
          set: {
            name: input.saveMappingAs,
            delimiter: mapping.delimiter,
            encoding: mapping.encoding,
            dateFormat: mapping.dateFormat,
            decimalSeparator: mapping.decimalSeparator,
            skipRows: mapping.skipRows,
            columns: mapping.columns as unknown as Record<string, number>,
          },
        })
        .run()
    }

    let batch
    try {
      batch = await this.csv.fetch({
        kind: 'csv',
        file: upload.file,
        fileName: job.fileName ?? '',
        mapping: upload.layout ? undefined : mapping,
      })
    } catch (error) {
      if (error instanceof NeedsMappingError)
        throw new BadRequestException('Spaltenzuordnung erforderlich')
      throw error
    }
    const usesMapping = !upload.layout
    const targetAccountId =
      input.accountId ?? (usesMapping ? this.defaultAccount(upload.signature) : undefined)
    if (usesMapping && !targetAccountId) {
      throw new BadRequestException('Für eigene Spaltenzuordnungen bitte ein Zielkonto wählen')
    }
    if (usesMapping) {
      for (const tx of batch.transactions) tx.accountExternalRef = MAPPED_ACCOUNT_REF
    }

    this.db
      .update(importJob)
      .set({ status: 'running', format: job.format ?? (mapping ? 'mapping' : null) })
      .where(eq(importJob.id, jobId))
      .run()
    this.pending.delete(jobId)
    return this.pipeline.run(batch, { jobId, source: 'csv', sourceId: 'csv', targetAccountId })
  }

  /**
   * "Kursliste": upserts daily closes with source `csv`. `imported` counts new
   * or changed prices, `skipped` unchanged ones, `failed` invalid rows. Depots
   * holding an affected instrument are recomputed from the earliest new date.
   */
  private importPrices(jobId: string, file: Buffer, instrumentId?: string): ImportJobDto {
    const parsed = parsePriceList(parseCsv(file))
    if (!parsed.hasIsinColumn && !instrumentId) {
      throw new BadRequestException('Bitte das Wertpapier für die Kursliste wählen')
    }
    const byIsin = new Map(
      this.db
        .select({ id: instrument.id, isin: instrument.isin })
        .from(instrument)
        .all()
        .map((row) => [row.isin, row.id]),
    )
    if (!parsed.hasIsinColumn && ![...byIsin.values()].includes(instrumentId!)) {
      throw new BadRequestException('Wertpapier nicht gefunden')
    }
    const errors = [...parsed.errors]
    let imported = 0
    let skipped = 0

    this.db.transaction((tx) => {
      const earliest = new Map<string, string>()
      for (const row of parsed.rows) {
        const target = row.isin ? byIsin.get(row.isin) : instrumentId
        if (!target) {
          errors.push({ line: row.line, reason: `Wertpapier ${row.isin} unbekannt` })
          continue
        }
        const current = tx
          .select({ close: price.close })
          .from(price)
          .where(and(eq(price.instrumentId, target), eq(price.date, row.date)))
          .get()
        if (current?.close === row.close) {
          skipped++
          continue
        }
        tx.insert(price)
          .values({ instrumentId: target, date: row.date, close: row.close, source: 'csv' })
          .onConflictDoUpdate({
            target: [price.instrumentId, price.date],
            set: { close: row.close, source: 'csv' },
          })
          .run()
        imported++
        const first = earliest.get(target)
        if (!first || row.date < first) earliest.set(target, row.date)
      }
      if (earliest.size > 0) {
        const holders = tx
          .selectDistinct({ accountId: transaction.accountId })
          .from(transaction)
          .where(inArray(transaction.instrumentId, [...earliest.keys()]))
          .all()
          .map((row) => row.accountId)
        const from = [...earliest.values()].sort()[0]
        this.recompute.recompute(tx, holders, from)
      }
      tx.update(importJob)
        .set({
          status: errors.length === 0 ? 'succeeded' : imported + skipped > 0 ? 'partial' : 'failed',
          imported,
          skipped,
          failed: errors.length,
          errors: errors.slice(0, 500),
          finishedAt: new Date().toISOString(),
        })
        .where(eq(importJob.id, jobId))
        .run()
    })
    return this.job(jobId)
  }

  job(id: string): ImportJobDto {
    const job = this.db.select().from(importJob).where(eq(importJob.id, id)).get()
    if (!job) throw new NotFoundException('Import nicht gefunden')
    return job as ImportJobDto
  }

  mappings(): CsvMappingDto[] {
    return this.db.select().from(csvMapping).all() as unknown as CsvMappingDto[]
  }

  deleteMapping(id: string): void {
    const result = this.db.delete(csvMapping).where(eq(csvMapping.id, id)).run()
    if (result.changes === 0) throw new NotFoundException('Zuordnung nicht gefunden')
  }

  private mappingBySignature(signature: string): (CsvMapping & { name: string }) | undefined {
    const row = this.db
      .select()
      .from(csvMapping)
      .where(eq(csvMapping.headerSignature, signature))
      .get()
    return row ? (row as unknown as CsvMapping & { name: string }) : undefined
  }

  private defaultAccount(signature: string): string | undefined {
    return (
      this.db
        .select({ id: csvMapping.defaultAccountId })
        .from(csvMapping)
        .where(eq(csvMapping.headerSignature, signature))
        .get()?.id ?? undefined
    )
  }

  private prune(): void {
    const now = Date.now()
    for (const [id, upload] of this.pending) if (upload.expiresAt < now) this.pending.delete(id)
  }
}
