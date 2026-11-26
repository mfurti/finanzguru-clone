import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common'
import type { SourceKind } from '@finance/shared'
import { DATA_SOURCES, type DataSource } from './data-source.interface'

/** Looks up DataSource implementations by kind. */
@Injectable()
export class SourcesRegistry {
  private readonly byKind = new Map<SourceKind, DataSource>()

  constructor(@Optional() @Inject(DATA_SOURCES) sources: DataSource[] = []) {
    for (const source of sources) {
      if (this.byKind.has(source.kind)) {
        throw new Error(`Duplicate data source for kind "${source.kind}"`)
      }
      this.byKind.set(source.kind, source)
    }
  }

  get(kind: SourceKind): DataSource {
    const source = this.byKind.get(kind)
    if (!source) throw new NotFoundException(`Unknown data source "${kind}"`)
    return source
  }

  has(kind: SourceKind): boolean {
    return this.byKind.has(kind)
  }

  kinds(): SourceKind[] {
    return [...this.byKind.keys()]
  }
}
