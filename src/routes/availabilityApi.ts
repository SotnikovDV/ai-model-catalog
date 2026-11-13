import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import {
  AvailabilityRequestSchema,
  type AvailabilityOptions,
  type AvailabilityRequestInput,
} from '../types/availability.js';
import {
  isAvailabilityCheckInProgress,
  runAvailabilityCheck,
} from '../services/modelAvailabilityService.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { availabilityRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.use(requireAdminAuth);
router.use(availabilityRateLimit);

function buildAvailabilityOptions(body: AvailabilityRequestInput): AvailabilityOptions {
  return {
    mode: body.mode,
    filter: body.filter ?? 'all',
    provider: body.filter === 'provider' ? body.provider : body.provider,
    family: body.family || undefined,
    staleness: body.staleness,
    delayMs: body.delayMs,
    catalogAvailability: body.catalogAvailability,
    inferenceFilter: body.inferenceFilter,
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

function availabilityBusyResponse(res: Response): boolean {
  if (!isAvailabilityCheckInProgress()) return false;
  res.status(409).json({ error: 'Проверка доступности уже выполняется. Дождитесь завершения текущей операции.' });
  return true;
}

router.post('/stream', async (req: Request, res: Response) => {
  if (availabilityBusyResponse(res)) return;

  const signal = createRequestAbortSignal(res);

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const body = AvailabilityRequestSchema.parse(req.body);
    if (body.filter === 'provider' && !body.provider?.trim()) {
      writeSse(res, 'error', { error: 'Укажите провайдера для фильтра' });
      res.end();
      return;
    }

    const options = buildAvailabilityOptions(body);
    const result = await runAvailabilityCheck(options, (progress) => {
      writeSse(res, 'progress', progress);
    }, signal);

    if (signal.aborted || res.writableEnded || res.destroyed) {
      return;
    }

    writeSse(res, 'done', { data: result });
    res.end();
  } catch (error) {
    if (signal.aborted || res.writableEnded || res.destroyed) {
      return;
    }

    if (error instanceof ZodError) {
      writeSse(res, 'error', {
        error: 'Некорректные параметры',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      res.end();
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Ошибка проверки доступности';
    writeSse(res, 'error', { error: errorMessage });
    res.end();
  }
});

router.post('/', async (req: Request, res: Response) => {
  if (availabilityBusyResponse(res)) return;

  try {
    const body = AvailabilityRequestSchema.parse(req.body);
    if (body.filter === 'provider' && !body.provider?.trim()) {
      res.status(400).json({ error: 'Укажите провайдера для фильтра' });
      return;
    }

    const options = buildAvailabilityOptions(body);
    const result = await runAvailabilityCheck(options);
    res.json({ data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Некорректные параметры',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }

    const errorMessage = error instanceof Error ? error.message : 'Ошибка проверки доступности';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
