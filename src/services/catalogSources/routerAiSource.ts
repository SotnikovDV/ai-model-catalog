import type { NormalizedCatalogData, OpenRouterModel } from './types.js';
import { normalizeOpenRouterModel } from './openRouterSource.js';
import { providerRepository } from '../../models/providerRepository.js';

export const FALLBACK_ROUTERAI_URL = 'https://routerai.ru/api/v1/models';

let cache: OpenRouterModel[] | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function getRouterAiProvider() {
  return providerRepository.findBySlug('routerai');
}

function getCatalogUrl(): string {
  const provider = getRouterAiProvider();
  if (provider?.enabled && provider.models_url.trim()) {
    return provider.models_url.trim();
  }
  return FALLBACK_ROUTERAI_URL;
}

function buildRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'ai-model-catalog/0.1',
  };
  const apiKey = getRouterAiProvider()?.api_key?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

export async function fetchRouterAiCatalog(force = false): Promise<OpenRouterModel[]> {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cache;
  }

  const url = getCatalogUrl();
  try {
    const response = await fetch(url, { headers: buildRequestHeaders() });
    if (!response.ok) {
      console.warn(`[routerai] RouterAI API: HTTP ${response.status} (${url})`);
      if (cache) return cache;
      return [];
    }

    const payload = await response.json() as { data?: OpenRouterModel[] };
    cache = payload.data ?? [];
    cacheAt = Date.now();
    return cache;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'RouterAI API: сетевая ошибка';
    console.warn(`[routerai] ${message} (${url})`);
    if (cache) return cache;
    return [];
  }
}

export async function getRouterAiModelById(externalId: string): Promise<NormalizedCatalogData | null> {
  const catalog = await fetchRouterAiCatalog();
  const model = catalog.find((m) => m.id === externalId);
  if (!model) return null;

  const normalized = normalizeOpenRouterModel(model);
  return {
    ...normalized,
    sources: ['routerai'],
  };
}

export function clearRouterAiCache(): void {
  cache = null;
  cacheAt = 0;
}
