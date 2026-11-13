import { describe, expect, it } from 'vitest';
import {
  AssistantChatCreateSchema,
  AssistantStoredMessageSchema,
} from '../src/types/assistantChat.js';
import { titleFromQuery } from '../src/models/assistantChatRepository.js';

describe('AssistantStoredMessageSchema', () => {
  it('принимает сообщение пользователя', () => {
    const result = AssistantStoredMessageSchema.parse({
      role: 'user',
      content: 'Нужна модель для RAG',
    });

    expect(result.role).toBe('user');
    expect(result.content).toContain('RAG');
  });

  it('принимает сообщение только с вложениями', () => {
    const result = AssistantStoredMessageSchema.parse({
      role: 'user',
      content: '',
      attachments: [{ name: 'notes.md', text: '# hello' }],
    });

    expect(result.attachments).toHaveLength(1);
    expect(result.attachments?.[0]?.name).toBe('notes.md');
  });

  it('отклоняет полностью пустое сообщение', () => {
    expect(() =>
      AssistantStoredMessageSchema.parse({
        role: 'user',
        content: '   ',
      }),
    ).toThrow();
  });
});

describe('AssistantChatCreateSchema', () => {
  it('подставляет пустой массив сообщений по умолчанию', () => {
    const result = AssistantChatCreateSchema.parse({});
    expect(result.messages).toEqual([]);
  });
});

describe('titleFromQuery', () => {
  it('обрезает длинный запрос', () => {
    const title = titleFromQuery('a'.repeat(80));
    expect(title.endsWith('…')).toBe(true);
    expect(title.length).toBeLessThanOrEqual(60);
  });

  it('возвращает fallback для пустой строки', () => {
    expect(titleFromQuery('   ')).toBe('Новый чат');
  });
});
