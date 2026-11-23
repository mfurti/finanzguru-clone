import { createHash } from 'node:crypto'
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type {
  CsvConfirmInput,
  CsvMapping,
  CsvMappingDto,
  CsvUploadResponse,
  ImportJobDto,
} from '@finance/shared'
import { eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, csvMapping, importJob } from '../../database/schema'
import { CsvSource, NeedsMappingError } from '../sources/csv/csv.source'
import { parseCsv } from '../sources/csv/detector'
import { MAPPED_ACCOUNT_REF } from '../sources/csv/generic-mapped'
import { ImportPipeline } from './import.pipeline'

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
