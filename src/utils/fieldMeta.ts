import {
  MODEL_FIELD_META,
  SYNC_PARAM_META,
  DETAIL_SECTION_META,
  type FieldMeta,
} from '../data/fieldMeta.js';

export type { FieldMeta };

export function getFieldMeta(key: string): FieldMeta | undefined {
  return MODEL_FIELD_META[key]
    ?? SYNC_PARAM_META[key]
    ?? DETAIL_SECTION_META[key];
}

export function isAiField(key: string): boolean {
  return Boolean(MODEL_FIELD_META[key]?.requiresAi);
}

export function getModelFieldMetaMap(): Record<string, FieldMeta> {
  return MODEL_FIELD_META;
}

export function getSyncParamMetaMap(): Record<string, FieldMeta> {
  return SYNC_PARAM_META;
}

export function getSyncFieldMetaForApi(): Record<string, FieldMeta> {
  const result: Record<string, FieldMeta> = {};
  for (const [key, meta] of Object.entries(MODEL_FIELD_META)) {
    result[key] = meta;
  }
  return result;
}
