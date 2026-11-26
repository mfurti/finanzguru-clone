import { aliasedTable, eq } from 'drizzle-orm'
import type { AppDatabase } from '../../database/drizzle.module'
import { category } from '../../database/schema'
import type { Rule } from '../../domain/categorize'
import { categoryPaths, defaultRulesFor } from '../../domain/default-rules'

type Db = Pick<AppDatabase, 'select'>

/** Built-in merchant rules (010 R5) bound to this database's default categories. */
export function loadDefaultRules(db: Db): Rule[] {
  const parent = aliasedTable(category, 'parent')
  const rows = db
    .select({ id: category.id, name: category.name, parentName: parent.name })
    .from(category)
    .leftJoin(parent, eq(parent.id, category.parentId))
    .where(eq(category.isDefault, true))
    .all()
  return defaultRulesFor(categoryPaths(rows))
}
