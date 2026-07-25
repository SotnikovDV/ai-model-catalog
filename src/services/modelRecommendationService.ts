import { modelRepository } from '../models/modelRepository.js';
import { modelRatingRepository } from '../models/modelRatingRepository.js';
import { chatCompletion } from './aiClient.js';
import { getAiConfig, resolveModelForTier } from './aiConfig.js';
import { rankModelsForQuery } from '../utils/modelSearch.js';
import { extractJsonBlock } from '../utils/extractJsonBlock.js';
import { formatChatRatingBadgeForView } from '../utils/modelView.js';
import type { Model } from '../types.js';
import type { RecommendationItem, RecommendationResult } from '../types/ai.js';

interface CompactCandidate {
  id: string;
  name: string;
  family: string;
  modality: string;
  context_window: number;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  supports_vision: boolean;
  supports_function_calling: boolean;
  supports_json_mode: boolean;
  supports_web_search: boolean;
  reasoning: number;
  task_quality: number;
  latency: number;
  code_quality: number;
  rag_compatibility: number;
  multilingual_quality: number;
  use_cases: string[];
  tags: string[];
}

interface LlmRecommendationItem {
  modelId: string;
  rank: number;
  rationale: string;
}

interface LlmRecommendationResponse {
  summary: string;
  items: LlmRecommendationItem[];
}

const PREFILTER_LIMIT = 40;
const MIN_LLM_RESULTS = 3;

function asStringArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function compactModel(model: Model): CompactCandidate {
  return {
    id: model.id,
    name: model.name,
    family: model.family,
    modality: model.modality,
    context_window: model.context_window,
    input_price_per_mtok: model.input_price_per_mtok,
    output_price_per_mtok: model.output_price_per_mtok,
    supports_vision: model.supports_vision,
    supports_function_calling: model.supports_function_calling,
    supports_json_mode: model.supports_json_mode,
    supports_web_search: model.supports_web_search,
    reasoning: model.reasoning,
    task_quality: model.task_quality,
    latency: model.latency,
    code_quality: model.code_quality,
    rag_compatibility: model.rag_compatibility,
    multilingual_quality: model.multilingual_quality,
    use_cases: asStringArray(model.use_cases),
    tags: asStringArray(model.tags),
  };
}

function attachChatRatingFields(
  model: Model,
  ratingsMap: Map<string, { avg: number; count: number }>,
): Model & {
  chat_rating_avg: number | null;
  chat_rating_count: number;
  chat_rating_label: string | null;
  chat_rating_title: string | null;
} {
  const summary = ratingsMap.get(model.id);
  const badge = formatChatRatingBadgeForView(summary?.avg ?? null, summary?.count ?? 0);
  return {
    ...model,
    chat_rating_avg: summary?.avg ?? null,
    chat_rating_count: summary?.count ?? 0,
    chat_rating_label: badge.label,
    chat_rating_title: badge.title,
  };
}

function buildFallbackRationale(model: Model, query: string): string {
  const useCases = asStringArray(model.use_cases);
  const parts: string[] = [];
  if (useCases.length) {
    parts.push(`Подходит для: ${useCases.slice(0, 2).join(', ')}`);
  }
  if (model.context_window >= 100_000) {
    parts.push('большой контекст');
  }
  if (model.input_price_per_mtok === 0 && model.output_price_per_mtok === 0) {
    parts.push('бесплатная');
  }
  if (parts.length === 0) {
    return `Модель ${model.family} с хорошим балансом характеристик для запроса «${query.slice(0, 80)}».`;
  }
  return parts.join('; ') + '.';
}

function buildFallbackItems(
  candidates: Model[],
  query: string,
  limit: number,
  ratingsMap: Map<string, { avg: number; count: number }>,
): RecommendationItem[] {
  return candidates.slice(0, limit).map((model, index) => ({
    modelId: model.id,
    rank: index + 1,
    rationale: buildFallbackRationale(model, query),
    model: attachChatRatingFields(model, ratingsMap),
  }));
}

function hydrateItems(
  llmItems: LlmRecommendationItem[],
  candidateMap: Map<string, Model>,
  limit: number,
  ratingsMap: Map<string, { avg: number; count: number }>,
): RecommendationItem[] {
  const seen = new Set<string>();
  const hydrated: RecommendationItem[] = [];

  const sorted = [...llmItems].sort((a, b) => a.rank - b.rank);

  for (const item of sorted) {
    if (hydrated.length >= limit) break;
    if (!item.modelId || seen.has(item.modelId)) continue;
    const model = candidateMap.get(item.modelId);
    if (!model) continue;
    seen.add(item.modelId);
    hydrated.push({
      modelId: model.id,
      rank: hydrated.length + 1,
      rationale: String(item.rationale || '').trim() || buildFallbackRationale(model, ''),
      model: attachChatRatingFields(model, ratingsMap),
    });
  }

  return hydrated;
}

export async function recommendModels(query: string, limit = 8): Promise<RecommendationResult> {
  const config = getAiConfig();
  const analyticsModel = resolveModelForTier('analytics', config);

  const allModels = modelRepository.findAll();
  const inferenceReady = allModels.filter(
    (m) => !m.is_hidden && m.availability_status === 'inference',
  );
  const candidates = rankModelsForQuery(inferenceReady, query, PREFILTER_LIMIT);
  const candidateMap = new Map(candidates.map((m) => [m.id, m]));
  const ratingsMap = modelRatingRepository.getAverageScoresMap();

  if (candidates.length === 0) {
    return {
      query,
      summary: 'Нет моделей со статусом «Инференс» для подбора. Запустите проверку inference в каталоге.',
      items: [],
      meta: {
        tier: 'analytics',
        model: analyticsModel,
        candidateCount: 0,
      },
    };
  }

  const compact = candidates.map(compactModel);

  const prompt = `Запрос пользователя: «${query}»

Каталог кандидатов (JSON):
${JSON.stringify(compact, null, 0)}

Выбери до ${limit} моделей, наиболее подходящих под запрос.
Верни строго JSON-объект:
{
  "summary": "общий вывод в 1-3 предложениях на русском",
  "items": [
    { "modelId": "<uuid из каталога>", "rank": 1, "rationale": "1-2 предложения почему подходит" }
  ]
}

Правила:
- modelId — только из списка кандидатов
- rationale — на русском, конкретно под запрос пользователя
- учитывай цену, контекст, модальность, рейтинги и use_cases
- учитывай supports_web_search, если нужен встроенный поиск в интернете
- если запрос неоднозначен — выбери универсальные варианты и упомяни это в summary`;

  const llmResult = await chatCompletion({
    tier: 'analytics',
    temperature: 0.2,
    maxTokens: 4096,
    messages: [
      { role: 'system', content: 'Ты эксперт по выбору LLM. Отвечай только валидным JSON.' },
      { role: 'user', content: prompt },
    ],
  });

  let parsed: LlmRecommendationResponse;
  try {
    parsed = extractJsonBlock(llmResult.content) as LlmRecommendationResponse;
  } catch {
    throw new Error('AI вернул некорректный JSON для подбора моделей');
  }

  const summary = String(parsed.summary || '').trim()
    || 'Подобраны модели на основе вашего запроса.';

  let items = hydrateItems(parsed.items || [], candidateMap, limit, ratingsMap);

  if (items.length < MIN_LLM_RESULTS) {
    const usedIds = new Set(items.map((i) => i.modelId));
    const fallbackCandidates = candidates.filter((m) => !usedIds.has(m.id));
    const fallback = buildFallbackItems(fallbackCandidates, query, limit - items.length, ratingsMap);
    items = [...items, ...fallback].map((item, index) => ({ ...item, rank: index + 1 }));
  }

  if (items.length === 0) {
    items = buildFallbackItems(candidates, query, Math.min(limit, candidates.length), ratingsMap);
  }

  return {
    query,
    summary,
    items,
    meta: {
      tier: 'analytics',
      model: llmResult.model || analyticsModel,
      candidateCount: candidates.length,
      usage: llmResult.usage,
    },
  };
}
