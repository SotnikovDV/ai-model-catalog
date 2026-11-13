import { z } from 'zod';

/** Фиксированный response_id для upsert автооценки в model_chat_ratings */
export const AUTO_BENCHMARK_RESPONSE_ID = 'a0000000-0000-4000-8000-000000000001';

export const BenchmarkResultSchema = z.object({
  logic_answer: z.coerce.number(),
  logic_reason: z.string().default(''),
  fact_answer: z.coerce.string(),
  json_task: z.object({
    a: z.coerce.number(),
    b: z.coerce.number(),
  }),
  hallucination_answer: z.coerce.string(),
  api_10_words: z.coerce.string(),
});

export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;

export const ScoreBreakdownSchema = z.object({
  logic: z.union([z.literal(0), z.literal(1)]),
  fact: z.union([z.literal(0), z.literal(1)]),
  json_task: z.union([z.literal(0), z.literal(1)]),
  anti_hallucination: z.union([z.literal(0), z.literal(1)]),
  brevity: z.union([z.literal(0), z.literal(1)]),
});

export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

export const EvaluationStalenessSchema = z.enum(['never', 'week', 'month', 'half_year']);
export type EvaluationStalenessFilter = z.infer<typeof EvaluationStalenessSchema>;

export const EvaluationFilterSchema = z.enum(['all', 'empty_description', 'provider']);
export type EvaluationFilter = z.infer<typeof EvaluationFilterSchema>;

export const EvaluationRequestSchema = z.object({
  filter: EvaluationFilterSchema.optional(),
  provider: z.string().optional(),
  family: z.string().optional(),
  staleness: EvaluationStalenessSchema.optional(),
  delayMs: z.number().int().min(0).max(10000).optional(),
  inferenceOnly: z.boolean().optional(),
});

export type EvaluationRequestInput = z.infer<typeof EvaluationRequestSchema>;

export interface EvaluationOptions {
  filter?: EvaluationFilter;
  provider?: string;
  family?: string;
  staleness?: EvaluationStalenessFilter;
  delayMs?: number;
  inferenceOnly?: boolean;
}

export interface EvaluationResult {
  ok: boolean;
  total: number;
  score: number;
  breakdown: ScoreBreakdown;
  parsed?: BenchmarkResult;
  rawText?: string;
  errors: string[];
}

export interface EvaluationCheckResult {
  modelId: string;
  name: string;
  status: 'success' | 'parse_error' | 'error';
  total?: number;
  score?: number;
  responseMs?: number;
  error?: string;
}

export interface EvaluationProgressSummary {
  success: number;
  parseErrors: number;
  errors: number;
}

export interface EvaluationProgressEvent {
  type: 'start' | 'progress';
  current: number;
  total: number;
  modelName: string;
  status?: EvaluationCheckResult['status'];
  message?: string;
  summary: EvaluationProgressSummary;
}

export type EvaluationProgressCallback = (event: EvaluationProgressEvent) => void;

export interface EvaluationRunResult extends EvaluationProgressSummary {
  results: EvaluationCheckResult[];
  cancelled?: boolean;
}
