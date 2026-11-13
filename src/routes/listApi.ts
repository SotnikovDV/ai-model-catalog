import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import { modelListRepository } from '../models/modelListRepository.js';
import {
  ModelListCreateSchema,
  ModelListItemUpdateSchema,
  ModelListItemsAddSchema,
  ModelListUpdateSchema,
} from '../types/modelList.js';

const router = Router();

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

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
  res.json({ data: modelListRepository.findAllSummaries({ excludeHidden: true }) });
});

router.get('/:id', (req: Request, res: Response) => {
  const id = paramId(req.params.id);
  const list = modelListRepository.findDetailById(id, { excludeHidden: true });
  if (!list) {
    res.status(404).json({ error: 'Список не найден' });
    return;
  }
  res.json({ data: list });
});

router.post('/', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const input = ModelListCreateSchema.parse(req.body);
    const list = modelListRepository.create(input);
    res.status(201).json({ data: list });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.put('/:id', requireAdminAuth, (req: Request, res: Response) => {
  const id = paramId(req.params.id);
  try {
    const input = ModelListUpdateSchema.parse(req.body);
    const list = modelListRepository.update(id, input);
    if (!list) {
      res.status(404).json({ error: 'Список не найден' });
      return;
    }
    res.json({ data: list });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.delete('/:id', requireAdminAuth, (req: Request, res: Response) => {
  const id = paramId(req.params.id);
  const ok = modelListRepository.delete(id);
  if (!ok) {
    res.status(404).json({ error: 'Список не найден' });
    return;
  }
  res.status(204).send();
});

router.post('/:id/items', requireAdminAuth, (req: Request, res: Response) => {
  const id = paramId(req.params.id);
  try {
    const input = ModelListItemsAddSchema.parse(req.body);
    const result = modelListRepository.addItems(id, input);
    if (!result) {
      res.status(404).json({ error: 'Список не найден' });
      return;
    }
    res.status(201).json({ data: result });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.patch('/:id/items/:modelId', requireAdminAuth, (req: Request, res: Response) => {
  const id = paramId(req.params.id);
  const modelId = paramId(req.params.modelId);
  try {
    const input = ModelListItemUpdateSchema.parse(req.body);
    const item = modelListRepository.updateItemComment(id, modelId, input.comment);
    if (!item) {
      res.status(404).json({ error: 'Модель не найдена в списке' });
      return;
    }
    res.json({ data: item });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.delete('/:id/items/:modelId', requireAdminAuth, (req: Request, res: Response) => {
  const id = paramId(req.params.id);
  const modelId = paramId(req.params.modelId);
  if (!modelListRepository.findById(id)) {
    res.status(404).json({ error: 'Список не найден' });
    return;
  }
  const ok = modelListRepository.removeItem(id, modelId);
  if (!ok) {
    res.status(404).json({ error: 'Модель не найдена в списке' });
    return;
  }
  res.status(204).send();
});

export default router;
