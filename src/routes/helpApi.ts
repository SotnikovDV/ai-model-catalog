import { Router, type Request, type Response } from 'express';
import {
  getHelpArticle,
  isValidHelpContext,
  listHelpTopics,
} from '../services/helpService.js';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    res.json({
      data: listHelpTopics().map(({ context, title, description, page }) => ({
        context,
        title,
        description,
        page,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось загрузить список справки';
    res.status(500).json({ error: message });
  }
});

router.get('/:context', (req: Request, res: Response) => {
  const raw = Array.isArray(req.params.context) ? req.params.context[0] : req.params.context;
  const context = String(raw || '').trim();

  if (!isValidHelpContext(context)) {
    res.status(400).json({ error: 'Некорректный идентификатор справки' });
    return;
  }

  try {
    const article = getHelpArticle(context);
    if (!article) {
      res.status(404).json({ error: 'Справка не найдена' });
      return;
    }
    res.json({ data: article });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Не удалось загрузить справку';
    res.status(500).json({ error: message });
  }
});

export default router;
