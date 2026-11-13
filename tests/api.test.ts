import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: Express;

beforeAll(async () => {
  const mod = await import('../src/app.js');
  app = mod.default;
});

describe('GET /api/models', () => {
  it('возвращает список моделей', async () => {
    const res = await request(app).get('/api/models');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('поддерживает фильтр по family', async () => {
    const res = await request(app).get('/api/models?family=OpenAI');

    expect(res.status).toBe(200);
    for (const model of res.body.data) {
      expect(model.family).toBe('OpenAI');
    }
  });
});

describe('GET /api/models/providers', () => {
  it('возвращает справочник providers', async () => {
    const res = await request(app).get('/api/models/providers');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toContain('BotHub');
  });
});

describe('GET /api/providers', () => {
  it('возвращает список провайдеров без api_key', async () => {
    const res = await request(app).get('/api/providers');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('slug');
    expect(res.body.data[0]).toHaveProperty('apiKeySet');
    expect(res.body.data[0]).not.toHaveProperty('api_key');
  });
});

describe('POST /api/models', () => {
  it('создаёт модель с валидным телом', async () => {
    const res = await request(app).post('/api/models').send({
      name: `Test Model ${Date.now()}`,
      provider: 'BotHub',
      family: 'OpenAI',
      description: 'Smoke test model',
    });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      provider: 'BotHub',
      family: 'OpenAI',
      description: 'Smoke test model',
    });
    expect(res.body.data.id).toBeTruthy();
  });

  it('возвращает 400 при невалидном теле', async () => {
    const res = await request(app).post('/api/models').send({
      name: '',
      provider: 'BotHub',
      family: 'OpenAI',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Ошибка валидации');
    expect(Array.isArray(res.body.issues)).toBe(true);
  });
});

describe('GET /api/models/:id', () => {
  it('возвращает 404 для несуществующей модели', async () => {
    const res = await request(app).get(
      '/api/models/00000000-0000-4000-8000-000000000000',
    );

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Model not found');
  });
});

describe('GET /api/ai/config', () => {
  it('возвращает публичный AI-конфиг', async () => {
    const res = await request(app).get('/api/ai/config');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('enabled');
    expect(res.body.data).toHaveProperty('configured');
    expect(res.body.data).not.toHaveProperty('apiKey');
  });
});

describe('/api/ai/chats', () => {
  it('создаёт, читает, обновляет и удаляет чат', async () => {
    const createRes = await request(app).post('/api/ai/chats').send({
      messages: [{ role: 'user', content: 'Нужна модель для кода' }],
      lastResult: null,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.title).toContain('кода');
    const chatId = createRes.body.data.id;
    expect(chatId).toBeTruthy();

    const listRes = await request(app).get('/api/ai/chats');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((item: { id: string }) => item.id === chatId)).toBe(true);

    const getRes = await request(app).get(`/api/ai/chats/${chatId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.messages).toHaveLength(1);

    const updateRes = await request(app).put(`/api/ai/chats/${chatId}`).send({
      messages: [
        { role: 'user', content: 'Нужна модель для кода' },
        { role: 'assistant', content: 'Подобрано 3 модели.' },
      ],
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.messages).toHaveLength(2);

    const deleteRes = await request(app).delete(`/api/ai/chats/${chatId}`);
    expect(deleteRes.status).toBe(204);

    const missingRes = await request(app).get(`/api/ai/chats/${chatId}`);
    expect(missingRes.status).toBe(404);
  });
});

describe('GET /api/models/sync/config', () => {
  it('возвращает курс USD→RUB', async () => {
    const res = await request(app).get('/api/models/sync/config');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('usdToRubRate');
    expect(res.body.data.usdToRubRate).toBeGreaterThan(0);
  });
});

describe('POST /api/models/:id/chat', () => {
  it('возвращает 404 для несуществующей модели', async () => {
    const res = await request(app).post('/api/models/00000000-0000-4000-8000-000000000000/chat').send({
      messages: [{ role: 'user', content: 'Привет' }],
    });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Model not found');
  });

  it('возвращает 502 без API-ключа провайдера', async () => {
    const listRes = await request(app).get('/api/models');
    const model = listRes.body.data[0];
    expect(model?.id).toBeTruthy();

    const res = await request(app).post(`/api/models/${model.id}/chat`).send({
      messages: [{ role: 'user', content: 'Привет' }],
    });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/API-ключ провайдера/i);
  });
});

describe('GET /compare/chat', () => {
  it('показывает пустое состояние без ids', async () => {
    const res = await request(app).get('/compare/chat');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Чат-сравнение');
    expect(res.text).toContain('Модели для сравнения не выбраны');
  });

  it('рендерит выбранные модели', async () => {
    const listRes = await request(app).get('/api/models');
    const models = listRes.body.data.slice(0, 2);
    expect(models.length).toBeGreaterThan(0);

    const ids = models.map((model: { id: string }) => model.id).join(',');
    const res = await request(app).get(`/compare/chat?ids=${ids}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Чат-сравнение');
    expect(res.text).toContain(models[0].name);
    expect(res.text).toContain('Отправить всем');
  });

  it('на странице сравнения есть переход в чат-сравнение', async () => {
    const listRes = await request(app).get('/api/models');
    const model = listRes.body.data[0];
    expect(model?.id).toBeTruthy();

    const res = await request(app).get(`/compare?ids=${model.id}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Чат-сравнение');
    expect(res.text).toContain(`/compare/chat?ids=${model.id}`);
  });

  it('ограничивает чат-сравнение восемью моделями', async () => {
    const listRes = await request(app).get('/api/models');
    const models = listRes.body.data as Array<{ id: string }>;
    expect(models.length).toBeGreaterThan(0);

    const filler = [
      '00000000-0000-4000-8000-0000000000a1',
      '00000000-0000-4000-8000-0000000000a2',
    ];
    const ids = [...models.map((model) => model.id), ...filler].slice(0, 9).join(',');
    const res = await request(app).get(`/compare/chat?ids=${ids}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Показаны первые 8 моделей');
    expect(res.text).not.toContain('data-model-id="00000000-0000-4000-8000-0000000000a2"');
  });
});
