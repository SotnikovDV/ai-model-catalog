import { z } from 'zod';
import type { Model } from '../types.js';
import { isBlockedOutboundUrl, SAFE_OUTBOUND_URL_MESSAGE } from '../utils/safeOutboundUrl.js';

export const AiModelTierSchema = z.enum(['simple', 'analytics']);
export type AiModelTier = z.infer<typeof AiModelTierSchema>;

export const ChatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

const aiBaseUrlSchema = z
  .string()
  .url('Укажите корректный URL API (например, https://api.openai.com/v1)')
  .refine((value) => !isBlockedOutboundUrl(value), { message: SAFE_OUTBOUND_URL_MESSAGE });

export const AiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: aiBaseUrlSchema,
  apiKey: z.string().default(''),
  modelSimple: z.string().min(1, 'Укажите модель для простых задач'),
  modelAnalytics: z.string().min(1, 'Укажите модель для аналитики'),
});
export type AiConfig = z.infer<typeof AiConfigSchema>;

export const AiConfigInputSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z
    .string()
    .url()
    .refine((value) => !isBlockedOutboundUrl(value), { message: SAFE_OUTBOUND_URL_MESSAGE })
    .optional(),
  apiKey: z.string().optional(),
  modelSimple: z.string().min(1).optional(),
  modelAnalytics: z.string().min(1).optional(),
});
export type AiConfigInput = z.infer<typeof AiConfigInputSchema>;

export const AiConfigPublicSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string(),
  apiKeySet: z.boolean(),
  apiKeyHint: z.string().nullable(),
  modelSimple: z.string(),
  modelAnalytics: z.string(),
  configured: z.boolean(),
});
export type AiConfigPublic = z.infer<typeof AiConfigPublicSchema>;

export const AiChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  tier: AiModelTierSchema.default('simple'),
  model: z.string().min(1).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(128_000).optional(),
});
export type AiChatRequest = z.infer<typeof AiChatRequestSchema>;

export const ModelChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(128_000).optional(),
  includeReasoning: z.boolean().optional(),
});
export type ModelChatRequest = z.infer<typeof ModelChatRequestSchema>;

export const RecommendationRequestSchema = z.object({
  query: z.string().min(3, 'Опишите задачу не менее чем в 3 символах').max(2000),
  limit: z.number().int().min(1).max(15).default(8),
});
export type RecommendationRequest = z.infer<typeof RecommendationRequestSchema>;

export interface RecommendationItem {
  modelId: string;
  rank: number;
  rationale: string;
  model: Model;
}

export interface RecommendationResult {
  query: string;
  summary: string;
  items: RecommendationItem[];
  meta: {
    tier: 'analytics';
    model: string;
    candidateCount: number;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
}
