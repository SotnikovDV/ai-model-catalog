import { getDb } from '../db/db.js';
import { modelRepository } from './modelRepository.js';
import type {
  ModelList,
  ModelListAddItemsResult,
  ModelListCreateInput,
  ModelListDetail,
  ModelListItemPublic,
  ModelListItemRow,
  ModelListItemsAddInput,
  ModelListPublicViewOptions,
  ModelListSummary,
  ModelListUpdateInput,
} from '../types/modelList.js';

const SELECT_LIST = `
  SELECT id, name, description, created_at, updated_at
  FROM model_lists
`;

const SELECT_ITEM = `
  SELECT list_id, model_id, comment, sort_order, created_at
  FROM model_list_items
`;

function rowToList(row: Record<string, unknown>): ModelList {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function rowToItem(row: Record<string, unknown>): ModelListItemRow {
  return {
    list_id: row.list_id as string,
    model_id: row.model_id as string,
    comment: (row.comment as string) ?? '',
    sort_order: Number(row.sort_order) || 0,
    created_at: row.created_at as string,
  };
}

function hydrateItems(
  rows: ModelListItemRow[],
  options: ModelListPublicViewOptions = {},
): ModelListItemPublic[] {
  if (rows.length === 0) return [];
  const models = modelRepository.findByIds(rows.map((row) => row.model_id));
  const byId = new Map(models.map((model) => [model.id, model]));
  const items: ModelListItemPublic[] = [];
  for (const row of rows) {
    const model = byId.get(row.model_id) ?? null;
    if (options.excludeHidden && (!model || model.is_hidden)) {
      continue;
    }
    items.push({
      modelId: row.model_id,
      comment: row.comment,
      sortOrder: row.sort_order,
      model,
    });
  }
  return items;
}

export class ModelListRepository {
  private db = getDb();

  findAllSummaries(options: ModelListPublicViewOptions = {}): ModelListSummary[] {
    const itemCountExpr = options.excludeHidden
      ? 'COUNT(CASE WHEN m.id IS NOT NULL AND m.is_hidden = 0 THEN i.model_id END)'
      : 'COUNT(i.model_id)';
    const rows = this.db
      .prepare(
        `
      SELECT
        l.id, l.name, l.description, l.created_at, l.updated_at,
        ${itemCountExpr} AS item_count
      FROM model_lists l
      LEFT JOIN model_list_items i ON i.list_id = l.id
      LEFT JOIN models m ON m.id = i.model_id
      GROUP BY l.id
      ORDER BY l.name COLLATE NOCASE
    `,
      )
      .all() as Record<string, unknown>[];

    return rows.map((row) => ({
      ...rowToList(row),
      itemCount: Number(row.item_count) || 0,
    }));
  }

  findById(id: string): ModelList | null {
    const row = this.db.prepare(`${SELECT_LIST} WHERE id = ?`).get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? rowToList(row) : null;
  }

  findDetailById(id: string, options: ModelListPublicViewOptions = {}): ModelListDetail | null {
    const list = this.findById(id);
    if (!list) return null;
    return {
      ...list,
      items: this.findItems(id, options),
    };
  }

  findItems(listId: string, options: ModelListPublicViewOptions = {}): ModelListItemPublic[] {
    const rows = this.db
      .prepare(`${SELECT_ITEM} WHERE list_id = ? ORDER BY sort_order ASC, created_at ASC`)
      .all(listId) as Record<string, unknown>[];
    return hydrateItems(rows.map(rowToItem), options);
  }

  findItem(listId: string, modelId: string): ModelListItemRow | null {
    const row = this.db
      .prepare(`${SELECT_ITEM} WHERE list_id = ? AND model_id = ?`)
      .get(listId, modelId) as Record<string, unknown> | undefined;
    return row ? rowToItem(row) : null;
  }

  create(input: ModelListCreateInput): ModelList {
    const id = input.id ?? crypto.randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      INSERT INTO model_lists (id, name, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
    `,
      )
      .run(id, input.name, input.description ?? '', now, now);
    return this.findById(id)!;
  }

  update(id: string, input: ModelListUpdateInput): ModelList | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const next = {
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
    };
    const now = new Date().toISOString();
    this.db
      .prepare(
        `
      UPDATE model_lists
      SET name = ?, description = ?, updated_at = ?
      WHERE id = ?
    `,
      )
      .run(next.name, next.description, now, id);
    return this.findById(id);
  }

  delete(id: string): boolean {
    this.db.prepare('DELETE FROM model_list_items WHERE list_id = ?').run(id);
    const result = this.db.prepare('DELETE FROM model_lists WHERE id = ?').run(id);
    return (result as { changes: number }).changes > 0;
  }

  private nextSortOrder(listId: string): number {
    const row = this.db
      .prepare('SELECT COALESCE(MAX(sort_order), -1) AS max_order FROM model_list_items WHERE list_id = ?')
      .get(listId) as { max_order: number };
    return (Number(row.max_order) || 0) + 1;
  }

  private touchList(listId: string): void {
    this.db
      .prepare('UPDATE model_lists SET updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), listId);
  }

  addItems(listId: string, input: ModelListItemsAddInput): ModelListAddItemsResult | null {
    if (!this.findById(listId)) return null;

    let added = 0;
    let skipped = 0;
    let sortOrder = this.nextSortOrder(listId);
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO model_list_items (list_id, model_id, comment, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const item of input.items) {
      const model = modelRepository.findById(item.modelId);
      if (!model) {
        skipped += 1;
        continue;
      }
      if (this.findItem(listId, item.modelId)) {
        skipped += 1;
        continue;
      }
      insert.run(listId, item.modelId, item.comment ?? '', sortOrder, now);
      sortOrder += 1;
      added += 1;
    }

    if (added > 0) this.touchList(listId);

    return {
      added,
      skipped,
      items: this.findItems(listId),
    };
  }

  updateItemComment(listId: string, modelId: string, comment: string): ModelListItemPublic | null {
    if (!this.findItem(listId, modelId)) return null;
    this.db
      .prepare('UPDATE model_list_items SET comment = ? WHERE list_id = ? AND model_id = ?')
      .run(comment, listId, modelId);
    this.touchList(listId);
    const items = this.findItems(listId);
    return items.find((item) => item.modelId === modelId) ?? null;
  }

  removeItem(listId: string, modelId: string): boolean {
    const result = this.db
      .prepare('DELETE FROM model_list_items WHERE list_id = ? AND model_id = ?')
      .run(listId, modelId);
    const ok = (result as { changes: number }).changes > 0;
    if (ok) this.touchList(listId);
    return ok;
  }
}

export const modelListRepository = new ModelListRepository();
