import { describe, expect, it } from 'vitest';
import { ModelSchema } from '../src/types.js';
import { ProviderSchema } from '../src/types/provider.js';
import { SyncRequestSchema } from '../src/types/sync.js';

describe('ModelSchema', () => {
  it('принимает минимально валидную модель', () => {
    const result = ModelSchema.parse({
      name: 'GPT-4o',
      provider: 'BotHub',
      family: 'OpenAI',
    });

    expect(result.name).toBe('GPT-4o');
    expect(result.modality).toBe('text');
    expect(result.reasoning).toBe(3);
    expect(result.supports_vision).toBe(false);
  });

  it('отклоняет пустое имя', () => {
    expect(() =>
      ModelSchema.parse({
        name: '',
        provider: 'BotHub',
        family: 'OpenAI',
      }),
    ).toThrow();
  });

  it('нормализует JSON-поля из массивов', () => {
    const result = ModelSchema.parse({
      name: 'Claude',
      provider: 'BotHub',
      family: 'Anthropic',
      tags: ['chat', 'code'],
      use_cases: ['support'],
    });

    expect(result.tags).toEqual(['chat', 'code']);
    expect(result.use_cases).toEqual(['support']);
  });

  it('ограничивает рейтинги диапазоном 1–5', () => {
    expect(() =>
      ModelSchema.parse({
        name: 'Test',
        provider: 'BotHub',
        family: 'OpenAI',
        reasoning: 6,
      }),
    ).toThrow();
  });
});

describe('ProviderSchema', () => {
  it('требует корректный base_url или пустую строку', () => {
    expect(() =>
      ProviderSchema.parse({
        name: 'Bad',
        slug: 'bad',
        base_url: 'not-a-url',
      }),
    ).toThrow();
  });
});

describe('SyncRequestSchema', () => {
  it('принимает валидный запрос sync', () => {
    const result = SyncRequestSchema.parse({
      mode: 'update',
      fields: ['description', 'tags'],
      dryRun: true,
      filter: 'all',
    });

    expect(result.mode).toBe('update');
    expect(result.fields).toEqual(['description', 'tags']);
    expect(result.dryRun).toBe(true);
  });

  it('требует непустой массив fields', () => {
    expect(() =>
      SyncRequestSchema.parse({
        fields: [],
      }),
    ).toThrow();
  });

  it('отклоняет неизвестный mode', () => {
    expect(() =>
      SyncRequestSchema.parse({
        mode: 'invalid',
        fields: ['description'],
      }),
    ).toThrow();
  });

  it('принимает staleness-фильтр', () => {
    const result = SyncRequestSchema.parse({
      fields: ['family'],
      staleness: 'month',
    });

    expect(result.staleness).toBe('month');
  });
});
