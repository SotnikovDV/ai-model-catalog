import { z } from 'zod';

export const ModelChatRatingUpsertSchema = z.object({
  responseId: z.string().uuid('Укажите корректный UUID ответа'),
  responseContent: z.string().min(1, 'Текст ответа не может быть пустым'),
  score: z.number().int().min(1).max(5),
  comment: z.string().max(5000).optional().default(''),
});
export type ModelChatRatingUpsertInput = z.infer<typeof ModelChatRatingUpsertSchema>;

export type ModelChatRating = {
  id: string;
  modelId: string;
  responseId: string;
  responseContent: string;
  score: number;
  comment: string;
  ratedAt: string;
};
