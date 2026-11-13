import type { Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

describe('GET /api/bothub/balance', () => {
  let app: Express;
  const originalEmail = process.env.BOTHUB_EMAIL;
  const originalPassword = process.env.BOTHUB_PASSWORD;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;
  const originalSessionSecret = process.env.SESSION_SECRET;
  const fetchMock = vi.fn();

  beforeAll(async () => {
    vi.resetModules();
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASSWORD = 'test-secret';
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.BOTHUB_EMAIL = 'bothub@example.com';
    process.env.BOTHUB_PASSWORD = 'bothub-secret';
    process.env.BOTHUB_ACCESS_TOKEN = '';
    process.env.AI_API_KEY = '';
    process.env.AI_BASE_URL = 'https://api.openai.com/v1';
    vi.stubGlobal('fetch', fetchMock);
    const mod = await import('../src/app.js');
    app = mod.default;
  });

  afterAll(() => {
    process.env.BOTHUB_EMAIL = originalEmail ?? '';
    process.env.BOTHUB_PASSWORD = originalPassword ?? '';
    process.env.ADMIN_PASSWORD = originalAdminPassword ?? '';
    process.env.SESSION_SECRET = originalSessionSecret ?? '';
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  beforeEach(async () => {
    fetchMock.mockReset();
    const { resetBothubAccountCache } = await import('../src/services/bothubAccountService.js');
    resetBothubAccountCache();
  });

  afterEach(() => {
    fetchMock.mockReset();
  });

  async function loginCookie() {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test-secret' });
    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) return '';
    return Array.isArray(setCookie)
      ? setCookie.map((c) => c.split(';')[0]).join('; ')
      : setCookie.split(';')[0];
  }

  it('без сессии → 401', async () => {
    const res = await request(app).get('/api/bothub/balance');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Требуется авторизация администратора');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('с сессией возвращает баланс и не отдаёт секреты', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            accessToken: 'access-token',
            refreshToken: 'refresh-token',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            email: 'bothub@example.com',
            subscription: { balance: 1234.5 },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

    const cookie = await loginCookie();
    const res = await request(app).get('/api/bothub/balance').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ balance: 1234.5 });
    expect(JSON.stringify(res.body)).not.toContain('bothub-secret');
    expect(JSON.stringify(res.body)).not.toContain('access-token');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('повторный запрос использует кеш баланса', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ accessToken: 'access-token', refreshToken: 'refresh-token' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ subscription: { balance: 42 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const cookie = await loginCookie();
    const first = await request(app).get('/api/bothub/balance').set('Cookie', cookie);
    const second = await request(app).get('/api/bothub/balance').set('Cookie', cookie);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ balance: 42 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('GET /api/bothub/balance без credentials BOTHUB', () => {
  let app: Express;
  const originalEmail = process.env.BOTHUB_EMAIL;
  const originalPassword = process.env.BOTHUB_PASSWORD;
  const originalToken = process.env.BOTHUB_ACCESS_TOKEN;
  const originalAiKey = process.env.AI_API_KEY;
  const originalAiUrl = process.env.AI_BASE_URL;
  const originalAdminPassword = process.env.ADMIN_PASSWORD;

  beforeAll(async () => {
    vi.resetModules();
    process.env.ADMIN_PASSWORD = '';
    process.env.BOTHUB_EMAIL = '';
    process.env.BOTHUB_PASSWORD = '';
    process.env.BOTHUB_ACCESS_TOKEN = '';
    process.env.AI_API_KEY = '';
    process.env.AI_BASE_URL = 'https://api.openai.com/v1';
    const mod = await import('../src/app.js');
    app = mod.default;
  });

  afterAll(() => {
    process.env.BOTHUB_EMAIL = originalEmail ?? '';
    process.env.BOTHUB_PASSWORD = originalPassword ?? '';
    process.env.BOTHUB_ACCESS_TOKEN = originalToken ?? '';
    process.env.AI_API_KEY = originalAiKey ?? '';
    process.env.AI_BASE_URL = originalAiUrl ?? '';
    process.env.ADMIN_PASSWORD = originalAdminPassword ?? '';
    vi.resetModules();
  });

  it('возвращает 503 без утечки пароля', async () => {
    const res = await request(app).get('/api/bothub/balance');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/BOTHUB/);
    expect(JSON.stringify(res.body)).not.toContain('bothub-secret');
    expect(res.body).not.toHaveProperty('password');
  });
});
