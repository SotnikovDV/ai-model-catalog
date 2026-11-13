import { z } from 'zod';
import type { Model } from '../types.js';
import { isBlockedOutboundUrl, SAFE_OUTBOUND_URL_MESSAGE } from '../utils/safeOutboundUrl.js';

export const AiModelTierSchema = z.enum(['simple', 'analytics', 'search']);
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

/** Пустая строка = использовать основной AI_BASE_URL */
const optionalAiBaseUrlSchema = z
  .string()
  .default('')
  .refine(
    (value) => value.trim() === '' || z.string().url().safeParse(value).success,
    { message: 'Укажите корректный URL API или оставьте поле пустым' },
  )
  .refine((value) => value.trim() === '' || !isBlockedOutboundUrl(value), {
    message: SAFE_OUTBOUND_URL_MESSAGE,
  });

export const AiConfigSchema = z.object({
  enabled: z.boolean().default(false),
  baseUrl: aiBaseUrlSchema,
  apiKey: z.string().default(''),
  modelSimple: z.string().min(1, 'Укажите модель для простых задач'),
  modelAnalytics: z.string().min(1, 'Укажите модель для аналитики'),
  searchBaseUrl: optionalAiBaseUrlSchema,
  searchApiKey: z.string().default(''),
  modelSearch: z.string().default(''),
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
  searchBaseUrl: z
    .string()
    .refine(
      (value) => value.trim() === '' || z.string().url().safeParse(value).success,
      { message: 'Укажите корректный URL API или оставьте поле пустым' },
    )
    .refine((value) => value.trim() === '' || !isBlockedOutboundUrl(value), {
      message: SAFE_OUTBOUND_URL_MESSAGE,
    })
    .optional(),
  searchApiKey: z.string().optional(),
  modelSearch: z.string().optional(),
});
export type AiConfigInput = z.infer<typeof AiConfigInputSchema>;

export const AiConfigPublicSchema = z.object({
  enabled: z.boolean(),
  baseUrl: z.string(),
  apiKeySet: z.boolean(),
  apiKeyHint: z.string().nullable(),
  modelSimple: z.string(),
  modelAnalytics: z.string(),
  searchBaseUrl: z.string(),
  searchApiKeySet: z.boolean(),
  searchApiKeyHint: z.string().nullable(),
  modelSearch: z.string(),
  searchConfigured: z.boolean(),
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

export const ModelOverviewRequestSchema = z.object({
  modelName: z.string().min(1, 'Укажите название модели').max(200),
  modelId: z.string().min(1).max(100).optional(),
});
export type ModelOverviewRequest = z.infer<typeof ModelOverviewRequestSchema>;

export const ModelChatRequestSchema = z.object({
  messages: z.array(ChatMessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().max(128_000).optional(),
  includeReasoning: z.boolean().optional(),
});
export type ModelChatRequest = z.infer<typeof ModelChatRequestSchema>;

export const RecommendationConversationMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(200_000),
});
export type RecommendationConversationMessage = z.infer<typeof RecommendationConversationMessageSchema>;

export const RecommendationRequestSchema = z.object({
  query: z.string().min(3, 'Опишите задачу не менее чем в 3 символах').max(200_000),
  limit: z.number().int().min(1).max(15).default(8),
  messages: z.array(RecommendationConversationMessageSchema).max(50).optional(),
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
