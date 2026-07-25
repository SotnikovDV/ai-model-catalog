import { OPENROUTER_PROVIDER_FAMILY } from '../utils/inferFamily.js';
import { fetchOpenRouterCatalog } from './catalogSources/openRouterSource.js';
import { inferFamily } from '../utils/inferFamily.js';

const FAMILY_PREFIXES: Record<string, string[]> = {};
for (const [provider, family] of Object.entries(OPENROUTER_PROVIDER_FAMILY)) {
  if (!FAMILY_PREFIXES[family]) FAMILY_PREFIXES[family] = [];
  if (!FAMILY_PREFIXES[family].includes(provider)) {
    FAMILY_PREFIXES[family].push(provider);
  }
}

const resolveCache = new Map<string, string | null>();

function scoreCandidate(catalogName: string, externalId: string): number {
  const suffix = externalId.split('/').pop() ?? externalId;
  if (suffix === catalogName) return 100;
  if (suffix.startsWith(`${catalogName}-`)) return 80;
  if (suffix.includes(catalogName)) return 60;
  if (externalId.endsWith(`/${catalogName}`)) return 90;
  return 0;
}

export async function resolveOpenRouterId(catalogName: string, family?: string): Promise<string | null> {
  const cacheKey = `${family ?? ''}:${catalogName}`;
  if (resolveCache.has(cacheKey)) {
    return resolveCache.get(cacheKey) ?? null;
  }

  const catalog = await fetchOpenRouterCatalog();
  const inferredFamily = family || inferFamily(catalogName);
  const prefixes = FAMILY_PREFIXES[inferredFamily] ?? [];

  const candidates: Array<{ id: string; score: number }> = [];

  for (const model of catalog) {
    let score = scoreCandidate(catalogName, model.id);
    const provider = model.id.split('/')[0];
    if (prefixes.includes(provider)) score += 10;
    if (score > 0) candidates.push({ id: model.id, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0]?.score >= 60 ? candidates[0].id : null;
  resolveCache.set(cacheKey, best);
  return best;
}

export function clearResolverCache(): void {
  resolveCache.clear();
}
