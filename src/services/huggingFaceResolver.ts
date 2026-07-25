import { fetchOpenRouterCatalog } from './catalogSources/openRouterSource.js';
import { resolveOpenRouterId } from './modelIdResolver.js';

const HF_BASE = 'https://huggingface.co';

export type HuggingFaceResolveSource = 'openrouter' | 'huggingface' | 'search';

export interface HuggingFaceResolveResult {
  url: string;
  source: HuggingFaceResolveSource;
  label?: string;
}

const cache = new Map<string, HuggingFaceResolveResult>();

function normalizeToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function scoreHfModel(catalogName: string, hfId: string): number {
  const name = normalizeToken(catalogName);
  const suffix = normalizeToken(hfId.split('/').pop() ?? hfId);
  if (!name || !suffix) return 0;
  if (suffix === name) return 100;
  if (suffix.startsWith(name) || name.startsWith(suffix)) return 85;
  if (suffix.includes(name) || name.includes(suffix)) return 70;
  if (hfId.toLowerCase().includes(catalogName.toLowerCase())) return 55;
  return 0;
}

function buildGoogleSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:huggingface.co ${query}`)}`;
}

async function resolveFromOpenRouter(
  catalogName: string,
  family?: string,
): Promise<HuggingFaceResolveResult | null> {
  const openRouterId = await resolveOpenRouterId(catalogName, family);
  if (!openRouterId) return null;

  const catalog = await fetchOpenRouterCatalog();
  const model = catalog.find((item) => item.id === openRouterId);
  const hfId = model?.hugging_face_id?.trim();
  if (!hfId) return null;

  return {
    url: `${HF_BASE}/${hfId}`,
    source: 'openrouter',
    label: hfId,
  };
}

async function resolveFromHfSearch(catalogName: string): Promise<HuggingFaceResolveResult | null> {
  const response = await fetch(
    `${HF_BASE}/api/models?search=${encodeURIComponent(catalogName)}&limit=12`,
    { headers: { Accept: 'application/json' } },
  );
  if (!response.ok) return null;

  const models = await response.json() as Array<{ id?: string; modelId?: string }>;
  let best: { id: string; score: number } | null = null;

  for (const item of models) {
    const id = item.modelId ?? item.id;
    if (!id) continue;
    const score = scoreHfModel(catalogName, id);
    if (!best || score > best.score) {
      best = { id, score };
    }
  }

  if (!best || best.score < 55) return null;

  return {
    url: `${HF_BASE}/${best.id}`,
    source: 'huggingface',
    label: best.id,
  };
}

export async function resolveHuggingFaceUrl(
  catalogName: string,
  family?: string,
): Promise<HuggingFaceResolveResult> {
  const cacheKey = `${family ?? ''}:${catalogName}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const fromOpenRouter = await resolveFromOpenRouter(catalogName, family);
    if (fromOpenRouter) {
      cache.set(cacheKey, fromOpenRouter);
      return fromOpenRouter;
    }
  } catch {
    // OpenRouter может быть недоступен — пробуем Hugging Face API.
  }

  try {
    const fromSearch = await resolveFromHfSearch(catalogName);
    if (fromSearch) {
      cache.set(cacheKey, fromSearch);
      return fromSearch;
    }
  } catch {
    // HF API may be unavailable — fall back to Google site search.
  }

  const fallback: HuggingFaceResolveResult = {
    url: buildGoogleSearchUrl(catalogName),
    source: 'search',
  };
  cache.set(cacheKey, fallback);
  return fallback;
}
