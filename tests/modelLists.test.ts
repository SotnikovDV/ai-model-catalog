import type { Express } from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

let app: Express;
let sampleModelId = '';

beforeAll(async () => {
  const mod = await import('../src/app.js');
  app = mod.default;

  const modelsRes = await request(app).get('/api/models');
  sampleModelId = modelsRes.body.data?.[0]?.id || '';
});

describe('/api/lists', () => {
  it('создаёт список, добавляет модели и отдаёт публичное чтение', async () => {
    expect(sampleModelId).toBeTruthy();

    const createRes = await request(app).post('/api/lists').send({
      name: `Тестовый список ${Date.now()}`,
      description: 'Список для smoke-теста',
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.name).toContain('Тестовый список');
    const listId = createRes.body.data.id as string;
    expect(listId).toBeTruthy();

    const listRes = await request(app).get('/api/lists');
    expect(listRes.status).toBe(200);
    expect(listRes.body.data.some((item: { id: string }) => item.id === listId)).toBe(true);

    const addRes = await request(app).post(`/api/lists/${listId}/items`).send({
      items: [{ modelId: sampleModelId, comment: 'Подходит для теста' }],
    });
    expect(addRes.status).toBe(201);
    expect(addRes.body.data.added).toBe(1);
    expect(addRes.body.data.items).toHaveLength(1);
    expect(addRes.body.data.items[0].comment).toBe('Подходит для теста');
    expect(addRes.body.data.items[0].model?.id).toBe(sampleModelId);

    const skipRes = await request(app).post(`/api/lists/${listId}/items`).send({
      items: [{ modelId: sampleModelId, comment: 'дубликат' }],
    });
    expect(skipRes.status).toBe(201);
    expect(skipRes.body.data.added).toBe(0);
    expect(skipRes.body.data.skipped).toBe(1);

    const detailRes = await request(app).get(`/api/lists/${listId}`);
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.items).toHaveLength(1);
    expect(detailRes.body.data.description).toBe('Список для smoke-теста');

    const patchRes = await request(app)
      .patch(`/api/lists/${listId}/items/${sampleModelId}`)
      .send({ comment: 'Обновлённый комментарий' });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.comment).toBe('Обновлённый комментарий');

    const updateRes = await request(app).put(`/api/lists/${listId}`).send({
      name: 'Переименованный список',
      description: 'Новое описание',
    });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.name).toBe('Переименованный список');

    const removeRes = await request(app).delete(`/api/lists/${listId}/items/${sampleModelId}`);
    expect(removeRes.status).toBe(204);

    const emptyDetail = await request(app).get(`/api/lists/${listId}`);
    expect(emptyDetail.body.data.items).toHaveLength(0);

    const deleteRes = await request(app).delete(`/api/lists/${listId}`);
    expect(deleteRes.status).toBe(204);

    const missing = await request(app).get(`/api/lists/${listId}`);
    expect(missing.status).toBe(404);
  });

  it('возвращает 400 при пустом названии', async () => {
    const res = await request(app).post('/api/lists').send({
      name: '',
      description: 'x',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Ошибка валидации');
  });

  it('не отдаёт скрытые модели в публичном GET /api/lists/:id', async () => {
    expect(sampleModelId).toBeTruthy();

    const createRes = await request(app).post('/api/lists').send({
      name: `Hidden policy ${Date.now()}`,
      description: '',
    });
    expect(createRes.status).toBe(201);
    const listId = createRes.body.data.id as string;

    const addRes = await request(app).post(`/api/lists/${listId}/items`).send({
      items: [{ modelId: sampleModelId, comment: 'будет скрыта' }],
    });
    expect(addRes.status).toBe(201);

    const hideRes = await request(app)
      .put(`/api/models/${sampleModelId}`)
      .send({ is_hidden: true });
    expect(hideRes.status).toBe(200);

    try {
      const publicDetail = await request(app).get(`/api/lists/${listId}`);
      expect(publicDetail.status).toBe(200);
      expect(publicDetail.body.data.items).toHaveLength(0);

      const summaries = await request(app).get('/api/lists');
      const summary = summaries.body.data.find((item: { id: string }) => item.id === listId);
      expect(summary?.itemCount).toBe(0);
    } finally {
      await request(app).put(`/api/models/${sampleModelId}`).send({ is_hidden: false });
      await request(app).delete(`/api/lists/${listId}`);
    }
  });
});
