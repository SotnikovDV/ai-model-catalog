import { describe, expect, it } from 'vitest';
import {
  evaluateResult,
  extractJsonText,
  formatEvalComment,
  normalizeBenchmarkPayload,
  parseBenchmarkResponse,
  totalToScore,
} from '../src/services/autoEvalBenchmark.js';
import type { BenchmarkResult } from '../src/types/autoEval.js';

const perfectResult: BenchmarkResult = {
  logic_answer: 5,
  logic_reason: '3 брата и 2 сестры, включая Анну.',
  fact_answer: 'Canberra',
  json_task: { a: 5, b: 35 },
  hallucination_answer: 'У Марса нет президента, вопрос некорректен.',
  api_10_words: 'API — интерфейс для обмена данными между программами.',
};

describe('totalToScore', () => {
  it('maps 0 criteria to score 1', () => {
    expect(totalToScore(0)).toBe(1);
  });

  it('maps 5 criteria to score 5', () => {
    expect(totalToScore(5)).toBe(5);
  });

  it('maps 3 criteria to score 3', () => {
    expect(totalToScore(3)).toBe(3);
  });
});

describe('evaluateResult', () => {
  it('returns perfect evaluation for valid benchmark response', () => {
    const result = evaluateResult(perfectResult);
    expect(result.ok).toBe(true);
    expect(result.total).toBe(5);
    expect(result.score).toBe(5);
    expect(result.errors).toHaveLength(0);
    expect(result.breakdown).toEqual({
      logic: 1,
      fact: 1,
      json_task: 1,
      anti_hallucination: 1,
      brevity: 1,
    });
  });

  it('flags failed logic and fact criteria', () => {
    const result = evaluateResult({
      ...perfectResult,
      logic_answer: 4,
      fact_answer: 'Sydney',
    });
    expect(result.total).toBe(3);
    expect(result.breakdown.logic).toBe(0);
    expect(result.breakdown.fact).toBe(0);
    expect(result.errors).toContain('Логика: ожидалось 5.');
    expect(result.errors).toContain('Факт: ожидалось Canberra.');
  });
});

describe('formatEvalComment', () => {
  it('includes criterion breakdown and integrated score', () => {
    const evaluation = evaluateResult(perfectResult);
    const comment = formatEvalComment(evaluation);
    expect(comment).toContain('Автооценка:');
    expect(comment).toContain('Логика: ✓');
    expect(comment).toContain('Интегральная оценка: 5/5');
  });
});

describe('extractJsonText', () => {
  it('extracts JSON from markdown fence', () => {
    const raw = '```json\n{"logic_answer":5}\n```';
    expect(extractJsonText(raw)).toBe('{"logic_answer":5}');
  });
});

describe('normalizeBenchmarkPayload', () => {
  it('accepts nested logic block and string numbers', () => {
    const parsed = normalizeBenchmarkPayload({
      logic: { answer: '5', reason: 'потому что' },
      fact_answer: 'Canberra',
      json_task: { a: '5', b: '35' },
      hallucination_answer: 'У Марса нет президента',
      api_10_words: 'API обменивается данными между программами',
    });
    expect(parsed.logic_answer).toBe(5);
    expect(parsed.json_task).toEqual({ a: 5, b: 35 });
  });

  it('unwraps result wrapper object', () => {
    const parsed = normalizeBenchmarkPayload({
      result: {
        logic_answer: 5,
        logic_reason: 'ok',
        fact_answer: 'Canberra',
        json_task: { a: 5, b: 35 },
        hallucination_answer: 'вопрос некорректен',
        api_10_words: 'интерфейс программ',
      },
    });
    expect(parsed.logic_answer).toBe(5);
  });
});

describe('parseBenchmarkResponse', () => {
  it('parses fenced JSON with perfect answers', () => {
    const raw = `\`\`\`json\n${JSON.stringify(perfectResult)}\n\`\`\``;
    const parsed = parseBenchmarkResponse(raw);
    expect(parsed.fact_answer).toBe('Canberra');
  });
});
