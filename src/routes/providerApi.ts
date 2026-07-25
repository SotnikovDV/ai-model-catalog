import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { providerRepository, toProviderPublic } from '../models/providerRepository.js';
import { ProviderSchema, ProviderUpdateSchema } from '../types/provider.js';
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
  const providers = providerRepository.findAll().map(toProviderPublic);
  res.json({ data: providers });
});

router.get('/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const provider = providerRepository.findById(id);
  if (!provider) {
    res.status(404).json({ error: 'Провайдер не найден' });
    return;
  }
  res.json({ data: toProviderPublic(provider) });
});

router.post('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const input = ProviderSchema.parse(req.body);
    const provider = providerRepository.create(input);
    res.status(201).json({ data: toProviderPublic(provider) });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.put('/:id', requireAdminAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  try {
    const input = ProviderUpdateSchema.parse(req.body);
    const provider = providerRepository.update(id, input);
    if (!provider) {
      res.status(404).json({ error: 'Провайдер не найден' });
      return;
    }
    res.json({ data: toProviderPublic(provider) });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.delete('/:id', requireAdminAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const modelCount = providerRepository.countModels(id);
  if (modelCount > 0) {
    res.status(409).json({
      error: `Нельзя удалить провайдера: к нему привязано ${modelCount} моделей`,
    });
    return;
  }
  const ok = providerRepository.delete(id);
  if (!ok) {
    res.status(404).json({ error: 'Провайдер не найден' });
    return;
  }
  res.status(204).send();
});

export default router;
