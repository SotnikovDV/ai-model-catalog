import { randomUUID } from 'node:crypto';
import { getDb } from '../db/db.js';
import type { RecommendationResult } from '../types/ai.js';
import type {
  AssistantChat,
  AssistantChatCreateInput,
  AssistantChatListItem,
  AssistantChatUpdateInput,
  AssistantStoredMessage,
} from '../types/assistantChat.js';

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function titleFromQuery(query: string, fallback = 'Новый чат'): string {
  const trimmed = query.trim().replace(/\s+/g, ' ');
  if (!trimmed) return fallback;
  if (trimmed.length <= 60) return trimmed;
  return `${trimmed.slice(0, 57)}…`;
}

function rowToListItem(row: Record<string, unknown>): AssistantChatListItem {
  const messages = parseJson<AssistantStoredMessage[]>(row.messages_json as string, []);
  return {
    id: row.id as string,
    title: row.title as string,
    messageCount: messages.length,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToChat(row: Record<string, unknown>): AssistantChat {
  const listItem = rowToListItem(row);
  return {
    ...listItem,
    messages: parseJson<AssistantStoredMessage[]>(row.messages_json as string, []),
    lastResult: row.last_result_json
      ? parseJson<RecommendationResult>(row.last_result_json as string, null as unknown as RecommendationResult)
      : null,
  };
}

export class AssistantChatRepository {
  private db = getDb();

  create(input: AssistantChatCreateInput): AssistantChat {
    const id = randomUUID();
    const now = new Date().toISOString();
    const title = input.title?.trim() || 'Новый чат';
    const messages = input.messages ?? [];

    this.db.prepare(`
      INSERT INTO assistant_chats (
        id, title, messages_json, last_result_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      JSON.stringify(messages),
      input.lastResult != null ? JSON.stringify(input.lastResult) : null,
      now,
      now,
    );

    const created = this.findById(id);
    if (!created) {
      throw new Error('Не удалось сохранить чат ассистента');
    }
    return created;
  }

  update(id: string, input: AssistantChatUpdateInput): AssistantChat | null {
    const existing = this.findById(id);
    if (!existing) return null;

    const title = input.title?.trim() || existing.title;
    const messages = input.messages ?? existing.messages;
    const lastResult = input.lastResult !== undefined ? input.lastResult : existing.lastResult;
    const updatedAt = new Date().toISOString();

    this.db.prepare(`
      UPDATE assistant_chats
      SET title = ?, messages_json = ?, last_result_json = ?, updated_at = ?
      WHERE id = ?
    `).run(
      title,
      JSON.stringify(messages),
      lastResult != null ? JSON.stringify(lastResult) : null,
      updatedAt,
      id,
    );

    return this.findById(id);
  }

  findRecent(limit = 50, offset = 0): AssistantChatListItem[] {
    const rows = this.db.prepare(`
      SELECT id, title, messages_json, created_at, updated_at
      FROM assistant_chats
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset) as Record<string, unknown>[];

    return rows.map(rowToListItem);
  }

  count(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM assistant_chats').get() as { count: number };
    return row.count;
  }

  findById(id: string): AssistantChat | null {
    const row = this.db.prepare(`
      SELECT id, title, messages_json, last_result_json, created_at, updated_at
      FROM assistant_chats
      WHERE id = ?
    `).get(id) as Record<string, unknown> | undefined;

    return row ? rowToChat(row) : null;
  }

  delete(id: string): boolean {
    const result = this.db.prepare('DELETE FROM assistant_chats WHERE id = ?').run(id);
    return result.changes > 0;
  }
}

export const assistantChatRepository = new AssistantChatRepository();
