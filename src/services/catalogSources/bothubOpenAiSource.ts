import type { BotHubOpenAiModel } from './types.js';
import { getSyncConfig } from '../syncConfig.js';
import { providerRepository } from '../../models/providerRepository.js';

const FALLBACK_BOTHUB_OPENAI_MODELS_URL = 'https://openai.bothub.chat/v1/models';

let cache: BotHubOpenAiModel[] | null = null;
let cacheAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface OpenAiModelsResponse {
  data?: BotHubOpenAiModel[];
}

function getModelsUrl(): string {
  const provider = providerRepository.findBySlug('bothub');
  if (provider?.enabled && provider.base_url.trim()) {
    return `${provider.base_url.trim().replace(/\/+$/, '')}/models`;
  }
  return FALLBACK_BOTHUB_OPENAI_MODELS_URL;
}

export async function fetchBotHubOpenAiModels(force = false): Promise<BotHubOpenAiModel[] | null> {
  const { bothubApiKey } = getSyncConfig();
  if (!bothubApiKey) return null;

  if (!force && cache && Date.now() - cacheAt < CACHE_TTL_MS) {
    return cache;
  }

  const response = await fetch(getModelsUrl(), {
    headers: {
      Authorization: `Bearer ${bothubApiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 401) return null;
    throw new Error(`BotHub OpenAI API: HTTP ${response.status}`);
  }

  const payload = await response.json() as OpenAiModelsResponse;
  cache = payload.data ?? [];
  cacheAt = Date.now();
  return cache;
}

export async function getBotHubOpenAiModel(name: string): Promise<BotHubOpenAiModel | null> {
  const models = await fetchBotHubOpenAiModels();
  if (!models) return null;
  return models.find((m) => m.id === name) ?? null;
}

export function clearBotHubOpenAiCache(): void {
  cache = null;
  cacheAt = 0;
}
