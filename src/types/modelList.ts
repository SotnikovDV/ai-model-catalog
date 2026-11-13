import { z } from 'zod';
import type { Model } from '../types.js';

export const ModelListCreateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Укажите название').max(200, 'Слишком длинное название'),
  description: z.string().trim().max(5000, 'Слишком длинное описание').default(''),
});

export type ModelListCreateInput = z.infer<typeof ModelListCreateSchema>;

export const ModelListUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Укажите название').max(200, 'Слишком длинное название').optional(),
  description: z.string().trim().max(5000, 'Слишком длинное описание').optional(),
});

export type ModelListUpdateInput = z.infer<typeof ModelListUpdateSchema>;

export const ModelListItemAddSchema = z.object({
  modelId: z.string().uuid('Некорректный id модели'),
  comment: z.string().trim().max(5000, 'Слишком длинный комментарий').default(''),
});

export const ModelListItemsAddSchema = z.object({
  items: z.array(ModelListItemAddSchema).min(1, 'Укажите хотя бы одну модель'),
});

export type ModelListItemsAddInput = z.infer<typeof ModelListItemsAddSchema>;

export const ModelListItemUpdateSchema = z.object({
  comment: z.string().trim().max(5000, 'Слишком длинный комментарий'),
});

export type ModelListItemUpdateInput = z.infer<typeof ModelListItemUpdateSchema>;

export interface ModelList {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface ModelListSummary extends ModelList {
  itemCount: number;
}

export interface ModelListItemRow {
  list_id: string;
  model_id: string;
  comment: string;
  sort_order: number;
  created_at: string;
}

export interface ModelListItemPublic {
  modelId: string;
  comment: string;
  sortOrder: number;
  model: Model | null;
}

export interface ModelListDetail extends ModelList {
  items: ModelListItemPublic[];
}

export interface ModelListAddItemsResult {
  added: number;
  skipped: number;
  items: ModelListItemPublic[];
}

/** Опции публичного чтения: скрытые модели не попадают в items / itemCount. */
export interface ModelListPublicViewOptions {
  /** Не включать модели с is_hidden=true (публичный каталог / API). */
  excludeHidden?: boolean;
}
