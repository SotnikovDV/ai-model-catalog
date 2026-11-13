import { Router, type Request, type Response } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth.js';
import {
  BothubAccountError,
  getBothubBalance,
  isBothubAccountConfigured,
} from '../services/bothubAccountService.js';

const router = Router();

router.get('/balance', requireAdminAuth, async (_req: Request, res: Response) => {
  if (!isBothubAccountConfigured()) {
    res.status(503).json({
      error: 'Учётные данные BOTHUB не заданы (BOTHUB_EMAIL / BOTHUB_PASSWORD или BOTHUB_ACCESS_TOKEN)',
    });
    return;
  }

  try {
    const balance = await getBothubBalance();
    res.json({ balance });
  } catch (err) {
    if (err instanceof BothubAccountError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(503).json({ error: 'Не удалось получить баланс BOTHUB' });
  }
});

export default router;
