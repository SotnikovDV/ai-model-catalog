import { z } from 'zod';

const Rating = z.coerce.number().int().min(1).max(5).default(3);

export const AvailabilityStatusSchema = z.enum(['available', 'inference', 'unavailable']);
export type AvailabilityStatus = z.infer<typeof AvailabilityStatusSchema>;

export const ModelSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  provider: z.string().min(1),
  provider_id: z.string().uuid().optional(),
  family: z.string().min(1),
  modality: z.enum(['text', 'image', 'audio', 'video', 'multimodal']).default('text'),
  context_window: z.coerce.number().int().nonnegative().default(0),
  max_output_tokens: z.coerce.number().int().nonnegative().default(0),
  input_price_per_mtok: z.coerce.number().nonnegative().default(0),
  output_price_per_mtok: z.coerce.number().nonnegative().default(0),
  supports_vision: z.coerce.boolean().default(false),
  supports_function_calling: z.coerce.boolean().default(false),
  supports_json_mode: z.coerce.boolean().default(false),
  supports_streaming: z.coerce.boolean().default(false),
  supports_web_search: z.coerce.boolean().default(false),
  is_favorite: z.coerce.boolean().default(false),
  is_hidden: z.coerce.boolean().default(false),
  reasoning: Rating,
  task_quality: Rating,
  latency: Rating,
  generation_speed: Rating,
  hallucinations: Rating,
  instruction_following: Rating,
  code_quality: Rating,
  multilingual_quality: Rating,
  robustness: Rating,
  rag_compatibility: Rating,
  release_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  description: z.string().default(''),
  use_cases: z.union([z.string(), z.array(z.string())]).default([]),
  pros: z.union([z.string(), z.array(z.string())]).default([]),
  cons: z.union([z.string(), z.array(z.string())]).default([]),
  benchmarks: z.union([z.string(), z.record(z.number())]).default({}),
  tags: z.union([z.string(), z.array(z.string())]).default([]),
  info_updated_at: z.string().datetime().optional().nullable(),
  availability_checked_at: z.string().datetime().optional().nullable(),
  availability_status: AvailabilityStatusSchema.optional().nullable(),
  availability_response_ms: z.coerce.number().int().nonnegative().optional().nullable(),
  availability_error: z.string().optional().nullable(),
});

export type ModelInput = z.infer<typeof ModelSchema>;

export interface Model extends ModelInput {
  id: string;
  provider_id?: string;
  created_at: string;
  updated_at: string;
  info_updated_at?: string | null;
  availability_checked_at?: string | null;
  availability_status?: AvailabilityStatus | null;
  availability_response_ms?: number | null;
  availability_error?: string | null;
}

export interface ModelFilter {
  provider?: string;
  family?: string;
  modality?: string;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  supports_json_mode?: boolean;
  supports_streaming?: boolean;
  supports_web_search?: boolean;
  is_favorite?: boolean;
  exclude_hidden?: boolean;
  availability_status?: AvailabilityStatus | 'unchecked';
  min_context?: number;
  max_context?: number;
  search?: string;
  sort?: 'name' | 'provider' | 'family' | 'context_window' | 'input_price_per_mtok' | 'output_price_per_mtok' | 'release_date' | 'reasoning' | 'task_quality' | 'latency' | 'generation_speed' | 'hallucinations' | 'instruction_following' | 'code_quality' | 'multilingual_quality' | 'robustness' | 'rag_compatibility' | 'availability_checked_at';
  order?: 'asc' | 'desc';
}
