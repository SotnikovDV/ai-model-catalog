import { Router, type Request, type Response } from 'express';
import { getDb } from '../db/db.js';

const router = Router();

function checkDatabase(): 'ok' | 'error' {
  try {
    getDb().prepare('SELECT 1 AS ok').get();
    return 'ok';
  } catch {
    return 'error';
  }
}

router.get('/', (_req: Request, res: Response) => {
  const db = checkDatabase();
  const body = {
    status: db === 'ok' ? 'ok' : 'degraded',
    uptime: process.uptime(),
    db,
    timestamp: new Date().toISOString(),
  };

  res.status(db === 'ok' ? 200 : 503).json(body);
});

export default router;
