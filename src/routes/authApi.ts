import { Router, type Request, type Response } from 'express';
import { z, ZodError } from 'zod';
import { authenticateCredentials, isAdminAuthEnabled } from '../auth/credentials.js';
import { clearSessionCookie, readSessionUser, setSessionCookie, toPublicUser } from '../auth/session.js';

const router = Router();

const LoginSchema = z.object({
  username: z.string().min(1, 'Укажите логин'),
  password: z.string().min(1, 'Укажите пароль'),
});

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

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    data: {
      enabled: isAdminAuthEnabled(),
    },
  });
});

router.get('/me', (req: Request, res: Response) => {
  if (!isAdminAuthEnabled()) {
    res.json({ data: { authenticated: false, enabled: false } });
    return;
  }

  const user = readSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }

  res.json({ data: { authenticated: true, enabled: true, user: toPublicUser(user) } });
});

router.post('/login', (req: Request, res: Response) => {
  if (!isAdminAuthEnabled()) {
    res.status(503).json({ error: 'Авторизация не настроена' });
    return;
  }

  try {
    const input = LoginSchema.parse(req.body);
    const user = authenticateCredentials(input.username, input.password);
    if (!user) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    setSessionCookie(res, user);
    res.json({ data: toPublicUser(user) });
  } catch (error) {
    sendValidationError(res, error);
  }
});

router.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.status(204).send();
});

export default router;
