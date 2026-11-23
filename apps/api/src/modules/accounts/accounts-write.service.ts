import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import {
  type AccountDto,
  type CreateAccountInput,
  isValidIban,
  normalizeIban,
  type UpdateAccountInput,
} from '@finance/shared'
import { count, eq } from 'drizzle-orm'
import { DB } from '../../database/database.constants'
import type { AppDatabase } from '../../database/drizzle.module'
import { account, institution, transaction } from '../../database/schema'
import { RecomputeService } from '../import/recompute.service'
import { AccountsService } from './accounts.service'

/** Manual accounts (FR-056). */
@Injectable()
export class AccountsWriteService {
  constructor(
    @Inject(DB) private readonly db: AppDatabase,
    private readonly accounts: AccountsService,
    private readonly recompute: RecomputeService,
  ) {}

  create(input: CreateAccountInput): AccountDto {
    const iban = this.checkIban(input.iban)
    if (input.parentAccountId) this.mustExist(input.parentAccountId)
    const id = this.db.transaction((tx) => {
      const inst =
        tx
          .select({ id: institution.id })
          .from(institution)
          .where(eq(institution.name, input.institutionName))
          .get() ??
        tx
          .insert(institution)
          .values({ name: input.institutionName })
          .returning({ id: institution.id })
          .get()
      const created = tx
        .insert(account)
        .values({
          institutionId: inst.id,
          name: input.name,
          type: input.type,
          iban,
          balanceCents: input.balanceCents,
          parentAccountId: input.parentAccountId ?? null,
          sourceId: null,
        })
        .returning({ id: account.id })
        .get()
      this.recompute.recompute(tx, [created.id])
      return created.id
    })
    return this.get(id)
  }

  update(id: string, input: UpdateAccountInput): AccountDto {
    this.mustExist(id)
    const iban = input.iban === undefined ? undefined : this.checkIban(input.iban, id)
    this.db.transaction((tx) => {
      tx.update(account)
        .set({
          ...(input.name !== undefined && { name: input.name }),
          ...(input.type !== undefined && { type: input.type }),
          ...(iban !== undefined && { iban }),
          ...(input.balanceCents !== undefined && { balanceCents: input.balanceCents }),
          ...(input.isHidden !== undefined && { isHidden: input.isHidden }),
          ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
          ...(input.parentAccountId !== undefined && { parentAccountId: input.parentAccountId }),
        })
        .where(eq(account.id, id))
        .run()
      if (input.balanceCents !== undefined || input.type !== undefined)
        this.recompute.recompute(tx, [id])
    })
    return this.get(id)
  }

  remove(id: string, force: boolean): void {
    this.mustExist(id)
    const bookings =
      this.db.select({ n: count() }).from(transaction).where(eq(transaction.accountId, id)).get()
        ?.n ?? 0
    if (bookings > 0 && !force) {
      throw new ConflictException(`Konto hat ${bookings} Buchungen; zum Löschen force=true setzen`)
    }
    this.db.transaction((tx) => {
      tx.update(account).set({ parentAccountId: null }).where(eq(account.parentAccountId, id)).run()
      tx.delete(account).where(eq(account.id, id)).run()
    })
  }

  private get(id: string): AccountDto {
    return this.accounts.list().find((acc) => acc.id === id)!
  }

  private mustExist(id: string): void {
    if (!this.db.select({ id: account.id }).from(account).where(eq(account.id, id)).get()) {
      throw new NotFoundException('Konto nicht gefunden')
    }
  }

  private checkIban(raw: string | undefined, selfId?: string): string | null {
    if (!raw) return null
    const iban = normalizeIban(raw)
    if (!isValidIban(iban)) throw new BadRequestException('IBAN ist ungültig')
    const taken = this.db
      .select({ id: account.id })
      .from(account)
      .where(eq(account.iban, iban))
      .get()
    if (taken && taken.id !== selfId) {
      throw new ConflictException('IBAN ist bereits einem Konto zugeordnet')
    }
    return iban
  }
}
