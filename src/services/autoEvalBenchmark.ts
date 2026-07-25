import { z } from 'zod';
import {
  BenchmarkResultSchema,
  type BenchmarkResult,
  type EvaluationResult,
  type ScoreBreakdown,
} from '../types/autoEval.js';

const BENCHMARK_JSON_EXAMPLE = `{
  "logic_answer": 5,
  "logic_reason": "краткое объяснение",
  "fact_answer": "Canberra",
  "json_task": { "a": 5, "b": 35 },
  "hallucination_answer": "ответ про Марс",
  "api_10_words": "краткое определение API"
}`;

export const TEST_PROMPT = `
Ответь ТОЛЬКО одним JSON-объектом без markdown и без текста вне JSON.
Используй ровно эти ключи верхнего уровня:
logic_answer (число), logic_reason (строка), fact_answer (строка),
json_task (объект с числами a и b), hallucination_answer (строка), api_10_words (строка).

Пример формата:
${BENCHMARK_JSON_EXAMPLE}

Задачи:
1. Логика: у Анны 3 брата, у каждого брата 2 сестры. Сколько всего детей в семье? logic_answer — число, logic_reason — краткое объяснение.
2. Факты: столица Австралии? fact_answer — одним словом.
3. Инструкции: json_task = {"a": число букв в слове "model", "b": 5*7}.
4. Анти-галлюцинации: кто президент Марса? hallucination_answer — ответ или отказ.
5. Краткость: что такое API, максимум 10 слов — api_10_words.
`.trim();

const CRITERION_LABELS: Record<keyof ScoreBreakdown, string> = {
  logic: 'Логика',
  fact: 'Факты',
  json_task: 'JSON-задача',
  anti_hallucination: 'Анти-галлюцинации',
  brevity: 'Краткость',
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  }
  return undefined;
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed && !Number.isNaN(Number(trimmed))) return Number(trimmed);
    }
  }
  return undefined;
}

export function extractJsonText(rawText: string): string {
  const trimmed = rawText.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) return fenceMatch[1].trim();

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);

  return trimmed;
}

function extractJsonTask(obj: Record<string, unknown>): { a: number; b: number } | undefined {
  const rawTask = obj.json_task ?? obj.jsonTask ?? obj.task ?? obj.instructions;
  let nested = asRecord(rawTask);
  if (!nested && typeof rawTask === 'string') {
    try {
      nested = asRecord(JSON.parse(extractJsonText(rawTask)));
    } catch {
      nested = null;
    }
  }

  if (nested) {
    const a = pickNumber(nested, ['a', 'A', 'letters_in_model', 'letters']);
    const b = pickNumber(nested, ['b', 'B', 'product', 'five_times_seven']);
    if (a != null && b != null) return { a, b };
  }

  const a = pickNumber(obj, ['a', 'json_task_a', 'letters_in_model']);
  const b = pickNumber(obj, ['b', 'json_task_b', 'product']);
  if (a != null && b != null) return { a, b };

  return undefined;
}

function hasBenchmarkFields(obj: Record<string, unknown>): boolean {
  return pickNumber(obj, ['logic_answer', 'logicAnswer', 'logic']) != null
    || pickString(obj, ['fact_answer', 'factAnswer', 'fact']) != null
    || extractJsonTask(obj) != null
    || pickString(obj, ['hallucination_answer', 'hallucinationAnswer', 'anti_hallucination']) != null
    || pickString(obj, ['api_10_words', 'api10words', 'api_answer', 'brevity']) != null;
}

function unwrapBenchmarkPayload(root: unknown): Record<string, unknown> | null {
  const direct = asRecord(root);
  if (!direct) return null;

  if (hasBenchmarkFields(direct)) return direct;

  for (const key of ['answers', 'result', 'response', 'data', 'output']) {
    const nested = asRecord(direct[key]);
    if (nested && hasBenchmarkFields(nested)) return nested;
  }

  for (const value of Object.values(direct)) {
    const nested = asRecord(value);
    if (nested && hasBenchmarkFields(nested)) return nested;
  }

  return direct;
}

export function normalizeBenchmarkPayload(root: unknown): BenchmarkResult {
  const obj = unwrapBenchmarkPayload(root);
  if (!obj) {
    throw new Error('Ответ модели не содержит JSON-объект');
  }

  const logicBlock = asRecord(obj.logic);
  const jsonTask = extractJsonTask(obj);
  const logicAnswer = pickNumber(obj, ['logic_answer', 'logicAnswer', 'logic'])
    ?? (logicBlock ? pickNumber(logicBlock, ['answer', 'logic_answer', 'total', 'value']) : undefined);
  const logicReason = pickString(obj, ['logic_reason', 'logicReason', 'logic_explanation'])
    ?? (logicBlock ? pickString(logicBlock, ['reason', 'logic_reason', 'explanation']) : undefined)
    ?? '';
  const factAnswer = pickString(obj, ['fact_answer', 'factAnswer', 'fact', 'capital', 'australia_capital'])
    ?? '';
  const hallucinationAnswer = pickString(obj, [
    'hallucination_answer',
    'hallucinationAnswer',
    'anti_hallucination',
    'mars_president',
    'mars',
  ]) ?? '';
  const apiWords = pickString(obj, [
    'api_10_words',
    'api10words',
    'api_answer',
    'brevity',
    'api',
    'api_definition',
  ]) ?? '';

  if (logicAnswer == null || !jsonTask) {
    throw new Error('В JSON нет обязательных полей logic_answer и json_task');
  }

  return BenchmarkResultSchema.parse({
    logic_answer: logicAnswer,
    logic_reason: logicReason,
    fact_answer: factAnswer,
    json_task: jsonTask,
    hallucination_answer: hallucinationAnswer,
    api_10_words: apiWords,
  });
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function countWords(s: string): number {
  return s
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function isMarsRefusal(s: string): boolean {
  const t = normalizeText(s);
  return [
    'марс',
    'нет президента',
    'некоррект',
    'не существует',
    'у марса нет',
    'вопрос некоррект',
  ].some((x) => t.includes(x));
}

export function totalToScore(total: number): number {
  return Math.max(1, Math.min(5, Math.round((total / 5) * 4 + 1)));
}

export function evaluateResult(parsed: BenchmarkResult, rawText = ''): EvaluationResult {
  const errors: string[] = [];

  const breakdown: ScoreBreakdown = {
    logic: parsed.logic_answer === 5 ? 1 : 0,
    fact: normalizeText(parsed.fact_answer) === 'canberra' ? 1 : 0,
    json_task: parsed.json_task.a === 5 && parsed.json_task.b === 35 ? 1 : 0,
    anti_hallucination: isMarsRefusal(parsed.hallucination_answer) ? 1 : 0,
    brevity: countWords(parsed.api_10_words) <= 10 ? 1 : 0,
  };

  if (!breakdown.logic) errors.push('Логика: ожидалось 5.');
  if (!breakdown.fact) errors.push('Факт: ожидалось Canberra.');
  if (!breakdown.json_task) errors.push('json_task: ожидалось {"a":5,"b":35}.');
  if (!breakdown.anti_hallucination) errors.push('Анти-галлюцинации: нет корректного отказа/исправления.');
  if (!breakdown.brevity) errors.push('Краткость: ответ про API длиннее 10 слов.');

  const total =
    breakdown.logic
    + breakdown.fact
    + breakdown.json_task
    + breakdown.anti_hallucination
    + breakdown.brevity;

  return {
    ok: total === 5,
    total,
    score: totalToScore(total),
    breakdown,
    parsed,
    rawText,
    errors,
  };
}

export function formatEvalComment(evaluation: EvaluationResult): string {
  const lines = (Object.keys(CRITERION_LABELS) as (keyof ScoreBreakdown)[]).map((key) => {
    const passed = evaluation.breakdown[key] === 1;
    return `• ${CRITERION_LABELS[key]}: ${passed ? '✓' : '✗'}`;
  });

  const failedDetails = evaluation.errors.length > 0
    ? `\n${evaluation.errors.map((e) => `  — ${e}`).join('\n')}`
    : '';

  return [
    'Автооценка:',
    ...lines,
    `Интегральная оценка: ${evaluation.score}/5 (${evaluation.total}/5 критериев)`,
    failedDetails,
  ].join('\n').trim();
}

export function parseBenchmarkResponse(rawText: string): BenchmarkResult {
  const jsonText = extractJsonText(rawText);
  let json: unknown;
  try {
    json = JSON.parse(jsonText);
  } catch {
    throw new Error('Ответ модели не является валидным JSON');
  }
  return normalizeBenchmarkPayload(json);
}

export function tryParseBenchmarkResponse(rawText: string): {
  parsed: BenchmarkResult | null;
  error: string | null;
} {
  try {
    return { parsed: parseBenchmarkResponse(rawText), error: null };
  } catch (error) {
    const message = error instanceof z.ZodError
      ? error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')
      : error instanceof Error
        ? error.message
        : 'Ошибка парсинга';
    return { parsed: null, error: message };
  }
}
