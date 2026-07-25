import { timingSafeEqual } from 'node:crypto';
import type { AuthUser } from './types.js';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function getAdminCredentials(): { login: string; password: string } | null {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return null;
  return {
    login: process.env.ADMIN_USER?.trim() || 'admin',
    password,
  };
}

export function isAdminAuthEnabled(): boolean {
  return getAdminCredentials() !== null;
}

export function authenticateCredentials(login: string, password: string): AuthUser | null {
  const expected = getAdminCredentials();
  if (!expected) return null;

  if (!safeEqual(login, expected.login) || !safeEqual(password, expected.password)) {
    return null;
  }

  return { login: expected.login, roles: ['admin'] };
}
