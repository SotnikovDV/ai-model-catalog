import type { DatabaseSync } from 'node:sqlite';
import { normalizeModelName } from '../utils/normalizeModelName.js';

interface ModelRow {
  id: string;
  name: string;
  is_favorite: number;
  description: string;
  info_updated_at: string | null;
  use_cases: string;
  created_at: string;
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scoreRow(row: ModelRow): number {
  let score = 0;
  if (row.is_favorite) score += 1000;
  if (row.info_updated_at) score += 100;
  if (row.description.trim()) score += 50;
  score += parseJsonArray(row.use_cases).length;
  return score;
}

/**
 * Удаляет дубликаты по нормализованному имени, оставляя запись с наибольшим score.
 * При равном score сохраняется более ранняя запись (меньший created_at).
 */
export function deduplicateModels(db: DatabaseSync): number {
  const rows = db.prepare(`
    SELECT id, name, is_favorite, description, info_updated_at, use_cases, created_at
    FROM models
    ORDER BY created_at ASC
  `).all() as unknown as ModelRow[];

  const groups = new Map<string, ModelRow[]>();
  for (const row of rows) {
    const key = normalizeModelName(row.name);
    const group = groups.get(key);
    if (group) {
      group.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const deleteStmt = db.prepare('DELETE FROM models WHERE id = ?');
  let removed = 0;

  for (const group of groups.values()) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) => {
      const scoreDiff = scoreRow(b) - scoreRow(a);
      if (scoreDiff !== 0) return scoreDiff;
      return a.created_at.localeCompare(b.created_at);
    });

    const keeper = sorted[0];
    const duplicates = sorted.slice(1);

    const shouldFavorite = duplicates.some((row) => row.is_favorite);
    if (shouldFavorite && !keeper.is_favorite) {
      db.prepare('UPDATE models SET is_favorite = 1 WHERE id = ?').run(keeper.id);
    }

    for (const duplicate of duplicates) {
      deleteStmt.run(duplicate.id);
      removed++;
    }
  }

  return removed;
}
