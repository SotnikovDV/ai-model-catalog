import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import {
  EvaluationRequestSchema,
  type EvaluationOptions,
  type EvaluationRequestInput,
} from '../types/autoEval.js';
import {
  isEvaluationInProgress,
  runEvaluationCheck,
} from '../services/modelAutoEvalService.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { evaluationRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.use(requireAdminAuth);
router.use(evaluationRateLimit);

function buildEvaluationOptions(body: EvaluationRequestInput): EvaluationOptions {
  return {
    filter: body.filter ?? 'all',
    provider: body.filter === 'provider' ? body.provider : body.provider,
    family: body.family || undefined,
    staleness: body.staleness,
    delayMs: body.delayMs,
    inferenceOnly: body.inferenceOnly,
  };
}

function writeSse(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function evaluationBusyResponse(res: Response): boolean {
  if (!isEvaluationInProgress()) return false;
  res.status(409).json({ error: 'Автооценка уже выполняется. Дождитесь завершения текущей операции.' });
  return true;
}

router.post('/stream', async (req: Request, res: Response) => {
  if (evaluationBusyResponse(res)) return;

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const body = EvaluationRequestSchema.parse(req.body);
    if (body.filter === 'provider' && !body.provider?.trim()) {
      writeSse(res, 'error', { error: 'Укажите провайдера для фильтра' });
      res.end();
      return;
    }

    const options = buildEvaluationOptions(body);
    const result = await runEvaluationCheck(options, (progress) => {
      writeSse(res, 'progress', progress);
    });

    writeSse(res, 'done', { data: result });
    res.end();
  } catch (error) {
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

    const errorMessage = error instanceof Error ? error.message : 'Ошибка автооценки';
    writeSse(res, 'error', { error: errorMessage });
    res.end();
  }
});

router.post('/', async (req: Request, res: Response) => {
  if (evaluationBusyResponse(res)) return;

  try {
    const body = EvaluationRequestSchema.parse(req.body);
    if (body.filter === 'provider' && !body.provider?.trim()) {
      res.status(400).json({ error: 'Укажите провайдера для фильтра' });
      return;
    }

    const options = buildEvaluationOptions(body);
    const result = await runEvaluationCheck(options);
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

    const errorMessage = error instanceof Error ? error.message : 'Ошибка автооценки';
    res.status(500).json({ error: errorMessage });
  }
});

export default router;
