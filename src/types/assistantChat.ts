import { z } from 'zod';
import type { RecommendationResult } from './ai.js';

export const AssistantStoredMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(255),
        text: z.string().min(1).max(200_000),
      }),
    )
    .max(3)
    .optional(),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
  elapsedMs: z.number().optional(),
}).refine(
  (message) => message.content.trim().length > 0 || (message.attachments?.length ?? 0) > 0,
  { message: 'Сообщение не может быть пустым' },
);
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
