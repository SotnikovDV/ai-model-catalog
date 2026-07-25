import type { Request } from 'express';
import { getAuthenticatedAdmin, isAdminAuthEnabled } from '../middleware/adminAuth.js';

export function getViewAuth(req: Request) {
  const adminAuthEnabled = isAdminAuthEnabled();
  const isAdminAuthenticated = !adminAuthEnabled || Boolean(getAuthenticatedAdmin(req));
  return { adminAuthEnabled, isAdminAuthenticated };
}

export function resolveProtectedHref(req: Request, targetPath: string): string {
  const { adminAuthEnabled, isAdminAuthenticated } = getViewAuth(req);
  if (!adminAuthEnabled || isAdminAuthenticated) return targetPath;
  return `/login?next=${encodeURIComponent(targetPath)}`;
}
