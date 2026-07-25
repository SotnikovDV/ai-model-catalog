import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { modelRepository } from '../models/modelRepository.js';
import { modelRatingRepository } from '../models/modelRatingRepository.js';
import { providerRepository } from '../models/providerRepository.js';
import { ModelSchema, type AvailabilityStatus, type ModelFilter } from '../types.js';
import { inferFamily } from '../utils/inferFamily.js';
import syncRoutes from './syncApi.js';
import availabilityRoutes from './availabilityApi.js';
import evaluationRoutes from './evaluationApi.js';
import { handleSingleModelSync } from './singleModelSync.js';
import { handleSingleModelAvailability } from './singleModelAvailability.js';
import { handleSingleModelEvaluation } from './singleModelEvaluation.js';
import { resolveHuggingFaceUrl } from '../services/huggingFaceResolver.js';
import { chatCompletionWithConnection } from '../services/aiClient.js';
import { resolveModelProviderConnection, ProviderConnectionError } from '../services/providerConnection.js';
import { ModelChatRequestSchema } from '../types/ai.js';
import { ModelChatRatingUpsertSchema } from '../types/modelRating.js';
import { requireAdminAuth } from '../middleware/adminAuth.js';

const router = Router();

function sendValidationError(res: Response, error: unknown) {
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

router.get('/', (_req: Request, res: Response) => {
  const query = _req.query;
  const rawAvailability = query.availability_status as string | undefined;
  const availabilityStatus = rawAvailability === 'unchecked'
    ? 'unchecked' as const
    : (['available', 'inference', 'unavailable'].includes(rawAvailability ?? '')
      ? rawAvailability as AvailabilityStatus
      : undefined);
  const filter = {
    provider: query.provider as string | undefined,
    family: query.family as string | undefined,
    modality: query.modality as string | undefined,
    supports_vision: query.supports_vision === '1' ? true : undefined,
    supports_function_calling: query.supports_function_calling === '1' ? true : undefined,
    supports_json_mode: query.supports_json_mode === '1' ? true : undefined,
    supports_streaming: query.supports_streaming === '1' ? true : undefined,
    supports_web_search: query.supports_web_search === '1' ? true : undefined,
    min_context: query.min_context ? Number(query.min_context) : undefined,
    max_context: query.max_context ? Number(query.max_context) : undefined,
    search: query.search as string | undefined,
    sort: query.sort as ModelFilter['sort'],
    order: query.order as ModelFilter['order'],
    exclude_hidden: query.exclude_hidden === '1' ? true : undefined,
    availability_status: availabilityStatus,
  };
  const models = modelRepository.findAll(filter);
  res.json({ data: models });
});

router.get('/providers', (_req: Request, res: Response) => {
  res.json({ data: providerRepository.getProviderNames() });
});

router.get('/families', (_req: Request, res: Response) => {
  res.json({ data: modelRepository.getFamilies() });
});

router.get('/modalities', (_req: Request, res: Response) => {
  res.json({ data: modelRepository.getModalities() });
});

router.get('/export', (_req: Request, res: Response) => {
  const models = modelRepository.findAll();
  res.setHeader('Content-Disposition', 'attachment; filename="models.json"');
  res.json({ data: models });
});

router.delete('/', requireAdminAuth, (_req: Request, res: Response) => {
  const deleted = modelRepository.clearAll();
  res.json({ data: { deleted } });
});

router.post('/import', requireAdminAuth, (req: Request, res: Response) => {
  const { data } = req.body;
  if (!Array.isArray(data)) {
    res.status(400).json({ error: 'Expected body.data to be an array of models' });
    return;
  }
  const results = [];
  for (const item of data) {
    const enriched = {
      ...item,
      provider: item.provider ?? 'BotHub',
      family: item.family || inferFamily(item.name ?? ''),
    };
    const parsed = ModelSchema.parse(enriched);
    const model = modelRepository.upsert(parsed);
    results.push(model);
  }
  res.json({ data: results, meta: { imported: results.length, total: modelRepository.count() } });
});

router.post('/compare', (req: Request, res: Response) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'Expected body.ids as non-empty array' });
    return;
  }
  const models = modelRepository.findByIds(ids);
  res.json({ data: models });
});

router.use('/sync', syncRoutes);
router.use('/availability', availabilityRoutes);
router.use('/evaluation', evaluationRoutes);

router.post('/:id/sync', requireAdminAuth, handleSingleModelSync);
router.post('/:id/availability', requireAdminAuth, handleSingleModelAvailability);
router.post('/:id/evaluate', requireAdminAuth, handleSingleModelEvaluation);

router.post('/:id/chat', requireAdminAuth, async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = modelRepository.findById(id);
  if (!model) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }

  try {
    const input = ModelChatRequestSchema.parse(req.body);
    const connection = resolveModelProviderConnection(model);
    const result = await chatCompletionWithConnection(connection, {
      messages: input.messages,
      model: model.name,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      includeReasoning: input.includeReasoning,
    });
    res.json({ data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      sendValidationError(res, error);
      return;
    }
    if (error instanceof ProviderConnectionError) {
      res.status(502).json({ error: error.message });
      return;
    }
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка провайдера';
    res.status(502).json({ error: message });
  }
});

router.get('/:id/ratings', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = modelRepository.findById(id);
  if (!model) {
    res.status(404).json({ error: 'Модель не найдена' });
    return;
  }
  const ratings = modelRatingRepository.findByModelId(id);
  res.json({ data: ratings });
});

router.post('/:id/ratings', requireAdminAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = modelRepository.findById(id);
  if (!model) {
    res.status(404).json({ error: 'Модель не найдена' });
    return;
  }

  try {
    const input = ModelChatRatingUpsertSchema.parse(req.body);
    const rating = modelRatingRepository.upsert(id, input);
    res.json({ data: rating });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.get('/:id/huggingface', async (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = modelRepository.findById(id);
  if (!model) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }

  try {
    const result = await resolveHuggingFaceUrl(model.name, model.family);
    res.json({ data: result });
  } catch {
    res.status(502).json({ error: 'Не удалось найти страницу на Hugging Face' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = modelRepository.findById(id);
  if (!model) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }
  res.json({ data: model });
});

router.post('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const parsed = ModelSchema.parse(req.body);
    const model = modelRepository.create(parsed);
    res.status(201).json({ data: model });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.put('/:id', requireAdminAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const parsed = ModelSchema.partial().parse(req.body);
    const model = modelRepository.update(id, parsed);
    if (!model) {
      res.status(404).json({ error: 'Model not found' });
      return;
    }
    res.json({ data: model });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.delete('/:id', requireAdminAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const ok = modelRepository.delete(id);
  if (!ok) {
    res.status(404).json({ error: 'Model not found' });
    return;
  }
  res.status(204).send();
});

export default router;
