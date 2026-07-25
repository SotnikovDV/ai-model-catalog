import type { DatabaseSync } from 'node:sqlite';
import { normalizeModelName } from '../utils/normalizeModelName.js';

interface BotHubNode {
  id: string;
  children?: unknown[];
  providers?: unknown[];
}

/** Узлы-агрегаторы провайдеров (openai, google, …) — не реальные модели. */
export function getProviderContainerIds(nodes: BotHubNode[]): Set<string> {
  const ids = new Set<string>();
  for (const node of nodes) {
    if (!node.children?.length && node.providers?.length) {
      ids.add(normalizeModelName(node.id));
    }
  }
  return ids;
}

export function pruneProviderContainers(db: DatabaseSync, containerIds: Set<string>): number {
  if (containerIds.size === 0) return 0;

  const rows = db.prepare('SELECT id, name FROM models').all() as { id: string; name: string }[];
  const deleteStmt = db.prepare('DELETE FROM models WHERE id = ?');
  let removed = 0;

  for (const row of rows) {
    if (containerIds.has(normalizeModelName(row.name))) {
      deleteStmt.run(row.id);
      removed++;
    }
  }

  return removed;
}

export function pruneModelsNotInAllowedSet(db: DatabaseSync, allowedNames: Set<string>): number {
  const rows = db.prepare('SELECT id, name FROM models').all() as { id: string; name: string }[];
  const deleteStmt = db.prepare('DELETE FROM models WHERE id = ?');
  let removed = 0;

  for (const row of rows) {
    if (!allowedNames.has(normalizeModelName(row.name))) {
      deleteStmt.run(row.id);
      removed++;
    }
  }

  return removed;
}
