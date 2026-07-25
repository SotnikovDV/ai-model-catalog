import type { NormalizedCatalogData, OpenRouterModel } from './types.js';
import { inferFamilyFromOpenRouterId } from '../../utils/inferFamily.js';
import { getSyncConfig, usdPerTokenToRubPerMtok } from '../syncConfig.js';
import { providerRepository } from '../../models/providerRepository.js';

export const FALLBACK_OPENROUTER_URL = 'https://openrouter.ai/api/v1/models';

let cache: OpenRouterModel[] | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;
let lastFetchError: string | null = null;

function getOpenRouterProvider() {
  return providerRepository.findBySlug('openrouter');
}

function getCatalogUrl(): string {
  const provider = getOpenRouterProvider();
  if (provider?.enabled && provider.models_url.trim()) {
    return provider.models_url.trim();
  }
  return FALLBACK_OPENROUTER_URL;
}

function buildRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'ai-model-catalog/0.1',
  };
  const apiKey = getOpenRouterProvider()?.api_key?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

export function getOpenRouterLastFetchError(): string | null {
  return lastFetchError;
}

function parseUsdPrice(value: string | number | undefined): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function mapModality(architecture?: OpenRouterModel['architecture']): NormalizedCatalogData['modality'] {
  const modality = architecture?.modality ?? '';
  const inputs = architecture?.input_modalities ?? [];
  const outputs = architecture?.output_modalities ?? [];

  const hasImage = inputs.includes('image') || outputs.includes('image');
  const hasAudio = inputs.includes('audio') || outputs.includes('audio');
  const hasVideo = inputs.includes('video') || outputs.includes('video');
  const count = [hasImage, hasAudio, hasVideo, inputs.includes('text')].filter(Boolean).length;

  if (count > 1 || modality.includes('multimodal')) return 'multimodal';
  if (hasImage && !inputs.includes('text')) return 'image';
  if (hasAudio) return 'audio';
  if (hasVideo) return 'video';
  if (modality.includes('image')) return 'image';
  return 'text';
}

function unixToDate(unix?: number): string | undefined {
  if (!unix) return undefined;
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

export function normalizeOpenRouterModel(model: OpenRouterModel): NormalizedCatalogData {
  const { usdToRubRate } = getSyncConfig();
  const promptUsd = parseUsdPrice(model.pricing?.prompt);
  const completionUsd = parseUsdPrice(model.pricing?.completion);
  const params = model.supported_parameters ?? [];

  const tags = new Set<string>();
  for (const p of params) tags.add(p);
  if (model.id.endsWith(':free')) tags.add('free');

  return {
    family: inferFamilyFromOpenRouterId(model.id),
    modality: mapModality(model.architecture),
    context_window: model.context_length,
    max_output_tokens: model.top_provider?.max_completion_tokens,
    input_price_per_mtok: promptUsd !== undefined ? usdPerTokenToRubPerMtok(promptUsd, usdToRubRate) : undefined,
    output_price_per_mtok: completionUsd !== undefined ? usdPerTokenToRubPerMtok(completionUsd, usdToRubRate) : undefined,
    supports_vision: (model.architecture?.input_modalities ?? []).includes('image'),
    supports_function_calling: params.includes('tools') || params.includes('tool_choice'),
    supports_json_mode: params.includes('structured_outputs') || params.includes('response_format'),
    supports_streaming: true,
    supports_web_search: params.includes('web_search_options'),
    release_date: unixToDate(model.created),
    description: model.description?.trim() || undefined,
    tags: [...tags],
    sources: ['openrouter'],
  };
}

export async function fetchOpenRouterCatalog(force = false): Promise<OpenRouterModel[]> {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cache;
  }

  const url = getCatalogUrl();
  try {
    const response = await fetch(url, { headers: buildRequestHeaders() });
    if (!response.ok) {
      lastFetchError = `OpenRouter API: HTTP ${response.status}`;
      console.warn(`[openrouter] ${lastFetchError} (${url})`);
      if (cache) return cache;
      return [];
    }

    const payload = await response.json() as { data?: OpenRouterModel[] };
    cache = payload.data ?? [];
    cacheAt = Date.now();
    lastFetchError = null;
    return cache;
  } catch (error) {
    lastFetchError = error instanceof Error ? error.message : 'OpenRouter API: сетевая ошибка';
    console.warn(`[openrouter] ${lastFetchError} (${url})`);
    if (cache) return cache;
    return [];
  }
}

export async function getOpenRouterModelById(externalId: string): Promise<NormalizedCatalogData | null> {
  const catalog = await fetchOpenRouterCatalog();
  const model = catalog.find((m) => m.id === externalId);
  return model ? normalizeOpenRouterModel(model) : null;
}

export function clearOpenRouterCache(): void {
  cache = null;
  cacheAt = 0;
}
