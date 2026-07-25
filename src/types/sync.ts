import { z } from 'zod';
import type { ModelInput } from '../types.js';

export type SyncMode = 'update' | 'import' | 'both';

export type SyncFilter = 'all' | 'empty_description' | 'provider';

export type StalenessFilter = 'never' | 'week' | 'month' | 'half_year';

export const SYNC_FIELD_GROUPS = {
  specs: [
    'family',
    'modality',
    'context_window',
    'max_output_tokens',
    'release_date',
  ],
  pricing: ['input_price_per_mtok', 'output_price_per_mtok'],
  capabilities: [
    'supports_vision',
    'supports_function_calling',
    'supports_json_mode',
    'supports_streaming',
    'supports_web_search',
  ],
  description: ['description', 'tags'],
  ai_ratings: [
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
  ],
  ai_editorial: ['use_cases', 'pros', 'cons'],
  benchmarks: ['benchmarks'],
} as const;

export const SYNCABLE_FIELDS = [
  ...SYNC_FIELD_GROUPS.specs,
  ...SYNC_FIELD_GROUPS.pricing,
  ...SYNC_FIELD_GROUPS.capabilities,
  ...SYNC_FIELD_GROUPS.description,
  ...SYNC_FIELD_GROUPS.ai_ratings,
  ...SYNC_FIELD_GROUPS.ai_editorial,
  ...SYNC_FIELD_GROUPS.benchmarks,
] as const;

export type SyncableField = (typeof SYNCABLE_FIELDS)[number];

export interface SyncFieldGroup {
  id: keyof typeof SYNC_FIELD_GROUPS;
  label: string;
  fields: SyncableField[];
}

export const SYNC_FIELD_GROUP_META: SyncFieldGroup[] = [
  { id: 'specs', label: 'Технические характеристики', fields: [...SYNC_FIELD_GROUPS.specs] },
  { id: 'pricing', label: 'Цены', fields: [...SYNC_FIELD_GROUPS.pricing] },
  { id: 'capabilities', label: 'Возможности', fields: [...SYNC_FIELD_GROUPS.capabilities] },
  { id: 'description', label: 'Описание и теги', fields: [...SYNC_FIELD_GROUPS.description] },
  { id: 'ai_ratings', label: 'Оценки (AI)', fields: [...SYNC_FIELD_GROUPS.ai_ratings] },
  { id: 'ai_editorial', label: 'Сценарии, плюсы, минусы (AI)', fields: [...SYNC_FIELD_GROUPS.ai_editorial] },
  { id: 'benchmarks', label: 'Бенчмарки', fields: [...SYNC_FIELD_GROUPS.benchmarks] },
];

export interface SyncOptions {
  mode?: SyncMode;
  fields: SyncableField[];
  onlyEmpty?: boolean;
  dryRun?: boolean;
  provider?: string;
  family?: string;
  staleness?: StalenessFilter;
  filter?: SyncFilter;
  delayMs?: number;
}

/** HTTP body schema for batch/single sync requests */
export const SyncRequestSchema = z.object({
  mode: z.enum(['update', 'import', 'both']).optional(),
  fields: z.array(z.string()).min(1),
  onlyEmpty: z.boolean().optional(),
  dryRun: z.boolean().optional(),
  provider: z.string().optional(),
  family: z.string().optional(),
  staleness: z.enum(['never', 'week', 'month', 'half_year']).optional(),
  filter: z.enum(['all', 'empty_description', 'provider']).optional(),
});
export type SyncRequestInput = z.infer<typeof SyncRequestSchema>;

export interface SyncFieldDiff {
  field: SyncableField;
  before: unknown;
  after: unknown;
}

export interface SyncModelResult {
  modelId?: string;
  name: string;
  status: 'updated' | 'created' | 'skipped' | 'error';
  message?: string;
  diff?: SyncFieldDiff[];
}

export interface SyncResult {
  updated: number;
  created: number;
  skipped: number;
  errors: number;
  results: SyncModelResult[];
}

export interface SyncProgressSummary {
  updated: number;
  created: number;
  skipped: number;
  errors: number;
}

export interface SyncProgressEvent {
  type: 'start' | 'progress';
  phase: 'update' | 'import';
  current: number;
  total: number;
  modelName: string;
  status?: SyncModelResult['status'];
  message?: string;
  summary: SyncProgressSummary;
}

export type SyncProgressCallback = (event: SyncProgressEvent) => void;

export type EnrichedPartial = Partial<ModelInput>;
