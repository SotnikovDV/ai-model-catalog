import type { BotHubListEntry } from './types.js';
import { providerRepository } from '../../models/providerRepository.js';

export const FALLBACK_BOTHUB_LIST_URL = 'https://bothub.chat/api/v2/model/list';

interface BotHubNode {
  id: string;
  label?: string;
  features?: string[];
  children?: Array<{ id: string; features?: string[] }>;
  providers?: unknown[];
}

let cache: BotHubListEntry[] | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

function getListUrl(): string {
  const provider = providerRepository.findBySlug('bothub');
  if (provider?.enabled && provider.models_url.trim()) {
    return provider.models_url.trim();
  }
  return FALLBACK_BOTHUB_LIST_URL;
}

function flattenNodes(nodes: BotHubNode[]): BotHubListEntry[] {
  const result: BotHubListEntry[] = [];

  for (const node of nodes) {
    if (node.children?.length) {
      for (const child of node.children) {
        result.push({
          id: child.id,
          label: node.label,
          features: child.features ?? node.features ?? [],
          parentLabel: node.label,
        });
      }
    } else if (node.providers?.length) {
      continue;
    } else {
      result.push({
        id: node.id,
        label: node.label,
        features: node.features ?? [],
      });
    }
  }

  return result;
}

export async function fetchBotHubList(force = false): Promise<BotHubListEntry[]> {
  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cache;
  }

  const response = await fetch(getListUrl());
  if (!response.ok) {
    throw new Error(`BotHub list API: HTTP ${response.status}`);
  }

  const payload = await response.json() as BotHubNode[];
  cache = flattenNodes(payload);
  cacheAt = Date.now();
  return cache;
}

export async function getBotHubListEntry(name: string): Promise<BotHubListEntry | null> {
  const list = await fetchBotHubList();
  return list.find((entry) => entry.id === name) ?? null;
}

export function clearBotHubListCache(): void {
  cache = null;
  cacheAt = 0;
}
