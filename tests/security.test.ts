import type { Express } from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

describe('GET /health', () => {
  let app: Express;

  beforeAll(async () => {
    const mod = await import('../src/app.js');
    app = mod.default;
  });

  it('возвращает статус ok и проверку БД', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.db).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
    expect(res.body.timestamp).toBeTruthy();
  });
});

describe('Admin auth', () => {
  let app: Express;
  const originalPassword = process.env.ADMIN_PASSWORD;
  const originalSessionSecret = process.env.SESSION_SECRET;

  beforeAll(async () => {
    vi.resetModules();
    process.env.ADMIN_USER = 'admin';
    process.env.ADMIN_PASSWORD = 'test-secret';
    process.env.SESSION_SECRET = 'test-session-secret';
    const mod = await import('../src/app.js');
    app = mod.default;
  });

  afterAll(() => {
    process.env.ADMIN_PASSWORD = originalPassword ?? '';
    process.env.SESSION_SECRET = originalSessionSecret ?? '';
    vi.resetModules();
  });

  async function loginCookie() {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test-secret' });

    expect(res.status).toBe(200);
    const setCookie = res.headers['set-cookie'];
    if (!setCookie) return '';
    return Array.isArray(setCookie) ? setCookie.map((c) => c.split(';')[0]).join('; ') : setCookie.split(';')[0];
  }

  it('GET /admin без сессии → redirect на /login', async () => {
    const res = await request(app).get('/admin');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login');
  });

  it('POST /api/auth/login с валидными данными → cookie и профиль', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test-secret' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ login: 'admin', roles: ['admin'] });
    expect(res.headers['set-cookie']?.[0]).toContain('aic_session=');
  });

  it('POST /api/auth/login с неверным паролем → 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'wrong' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Неверный логин или пароль');
  });

  it('GET /admin с сессией → 200', async () => {
    const cookie = await loginCookie();
    const res = await request(app).get('/admin').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Админ');
  });

  it('GET /admin с Basic Auth → 200', async () => {
    const res = await request(app).get('/admin').auth('admin', 'test-secret');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Админ');
  });

  it('DELETE /api/models без credentials → 401', async () => {
    const res = await request(app).delete('/api/models');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Требуется авторизация администратора');
  });

  it('DELETE /api/models с сессией → 200', async () => {
    const cookie = await loginCookie();
    const res = await request(app).delete('/api/models').set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('deleted');
  });

  it('DELETE /api/models с Basic Auth → 200', async () => {
    const res = await request(app).delete('/api/models').auth('admin', 'test-secret');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('deleted');
  });

  it('POST /api/models/import без credentials → 401', async () => {
    const res = await request(app).post('/api/models/import').send({ data: [] });

    expect(res.status).toBe(401);
  });

  it('PUT /api/ai/config без credentials → 401', async () => {
    const res = await request(app).put('/api/ai/config').send({ enabled: false });

    expect(res.status).toBe(401);
  });

  it('PUT /api/models/sync/config без credentials → 401', async () => {
    const res = await request(app).put('/api/models/sync/config').send({ usdToRubRate: 100 });

    expect(res.status).toBe(401);
  });

  it('POST /api/providers без credentials → 401', async () => {
    const res = await request(app).post('/api/providers').send({
      name: 'Test',
      slug: 'test',
      catalog_source: 'custom',
    });

    expect(res.status).toBe(401);
  });

  it('POST /api/models/:id/chat без credentials → 401', async () => {
    const res = await request(app)
      .post('/api/models/00000000-0000-0000-0000-000000000001/chat')
      .send({ messages: [{ role: 'user', content: 'ping' }] });

    expect(res.status).toBe(401);
  });

  it('POST /api/ai/recommend без credentials → 401', async () => {
    const res = await request(app)
      .post('/api/ai/recommend')
      .send({ query: 'Нужна модель для кода' });

    expect(res.status).toBe(401);
  });

  it('PUT /api/models/:id без credentials → 401', async () => {
    const res = await request(app)
      .put('/api/models/00000000-0000-0000-0000-000000000001')
      .send({ is_favorite: true });

    expect(res.status).toBe(401);
  });

  it('GET /models/new без credentials → redirect на /login', async () => {
    const res = await request(app).get('/models/new');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login');
  });

  it('GET /assistant без credentials → redirect на /login', async () => {
    const res = await request(app).get('/assistant');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login');
  });

  it('GET /compare/chat без credentials → redirect на /login', async () => {
    const res = await request(app).get('/compare/chat');

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login');
  });

  it('GET /api/bothub/balance без credentials → 401', async () => {
    const res = await request(app).get('/api/bothub/balance');

    expect(res.status).toBe(401);
  });

  it('GET /api/lists без credentials → 200', async () => {
    const res = await request(app).get('/api/lists');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('POST /api/lists без credentials → 401', async () => {
    const res = await request(app).post('/api/lists').send({
      name: 'Список без auth',
      description: '',
    });

    expect(res.status).toBe(401);
  });

  it('PUT /api/lists/:id без credentials → 401', async () => {
    const res = await request(app)
      .put('/api/lists/00000000-0000-0000-0000-000000000001')
      .send({ name: 'x' });

    expect(res.status).toBe(401);
  });

  it('DELETE /api/lists/:id без credentials → 401', async () => {
    const res = await request(app).delete('/api/lists/00000000-0000-0000-0000-000000000001');

    expect(res.status).toBe(401);
  });

  it('POST /api/lists/:id/items без credentials → 401', async () => {
    const res = await request(app)
      .post('/api/lists/00000000-0000-0000-0000-000000000001/items')
      .send({ items: [{ modelId: '00000000-0000-0000-0000-000000000001' }] });

    expect(res.status).toBe(401);
  });

  it('POST /api/lists с сессией → 201', async () => {
    const cookie = await loginCookie();
    const res = await request(app)
      .post('/api/lists')
      .set('Cookie', cookie)
      .send({
        name: `Security list ${Date.now()}`,
        description: 'auth smoke',
      });

    expect(res.status).toBe(201);
    expect(res.body.data?.id).toBeTruthy();

    const listId = res.body.data.id as string;
    await request(app).delete(`/api/lists/${listId}`).set('Cookie', cookie);
  });

  it('PUT /api/ai/config с metadata URL → 400', async () => {
    const cookie = await loginCookie();
    const res = await request(app)
      .put('/api/ai/config')
      .set('Cookie', cookie)
      .send({ baseUrl: 'http://169.254.169.254/latest/meta-data/' });

    expect(res.status).toBe(400);
  });

  it('POST /api/auth/logout очищает сессию', async () => {
    const cookie = await loginCookie();
    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);

    expect(res.status).toBe(204);
    expect(res.headers['set-cookie']?.[0]).toContain('Max-Age=0');
  });
});

describe('Rate limiting', () => {
  let app: Express;

  beforeAll(async () => {
    vi.resetModules();
    process.env.ADMIN_PASSWORD = '';
    process.env.AI_RATE_LIMIT_MAX = '2';
    process.env.SYNC_RATE_LIMIT_MAX = '2';
    const mod = await import('../src/app.js');
    app = mod.default;
  });

  afterAll(() => {
    vi.resetModules();
  });

  it('возвращает 429 при превышении лимита на /api/ai/config', async () => {
    await request(app).get('/api/ai/config');
    await request(app).get('/api/ai/config');
    const res = await request(app).get('/api/ai/config');

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Слишком много запросов. Повторите позже.');
  });
});
