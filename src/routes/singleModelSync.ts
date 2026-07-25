import type { Request, Response } from 'express';
import { z } from 'zod';
import { modelRepository } from '../models/modelRepository.js';
import { SYNCABLE_FIELDS, type SyncableField, type SyncOptions } from '../types/sync.js';
import { enrichSingleModel } from '../services/modelEnrichmentService.js';
import { writeSingleSyncLog } from '../services/syncLogService.js';

const SingleSyncSchema = z.object({
  fields: z.array(z.string()).min(1),
  onlyEmpty: z.boolean().optional(),
  dryRun: z.boolean().optional(),
});

function parseFields(raw: string[]): SyncableField[] {
  const allowed = new Set(SYNCABLE_FIELDS as readonly string[]);
  return raw.filter((f): f is SyncableField => allowed.has(f));
}

export async function handleSingleModelSync(req: Request, res: Response): Promise<void> {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let model = null as ReturnType<typeof modelRepository.findById>;
  let options: SyncOptions | null = null;

  try {
    const body = SingleSyncSchema.parse(req.body);
    const fields = parseFields(body.fields);
    if (fields.length === 0) {
      res.status(400).json({ error: 'Не выбрано ни одного допустимого поля' });
      return;
    }

    model = modelRepository.findById(id);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }

    options = {
      mode: 'update',
      fields,
      onlyEmpty: body.onlyEmpty,
      dryRun: body.dryRun,
    };

    const result = await enrichSingleModel(model, options);
    const finishedAt = new Date().toISOString();
    const log = writeSingleSyncLog({
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      options,
      modelId: model.id,
      modelName: model.name,
      result,
      failed: result.status === 'error',
      errorMessage: result.status === 'error' ? result.message : undefined,
    });

    res.json({ data: result, logId: log.id });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : 'Ошибка синхронизации';
    const log = writeSingleSyncLog({
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      options: options ?? { fields: [], mode: 'update' },
      modelId: model?.id ?? id,
      modelName: model?.name ?? id,
      failed: true,
      errorMessage,
    });

    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Некорректные параметры', issues: error.issues, logId: log.id });
      return;
    }
    res.status(500).json({
      error: errorMessage,
      logId: log.id,
    });
  }
}
