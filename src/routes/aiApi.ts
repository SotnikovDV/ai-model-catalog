import { Router, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { getAiConfigPublic, updateAiConfig, assertAiConfigured } from '../services/aiConfig.js';
import { chatCompletion, testAiConnection } from '../services/aiClient.js';
import { recommendModels } from '../services/modelRecommendationService.js';
import { generateModelOverview } from '../services/modelOverviewService.js';
import { assistantChatRepository, titleFromQuery } from '../models/assistantChatRepository.js';
import {
  AiChatRequestSchema,
  AiConfigInputSchema,
  AiModelTierSchema,
  ModelOverviewRequestSchema,
  RecommendationRequestSchema,
} from '../types/ai.js';
import {
  AssistantChatCreateSchema,
  AssistantChatUpdateSchema,
} from '../types/assistantChat.js';
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

function sendAiError(res: Response, error: unknown) {
  const message = error instanceof Error ? error.message : 'Неизвестная ошибка AI-провайдера';
  res.status(502).json({ error: message });
}

router.get('/config', (_req: Request, res: Response) => {
  res.json({ data: getAiConfigPublic() });
});

router.put('/config', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const input = AiConfigInputSchema.parse(req.body);
    const data = updateAiConfig(input);
    res.json({ data });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.post('/test', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const tier = req.body?.tier ? AiModelTierSchema.parse(req.body.tier) : 'simple';
    const result = await testAiConnection(tier);
    res.json({
      data: {
        ok: true,
        tier: result.tier,
        model: result.model,
        reply: result.content,
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendAiError(res, error);
  }
});

router.post('/chat', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const input = AiChatRequestSchema.parse(req.body);
    const result = await chatCompletion({
      messages: input.messages,
      tier: input.tier,
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
    });
    res.json({ data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendAiError(res, error);
  }
});

router.post('/model-overview', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const input = ModelOverviewRequestSchema.parse(req.body);
    const publicConfig = getAiConfigPublic();
    if (!publicConfig.enabled) {
      res.status(503).json({ error: 'AI-провайдер отключён. Включите его в админке.' });
      return;
    }
    if (!publicConfig.searchConfigured && !publicConfig.configured) {
      res.status(503).json({
        error: 'AI не настроен: задайте модель с поиском или аналитическую модель в админке / .env.',
      });
      return;
    }
    const data = await generateModelOverview(input);
    res.json({ data });
  } catch (error) {
    if (error instanceof ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendAiError(res, error);
  }
});

router.post('/recommend', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const input = RecommendationRequestSchema.parse(req.body);
    const publicConfig = getAiConfigPublic();
    if (!publicConfig.enabled || !publicConfig.configured) {
      res.status(503).json({ error: 'AI-провайдер не настроен или отключён. Настройте его в админке.' });
      return;
    }
    assertAiConfigured();
    const result = await recommendModels(input.query, input.limit, input.messages);
    res.json({ data: result });
  } catch (error) {
    if (error instanceof ZodError) {
      sendValidationError(res, error);
      return;
    }
    sendAiError(res, error);
  }
});

router.get('/chats', requireAdminAuth, (req: Request, res: Response) => {
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

  res.json({
    data: assistantChatRepository.findRecent(limit, offset),
    meta: { total: assistantChatRepository.count(), limit, offset },
  });
});

router.post('/chats', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const input = AssistantChatCreateSchema.parse(req.body ?? {});
    const firstUserMessage = input.messages.find((message) => message.role === 'user');
    const title = input.title?.trim()
      || (firstUserMessage ? titleFromQuery(firstUserMessage.content) : 'Новый чат');
    const data = assistantChatRepository.create({ ...input, title });
    res.status(201).json({ data });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.get('/chats/:id', requireAdminAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const chat = assistantChatRepository.findById(id);
  if (!chat) {
    res.status(404).json({ error: 'Чат не найден' });
    return;
  }
  res.json({ data: chat });
});

router.put('/chats/:id', requireAdminAuth, (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const input = AssistantChatUpdateSchema.parse(req.body ?? {});
    const existing = assistantChatRepository.findById(id);
    if (!existing) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }

    const firstUserMessage = (input.messages ?? existing.messages).find((message) => message.role === 'user');
    const title = input.title?.trim()
      || (existing.title === 'Новый чат' && firstUserMessage
        ? titleFromQuery(firstUserMessage.content)
        : existing.title);

    const data = assistantChatRepository.update(id, { ...input, title });
    if (!data) {
      res.status(404).json({ error: 'Чат не найден' });
      return;
    }
    res.json({ data });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.delete('/chats/:id', requireAdminAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const deleted = assistantChatRepository.delete(id);
  if (!deleted) {
    res.status(404).json({ error: 'Чат не найден' });
    return;
  }
  res.status(204).send();
});

export default router;
