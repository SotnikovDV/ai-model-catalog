import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { AuthUser, SessionPayload } from './types.js';

export const SESSION_COOKIE_NAME = 'aic_session';
const DEFAULT_MAX_AGE_SEC = 7 * 24 * 60 * 60;

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim() || process.env.ADMIN_PASSWORD?.trim();
  if (!secret) {
    throw new Error('SESSION_SECRET or ADMIN_PASSWORD required for sessions');
  }
  return secret;
}

function getSessionMaxAgeSec(): number {
  const raw = process.env.SESSION_MAX_AGE_SEC?.trim();
  if (!raw) return DEFAULT_MAX_AGE_SEC;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_AGE_SEC;
}

function signPayload(encodedPayload: string): string {
  const signature = createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

function verifySignedToken(token: string): string | null {
  const dotIndex = token.lastIndexOf('.');
  if (dotIndex <= 0) return null;

  const encodedPayload = token.slice(0, dotIndex);
  const signature = token.slice(dotIndex + 1);
  const expected = createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  return encodedPayload;
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};

  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex);
    const value = trimmed.slice(eqIndex + 1);
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function serializeCookie(name: string, value: string, maxAgeSec: number): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  if (process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function createSessionToken(user: AuthUser): string {
  const payload: SessionPayload = {
    login: user.login,
    roles: user.roles,
    exp: Date.now() + getSessionMaxAgeSec() * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return signPayload(encoded);
}

export function readSessionUser(req: Request): AuthUser | null {
  try {
    const token = parseCookies(req)[SESSION_COOKIE_NAME];
    if (!token) return null;

    const encodedPayload = verifySignedToken(token);
    if (!encodedPayload) return null;

    const payload = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as SessionPayload;

    if (!payload.login || !Array.isArray(payload.roles) || payload.exp <= Date.now()) {
      return null;
    }

    return { login: payload.login, roles: payload.roles };
  } catch {
    return null;
  }
}

export function setSessionCookie(res: Response, user: AuthUser): void {
  const token = createSessionToken(user);
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, token, getSessionMaxAgeSec()));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader('Set-Cookie', serializeCookie(SESSION_COOKIE_NAME, '', 0));
}

export function toPublicUser(user: AuthUser) {
  return {
    login: user.login,
    roles: user.roles,
  };
}
