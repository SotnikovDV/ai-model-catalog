import { z } from 'zod';
import { isBlockedOutboundUrl, SAFE_OUTBOUND_URL_MESSAGE } from '../utils/safeOutboundUrl.js';

export const CatalogSourceSchema = z.enum(['bothub', 'openrouter', 'routerai', 'custom']);
export type CatalogSource = z.infer<typeof CatalogSourceSchema>;

const optionalHttpUrl = z
  .string()
  .url('Укажите корректный Base URL')
  .or(z.literal(''))
  .refine((value) => !isBlockedOutboundUrl(value), { message: SAFE_OUTBOUND_URL_MESSAGE });

const optionalCatalogUrl = z
  .string()
  .url('Укажите корректный URL каталога')
  .or(z.literal(''))
  .refine((value) => !isBlockedOutboundUrl(value), { message: SAFE_OUTBOUND_URL_MESSAGE });

export const ProviderSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Укажите название'),
  slug: z
    .string()
    .min(1, 'Укажите slug')
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Slug: латиница, цифры, дефис, подчёркивание'),
  enabled: z.coerce.boolean().default(true),
  base_url: optionalHttpUrl,
  models_url: optionalCatalogUrl,
  api_key: z.string().default(''),
  catalog_source: CatalogSourceSchema.default('custom'),
});

export type ProviderInput = z.infer<typeof ProviderSchema>;

export interface Provider extends ProviderInput {
  id: string;
  created_at: string;
  updated_at: string;
}

export const ProviderUpdateSchema = ProviderSchema.partial().extend({
  api_key: z.string().optional(),
});

export type ProviderUpdateInput = z.infer<typeof ProviderUpdateSchema>;

export interface ProviderPublic {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  base_url: string;
  models_url: string;
  catalog_source: CatalogSource;
  apiKeySet: boolean;
  apiKeyHint: string | null;
  created_at: string;
  updated_at: string;
}
