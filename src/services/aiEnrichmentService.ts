import { chatCompletion } from './aiClient.js';
import type { Model } from '../types.js';
import type { EnrichedPartial } from '../types/sync.js';
import { extractJsonBlock } from '../utils/extractJsonBlock.js';
import { buildAiUseCasesPromptSection, normalizeUseCases } from '../utils/useCaseTaxonomy.js';

const RATING_FIELDS = [
  'reasoning',
  'task_quality',
  'latency',
  'generation_speed',
  'hallucinations',
  'instruction_following',
  'code_quality',
  'multilingual_quality',
  'robustness',
  'rag_compatibility',
] as const;

const EDITORIAL_FIELDS = ['use_cases', 'pros', 'cons'] as const;

function buildModelContext(model: Model, partial: EnrichedPartial): string {
  const merged = { ...model, ...partial };
  return [
    `Модель: ${merged.name}`,
    `Семейство: ${merged.family}`,
    `Провайдер: ${merged.provider}`,
    `Модальность: ${merged.modality}`,
    `Контекст: ${merged.context_window} токенов`,
    `Vision: ${merged.supports_vision ? 'да' : 'нет'}`,
    `Function calling: ${merged.supports_function_calling ? 'да' : 'нет'}`,
    `Поиск в интернете: ${merged.supports_web_search ? 'да' : 'нет'}`,
    `Описание: ${merged.description || 'нет'}`,
  ].join('\n');
}

function buildFieldBatches(fields: string[]): string[][] {
  const ratingFields = fields.filter((f) => (RATING_FIELDS as readonly string[]).includes(f));
  const editorialFields = fields.filter((f) => (EDITORIAL_FIELDS as readonly string[]).includes(f));
  const wantsBenchmarks = fields.includes('benchmarks');

  const batches: string[][] = [];
  if (ratingFields.length > 0) batches.push(ratingFields);
  const editorialBatch = [...editorialFields, ...(wantsBenchmarks ? ['benchmarks'] : [])];
  if (editorialBatch.length > 0) batches.push(editorialBatch);
  return batches;
}

function buildPrompt(context: string, requested: string[], strict = false): string {
  const strictNote = strict
    ? '\n\nВажно: верни ТОЛЬКО один JSON-объект. Без markdown, пояснений, цитат и текста до/после JSON.'
    : '';

  const useCasesRule = requested.includes('use_cases')
    ? `- use_cases — массив из 3-5 строк строго из справочника ниже (копировать дословно, не придумывать новые формулировки):
${buildAiUseCasesPromptSection()}
`
    : '';

  return `Ты эксперт по LLM. На основе данных о модели заполни только запрошенные поля.
Верни строго JSON-объект без пояснений.

Запрошенные поля: ${requested.join(', ')}

Правила:
- Оценки (reasoning, task_quality, latency, generation_speed, hallucinations, instruction_following, code_quality, multilingual_quality, robustness, rag_compatibility) — целые числа 1-5.
${useCasesRule}- pros, cons — массивы строк на русском, по 3-5 пунктов.
- benchmarks — объект { "название": число }, можно оставить {} если данных нет.

Данные модели:
${context}${strictNote}`;
}

function mapParsedFields(parsed: Record<string, unknown>, fields: string[]): EnrichedPartial {
  const output: EnrichedPartial = {};

  for (const field of fields) {
    if (!(field in parsed)) continue;
    const value = parsed[field];
    if (value === undefined || value === null) continue;

    if ((RATING_FIELDS as readonly string[]).includes(field)) {
      const num = Number(value);
      if (Number.isInteger(num) && num >= 1 && num <= 5) {
        (output as Record<string, number>)[field] = num;
      }
      continue;
    }

    if ((EDITORIAL_FIELDS as readonly string[]).includes(field) && Array.isArray(value)) {
      const items = value.map(String).filter(Boolean);
      (output as Record<string, string[]>)[field] = field === 'use_cases'
        ? normalizeUseCases(items)
        : items;
      continue;
    }

    if (field === 'benchmarks' && typeof value === 'object' && !Array.isArray(value)) {
      const benchmarks: Record<string, number> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        const num = Number(v);
        if (Number.isFinite(num)) benchmarks[k] = num;
      }
      output.benchmarks = benchmarks;
    }
  }

  return output;
}

async function enrichFieldBatch(
  context: string,
  requested: string[],
): Promise<EnrichedPartial> {
  let lastContent = '';

  for (const strict of [false, true]) {
    try {
      const result = await chatCompletion({
        tier: 'analytics',
        temperature: 0.2,
        maxTokens: 4096,
        responseFormat: 'json_object',
        messages: [
          { role: 'system', content: 'Отвечай только валидным JSON-объектом.' },
          { role: 'user', content: buildPrompt(context, requested, strict) },
        ],
      });
      lastContent = result.content;
      const parsed = extractJsonBlock(result.content) as Record<string, unknown>;
      return mapParsedFields(parsed, requested);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.includes('AI-провайдер')
        || message.includes('AI-провайдер не настроен')
        || message.includes('AI-провайдер отключён')
      ) {
        throw error;
      }
    }
  }

  const preview = lastContent
    ? ` Ответ: ${lastContent.replace(/\s+/g, ' ').slice(0, 180)}…`
    : '';
  throw new Error(`AI вернул некорректный JSON для обогащения модели.${preview}`);
}

export async function enrichWithAi(
  model: Model,
  partial: EnrichedPartial,
  fields: string[],
): Promise<EnrichedPartial> {
  const batches = buildFieldBatches(fields);
  if (batches.length === 0) return {};

  const context = buildModelContext(model, partial);
  const output: EnrichedPartial = {};

  for (const batch of batches) {
    const batchResult = await enrichFieldBatch(context, batch);
    Object.assign(output, batchResult);
  }

  return output;
}
