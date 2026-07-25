import { z } from 'zod';
import type { RecommendationResult } from './ai.js';

export const AssistantStoredMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
  elapsedMs: z.number().optional(),
});
export type AssistantStoredMessage = z.infer<typeof AssistantStoredMessageSchema>;

export const AssistantChatCreateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  messages: z.array(AssistantStoredMessageSchema).default([]),
  lastResult: z.unknown().nullable().optional(),
});
export type AssistantChatCreateInput = z.infer<typeof AssistantChatCreateSchema>;

export const AssistantChatUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  messages: z.array(AssistantStoredMessageSchema).optional(),
  lastResult: z.unknown().nullable().optional(),
});
export type AssistantChatUpdateInput = z.infer<typeof AssistantChatUpdateSchema>;

export interface AssistantChatListItem {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantChat {
  id: string;
  title: string;
  messages: AssistantStoredMessage[];
  lastResult: RecommendationResult | null;
  createdAt: string;
  updatedAt: string;
}
