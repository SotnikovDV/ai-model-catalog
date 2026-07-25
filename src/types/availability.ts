import { z } from 'zod';

export const AvailabilityModeSchema = z.enum(['catalog', 'inference']);
export type AvailabilityMode = z.infer<typeof AvailabilityModeSchema>;

export const AvailabilityStalenessSchema = z.enum(['never', 'week', 'month', 'half_year']);
export type AvailabilityStalenessFilter = z.infer<typeof AvailabilityStalenessSchema>;

export const AvailabilityFilterSchema = z.enum(['all', 'empty_description', 'provider']);
export type AvailabilityFilter = z.infer<typeof AvailabilityFilterSchema>;

export const SingleAvailabilitySchema = z.object({
  mode: AvailabilityModeSchema,
});

export const AvailabilityRequestSchema = z.object({
  mode: AvailabilityModeSchema,
  filter: AvailabilityFilterSchema.optional(),
  provider: z.string().optional(),
  family: z.string().optional(),
  staleness: AvailabilityStalenessSchema.optional(),
  delayMs: z.number().int().min(0).max(5000).optional(),
});

export type AvailabilityRequestInput = z.infer<typeof AvailabilityRequestSchema>;

export interface AvailabilityOptions {
  mode: AvailabilityMode;
  filter?: AvailabilityFilter;
  provider?: string;
  family?: string;
  staleness?: AvailabilityStalenessFilter;
  delayMs?: number;
}

export interface AvailabilityCheckResult {
  modelId: string;
  name: string;
  status: 'available' | 'inference' | 'unavailable' | 'error';
  responseMs?: number;
  error?: string;
  usage?: { totalTokens?: number };
}

export interface AvailabilityProgressSummary {
  available: number;
  inference: number;
  unavailable: number;
  errors: number;
}

export interface AvailabilityProgressEvent {
  type: 'start' | 'progress';
  current: number;
  total: number;
  modelName: string;
  status?: AvailabilityCheckResult['status'];
  message?: string;
  summary: AvailabilityProgressSummary;
}

export type AvailabilityProgressCallback = (event: AvailabilityProgressEvent) => void;

export interface AvailabilityRunResult extends AvailabilityProgressSummary {
  results: AvailabilityCheckResult[];
}

export interface AvailabilityProbeResult {
  status: 'available' | 'inference' | 'unavailable';
  responseMs?: number;
  error?: string;
  usage?: { totalTokens?: number };
}
