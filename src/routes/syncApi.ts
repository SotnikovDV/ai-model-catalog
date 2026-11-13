import { Router, type Request, type Response } from 'express';
import { ZodError, z } from 'zod';
import {
  SYNC_FIELD_GROUP_META,
  SYNCABLE_FIELDS,
  SyncRequestSchema,
  type SyncableField,
  type SyncOptions,
  type SyncRequestInput,
} from '../types/sync.js';
import { runSync, isSyncInProgress } from '../services/modelEnrichmentService.js';
import { getSyncFieldMetaForApi } from '../utils/fieldMeta.js';
import { syncLogRepository } from '../models/syncLogRepository.js';
import { writeBatchSyncLog } from '../services/syncLogService.js';
import { getSyncConfigPublic, updateSyncConfig } from '../services/syncConfig.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { syncRateLimit } from '../middleware/rateLimit.js';

const SyncConfigInputSchema = z.object({
  usdToRubRate: z.number().positive('Курс должен быть положительным числом'),
});

const router = Router();

router.get('/config', (_req: Request, res: Response) => {
  res.json({ data: getSyncConfigPublic() });
});

router.put('/config', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const input = SyncConfigInputSchema.parse(req.body);
    const data = updateSyncConfig(input.usdToRubRate);
    res.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Ошибка валидации',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    throw error;
  }
});

router.use(requireAdminAuth);
router.use(syncRateLimit);

function parseFields(raw: string[]): SyncableField[] {
  const allowed = new Set(SYNCABLE_FIELDS as readonly string[]);
  return raw.filter((f): f is SyncableField => allowed.has(f));
}

function buildSyncOptions(body: SyncRequestInput, fields: SyncableField[]): SyncOptions {
  return {
    mode: body.mode,
    fields,
    onlyEmpty: body.onlyEmpty,
    dryRun: body.dryRun,
    provider: body.filter === 'provider' ? body.provider : body.provider,
    family: body.family || undefined,
    staleness: body.staleness,
    filter: body.filter ?? 'all',
  };
}

function writeSse(res: Response, event: string, data: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function createRequestAbortSignal(res: Response): AbortSignal {
  const controller = new AbortController();
  const onClose = () => {
    if (!res.writableEnded) controller.abort();
  };
  res.on('close', onClose);
  res.on('finish', () => {
    res.off('close', onClose);
  });
  return controller.signal;
}

router.get('/fields', (_req: Request, res: Response) => {
  res.json({
    data: {
      groups: SYNC_FIELD_GROUP_META,
      fields: SYNCABLE_FIELDS,
      fieldMeta: getSyncFieldMetaForApi(),
      aiGroupIds: ['ai_ratings', 'ai_editorial', 'benchmarks'],
    },
  });
});

router.get('/logs', (req: Request, res: Response) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const logs = syncLogRepository.findRecent(limit, offset);
  res.json({
    data: logs,
    meta: {
      total: syncLogRepository.count(),
      limit,
      offset,
    },
  });
});

router.get('/logs/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const log = syncLogRepository.findById(id);
  if (!log) {
    res.status(404).json({ error: 'Запись журнала не найдена' });
    return;
  }
  res.json({ data: log });
});

function syncBusyResponse(res: Response): boolean {
  if (!isSyncInProgress()) return false;
  res.status(409).json({ error: 'Синхронизация уже выполняется. Дождитесь завершения текущей операции.' });
  return true;
}

router.post('/stream', async (req: Request, res: Response) => {
  if (syncBusyResponse(res)) return;

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let options: SyncOptions | null = null;
  const signal = createRequestAbortSignal(res);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const body = SyncRequestSchema.parse(req.body);
    const fields = parseFields(body.fields);
    if (fields.length === 0) {
      writeSse(res, 'error', { error: 'Не выбрано ни одного допустимого поля' });
      res.end();
      return;
    }

    options = buildSyncOptions(body, fields);
    const result = await runSync(options, (progress) => {
      writeSse(res, 'progress', progress);
    }, signal);

    if (signal.aborted || res.writableEnded || res.destroyed) {
      return;
    }

    const finishedAt = new Date().toISOString();
    const log = writeBatchSyncLog({
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      options,
      result,
    });

    writeSse(res, 'done', { data: result, logId: log.id });
    res.end();
  } catch (error) {
    if (signal.aborted || res.writableEnded || res.destroyed) {
      return;
    }

    const finishedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : 'Ошибка синхронизации';
    const log = writeBatchSyncLog({
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      options: options ?? { fields: [] },
      failed: true,
      errorMessage,
    });

    if (error instanceof ZodError) {
      writeSse(res, 'error', { error: 'Некорректные параметры', issues: error.issues, logId: log.id });
      res.end();
      return;
    }

    writeSse(res, 'error', { error: errorMessage, logId: log.id });
    res.end();
  }
});

router.post('/', async (req: Request, res: Response) => {
  if (syncBusyResponse(res)) return;

  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  let options: SyncOptions | null = null;

  try {
    const body = SyncRequestSchema.parse(req.body);
    const fields = parseFields(body.fields);
    if (fields.length === 0) {
      res.status(400).json({ error: 'Не выбрано ни одного допустимого поля' });
      return;
    }

    options = buildSyncOptions(body, fields);

    const result = await runSync(options);
    const finishedAt = new Date().toISOString();
    const log = writeBatchSyncLog({
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      options,
      result,
    });

    res.json({ data: result, logId: log.id });
  } catch (error) {
    const finishedAt = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : 'Ошибка синхронизации';
    const isBusy = error instanceof Error && error.name === 'SyncAlreadyRunningError';
    const log = writeBatchSyncLog({
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedMs,
      options: options ?? { fields: [] },
      failed: true,
      errorMessage,
    });

    if (error instanceof ZodError) {
      res.status(400).json({ error: 'Некорректные параметры', issues: error.issues, logId: log.id });
      return;
    }
    res.status(isBusy ? 409 : 500).json({
      error: errorMessage,
      logId: log.id,
    });
  }
});

export default router;
