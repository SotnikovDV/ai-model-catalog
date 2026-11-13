import { describe, expect, it } from 'vitest';
import { prepareRecommendationConversation } from '../src/services/modelRecommendationService.js';

describe('prepareRecommendationConversation', () => {
  it('без истории использует только текущий запрос', () => {
    const result = prepareRecommendationConversation('нужны недорогие модели');

    expect(result.priorMessages).toEqual([]);
    expect(result.searchText).toBe('нужны недорогие модели');
  });

  it('отделяет текущий запрос от предыдущих сообщений', () => {
    const result = prepareRecommendationConversation('Эти модели смогут найти актуальные данные?', [
      { role: 'user', content: 'нужны недорогие модели' },
      { role: 'assistant', content: 'Рекомендую deepseek-v4-flash и qwen-2.5-7b-instruct.' },
      { role: 'user', content: 'Эти модели смогут найти актуальные данные?' },
    ]);

    expect(result.priorMessages).toEqual([
      { role: 'user', content: 'нужны недорогие модели' },
      { role: 'assistant', content: 'Рекомендую deepseek-v4-flash и qwen-2.5-7b-instruct.' },
    ]);
    expect(result.searchText).toContain('недорогие модели');
    expect(result.searchText).toContain('deepseek-v4-flash');
    expect(result.searchText).toContain('актуальные данные');
  });

  it('не обрезает длинные сообщения в пределах лимита вложений', () => {
    const longContent = `контекст\n\n--- файл: notes.md ---\n${'a'.repeat(50_000)}`;
    const result = prepareRecommendationConversation(longContent, [
      { role: 'user', content: longContent },
    ]);

    expect(result.priorMessages).toEqual([]);
    expect(result.searchText).toBe(longContent);
    expect(result.searchText.length).toBe(longContent.length);
  });
});
