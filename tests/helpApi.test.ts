import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: Express;

beforeAll(async () => {
  const mod = await import('../src/app.js');
  app = mod.default;
});

describe('GET /api/help', () => {
  it('возвращает список тем справки', async () => {
    const res = await request(app).get('/api/help');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    const contexts = res.body.data.map((item: { context: string }) => item.context);
    expect(contexts).toContain('assistant.recommend');
    expect(contexts).toContain('assistant.overview');
  });
});

describe('GET /api/help/:context', () => {
  it('возвращает статью по контексту подбора моделей', async () => {
    const res = await request(app).get('/api/help/assistant.recommend');

    expect(res.status).toBe(200);
    expect(res.body.data.context).toBe('assistant.recommend');
    expect(res.body.data.title).toBe('Подбор моделей');
    expect(String(res.body.data.markdown)).toContain('Подбор моделей');
  });

  it('возвращает статью по контексту описания модели', async () => {
    const res = await request(app).get('/api/help/assistant.overview');

    expect(res.status).toBe(200);
    expect(res.body.data.context).toBe('assistant.overview');
    expect(res.body.data.title).toBe('Описание модели');
    expect(String(res.body.data.markdown)).toContain('Описание модели');
  });

  it('отклоняет некорректный идентификатор', async () => {
    const res = await request(app).get('/api/help/Bad.Context');

    expect(res.status).toBe(400);
  });

  it('возвращает 404 для неизвестной темы', async () => {
    const res = await request(app).get('/api/help/unknown.topic');

    expect(res.status).toBe(404);
  });
});
