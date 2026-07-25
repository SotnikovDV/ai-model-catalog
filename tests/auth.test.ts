import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('Auth API', () => {
  let app: Express;
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeAll(async () => {
    vi.resetModules();
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASSWORD = 'test-secret';
    process.env.SESSION_SECRET = 'auth-api-test-secret';
    const mod = await import('../src/app.js');
    app = mod.default;
  });

  afterAll(() => {
    process.env.ADMIN_PASSWORD = originalPassword ?? '';
    vi.resetModules();
  });

  it('GET /api/auth/status сообщает что auth включён', async () => {
    const res = await request(app).get('/api/auth/status');
    expect(res.status).toBe(200);
    expect(res.body.data.enabled).toBe(true);
  });

  it('GET /login доступен', async () => {
    const res = await request(app).get('/login');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Вход в панель администратора');
  });
});
