import type { NextFunction, Request, Response } from 'express';
import { authenticateCredentials, isAdminAuthEnabled } from '../auth/credentials.js';
import { readSessionUser } from '../auth/session.js';
import type { AuthUser } from '../auth/types.js';

function parseBasicAuth(header: string | undefined): { login: string; password: string } | null {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const colonIndex = decoded.indexOf(':');
    if (colonIndex === -1) return null;
    return {
      login: decoded.slice(0, colonIndex),
      password: decoded.slice(colonIndex + 1),
    };
  } catch {
    return null;
  }
}

export { isAdminAuthEnabled };

function resolveAuthenticatedAdmin(req: Request): AuthUser | null {
  const sessionUser = readSessionUser(req);
  if (sessionUser?.roles.includes('admin')) {
    return sessionUser;
  }

  const basic = parseBasicAuth(req.headers.authorization);
  if (basic) {
    return authenticateCredentials(basic.login, basic.password);
  }

  return null;
}

function sendUnauthorizedApi(res: Response): void {
  res.status(401).json({ error: 'Требуется авторизация администратора' });
}

export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminAuthEnabled()) {
    next();
    return;
  }

  const user = resolveAuthenticatedAdmin(req);
  if (!user) {
    sendUnauthorizedApi(res);
    return;
  }

  req.authUser = user;
  next();
}

export function requireAdminPageAuth(req: Request, res: Response, next: NextFunction): void {
  if (!isAdminAuthEnabled()) {
    next();
    return;
  }

  const user = resolveAuthenticatedAdmin(req);
  if (!user) {
    const nextUrl = encodeURIComponent(req.originalUrl || '/admin');
    res.redirect(`/login?next=${nextUrl}`);
    return;
  }

  req.authUser = user;
  next();
}

export function getAuthenticatedAdmin(req: Request): AuthUser | null {
  if (!isAdminAuthEnabled()) return null;
  return resolveAuthenticatedAdmin(req);
}
