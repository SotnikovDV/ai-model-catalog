import type { Model } from '../types.js';

function asStringArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function buildSearchHaystack(model: Model): string {
  return [
    model.name,
    model.family,
    model.provider,
    model.description,
    model.modality,
    ...asStringArray(model.tags),
    ...asStringArray(model.use_cases),
  ].join(' ').toLowerCase();
}

export function scoreModelForQuery(model: Model, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;

  const haystack = buildSearchHaystack(model);
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  let score = 0;

  for (const token of tokens) {
    if (haystack.includes(token)) score += 10;
    if (model.name.toLowerCase().includes(token)) score += 15;
    if (model.family.toLowerCase().includes(token)) score += 8;
  }

  if (/бюджет|дешев|cheap|бесплат|free|эконом/i.test(q)) {
    const maxPrice = Math.max(model.input_price_per_mtok, model.output_price_per_mtok);
    if (maxPrice === 0) score += 20;
    else if (maxPrice <= 200) score += 15;
    else if (maxPrice <= 1500) score += 5;
    else score -= 5;
  }

  if (/rag|retrieval|документ|вектор/i.test(q)) score += model.rag_compatibility * 2;
  if (/код|code|программ|developer/i.test(q)) score += model.code_quality * 2;
  if (/vision|изображен|картин|фото|multimodal/i.test(q)) {
    if (model.supports_vision) score += 15;
    if (model.modality === 'multimodal') score += 10;
  }
  if (/русск|multilingual|многоязыч/i.test(q)) score += model.multilingual_quality * 2;
  if (/быстр|latency|скорост/i.test(q)) score += model.latency * 2 + model.generation_speed;
  if (/reasoning|размышл|сложн|логик/i.test(q)) score += model.reasoning * 2;
  if (/json|function.?call|tool/i.test(q)) {
    if (model.supports_json_mode) score += 8;
    if (model.supports_function_calling) score += 8;
  }
  if (/поиск|search|интернет|web|актуальн|новост|browse/i.test(q)) {
    if (model.supports_web_search) score += 15;
  }

  return score;
}

export function rankModelsForQuery(models: Model[], query: string, limit = 40): Model[] {
  const scored = models
    .map((model) => ({ model, score: scoreModelForQuery(model, query) }))
    .sort((a, b) => b.score - a.score);

  const hasMatch = scored.some((s) => s.score > 0);
  if (!hasMatch) {
    return [...models]
      .sort((a, b) => b.task_quality - a.task_quality || a.input_price_per_mtok - b.input_price_per_mtok)
      .slice(0, limit);
  }

  return scored.slice(0, limit).map((s) => s.model);
}
