import { describe, expect, it } from 'vitest';
import {
  buildAiUseCasesPromptSection,
  getCanonicalUseCaseLabels,
  getCategoriesForUseCases,
  getUseCaseCategories,
  normalizeUseCases,
} from '../src/utils/useCaseTaxonomy.js';

describe('useCaseTaxonomy', () => {
  it('содержит 15 категорий в порядке order', () => {
    const categories = getUseCaseCategories();
    expect(categories).toHaveLength(15);
    expect(categories[0]?.label).toBe('Разработка и инженерия ПО');
    expect(categories[14]?.label).toBe('Инфраструктура и служебные функции');
  });

  it('нормализует через alias', () => {
    expect(normalizeUseCases(['Программирование и разработка ПО', 'Coding'])).toEqual([
      'Разработка и рефакторинг кода',
      'Генерация кода, рефакторинг, отладка',
    ]);
  });

  it('принимает канонические метки дословно', () => {
    const label = 'Системы извлечения с дополнением (RAG)';
    expect(normalizeUseCases([label])).toEqual([label]);
  });

  it('отбрасывает неизвестные значения', () => {
    expect(normalizeUseCases(['Неизвестный сценарий XYZ', 'RAG'])).toEqual([
      'Системы извлечения с дополнением (RAG)',
    ]);
  });

  it('дедуплицирует и сохраняет порядок', () => {
    expect(normalizeUseCases(['RAG', 'RAG-приложения', 'Чат-боты'])).toEqual([
      'Системы извлечения с дополнением (RAG)',
      'Чат-боты для обслуживания клиентов',
    ]);
  });

  it('возвращает уникальные категории для нескольких use_cases', () => {
    const categories = getCategoriesForUseCases([
      'Генерация кода, рефакторинг, отладка',
      'Системы извлечения с дополнением (RAG)',
    ]);
    expect(categories).toEqual([
      'Разработка и инженерия ПО',
      'Поиск, извлечение информации и RAG',
    ]);
  });

  it('каждый канонический use_case относится ровно к одной категории', () => {
    const labels = getCanonicalUseCaseLabels();
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
    expect(labels.length).toBeGreaterThan(100);
  });

  it('формирует промпт со всеми категориями', () => {
    const section = buildAiUseCasesPromptSection();
    expect(section).toContain('[Разработка и инженерия ПО]');
    expect(section).toContain('[Поиск, извлечение информации и RAG]');
    expect(section).toContain('- Системы извлечения с дополнением (RAG)');
  });
});
