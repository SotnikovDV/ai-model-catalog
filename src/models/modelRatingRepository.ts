import { randomUUID } from 'node:crypto';
import { getDb } from '../db/db.js';
import { AUTO_BENCHMARK_RESPONSE_ID } from '../types/autoEval.js';
import type { ModelChatRating, ModelChatRatingUpsertInput } from '../types/modelRating.js';

function rowToRating(row: Record<string, unknown>): ModelChatRating {
  return {
    id: row.id as string,
    modelId: row.model_id as string,
    responseId: row.response_id as string,
    responseContent: row.response_content as string,
    score: row.score as number,
    comment: row.comment as string,
    ratedAt: row.rated_at as string,
  };
}

export class ModelRatingRepository {
  private db = getDb();

  upsert(modelId: string, input: ModelChatRatingUpsertInput): ModelChatRating {
    const now = new Date().toISOString();
    const existing = this.db.prepare(`
      SELECT id FROM model_chat_ratings
      WHERE model_id = ? AND response_id = ?
    `).get(modelId, input.responseId) as { id: string } | undefined;

    if (existing) {
      this.db.prepare(`
        UPDATE model_chat_ratings
        SET response_content = ?, score = ?, comment = ?, rated_at = ?
        WHERE id = ?
      `).run(
        input.responseContent,
        input.score,
        input.comment ?? '',
        now,
        existing.id,
      );

      const updated = this.findById(existing.id);
      if (!updated) {
        throw new Error('Не удалось обновить оценку ответа');
      }
      return updated;
    }

    const id = randomUUID();
    this.db.prepare(`
      INSERT INTO model_chat_ratings (
        id, model_id, response_id, response_content, score, comment, rated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      modelId,
      input.responseId,
      input.responseContent,
      input.score,
      input.comment ?? '',
      now,
    );

    const created = this.findById(id);
    if (!created) {
      throw new Error('Не удалось сохранить оценку ответа');
    }
    return created;
  }

  findById(id: string): ModelChatRating | null {
    const row = this.db.prepare('SELECT * FROM model_chat_ratings WHERE id = ?').get(id);
    return row ? rowToRating(row as Record<string, unknown>) : null;
  }

  findByModelId(modelId: string): ModelChatRating[] {
    const rows = this.db.prepare(`
      SELECT * FROM model_chat_ratings
      WHERE model_id = ?
      ORDER BY rated_at DESC
    `).all(modelId) as Record<string, unknown>[];
    return rows.map(rowToRating);
  }

  getAverageScore(modelId: string): number | null {
    const row = this.db.prepare(`
      SELECT AVG(score) AS avg_score
      FROM model_chat_ratings
      WHERE model_id = ?
    `).get(modelId) as { avg_score: number | null } | undefined;
    if (row?.avg_score == null) return null;
    return Math.round(row.avg_score * 10) / 10;
  }

  findByModelIdAndResponseId(modelId: string, responseId: string): ModelChatRating | null {
    const row = this.db.prepare(`
      SELECT * FROM model_chat_ratings
      WHERE model_id = ? AND response_id = ?
    `).get(modelId, responseId);
    return row ? rowToRating(row as Record<string, unknown>) : null;
  }

  findAutoBenchmarkRating(modelId: string): ModelChatRating | null {
    return this.findByModelIdAndResponseId(modelId, AUTO_BENCHMARK_RESPONSE_ID);
  }

  getAutoBenchmarkRatedAt(modelId: string): string | null {
    return this.findAutoBenchmarkRating(modelId)?.ratedAt ?? null;
  }

  listModelIdsWithoutAutoBenchmark(): string[] {
    const rows = this.db.prepare(`
      SELECT m.id
      FROM models m
      LEFT JOIN model_chat_ratings r
        ON r.model_id = m.id AND r.response_id = ?
      WHERE r.id IS NULL
    `).all(AUTO_BENCHMARK_RESPONSE_ID) as { id: string }[];
    return rows.map((row) => row.id);
  }

  getAutoBenchmarkRatedAtMap(): Map<string, string> {
    const rows = this.db.prepare(`
      SELECT model_id, rated_at
      FROM model_chat_ratings
      WHERE response_id = ?
    `).all(AUTO_BENCHMARK_RESPONSE_ID) as { model_id: string; rated_at: string }[];

    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.model_id, row.rated_at);
    }
    return map;
  }

  getAverageScoresMap(): Map<string, { avg: number; count: number }> {
    const rows = this.db.prepare(`
      SELECT model_id, AVG(score) AS avg_score, COUNT(*) AS rating_count
      FROM model_chat_ratings
      GROUP BY model_id
    `).all() as { model_id: string; avg_score: number; rating_count: number }[];

    const map = new Map<string, { avg: number; count: number }>();
    for (const row of rows) {
      map.set(row.model_id, {
        avg: Math.round(row.avg_score * 10) / 10,
        count: row.rating_count,
      });
    }
    return map;
  }
}

export const modelRatingRepository = new ModelRatingRepository();
