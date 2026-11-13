import { settingsRepository } from '../models/settingsRepository.js';
import type { AiConfig, AiConfigInput, AiConfigPublic, AiModelTier } from '../types/ai.js';

const SETTINGS_KEYS = {
  enabled: 'ai.enabled',
  baseUrl: 'ai.base_url',
  apiKey: 'ai.api_key',
  modelSimple: 'ai.model_simple',
  modelAnalytics: 'ai.model_analytics',
  searchBaseUrl: 'ai.search_base_url',
  searchApiKey: 'ai.search_api_key',
  modelSearch: 'ai.model_search',
} as const;

const ENV_DEFAULTS = {
  enabled: process.env.AI_ENABLED === 'true',
  baseUrl: process.env.AI_BASE_URL ?? 'https://api.openai.com/v1',
  apiKey: process.env.AI_API_KEY ?? '',
  modelSimple: process.env.AI_MODEL_SIMPLE ?? 'gpt-4o-mini',
  modelAnalytics: process.env.AI_MODEL_ANALYTICS ?? 'gpt-4o',
  searchBaseUrl: process.env.AI_SEARCH_BASE_URL ?? 'https://api.perplexity.ai',
  searchApiKey: process.env.AI_SEARCH_API_KEY ?? '',
  modelSearch: process.env.AI_MODEL_SEARCH ?? '',
};

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback;
  return value === '1' || value === 'true';
}

function maskApiKey(apiKey: string): string | null {
  if (!apiKey) return null;
  if (apiKey.length <= 4) return '****';
  return `${'*'.repeat(Math.min(apiKey.length - 4, 12))}${apiKey.slice(-4)}`;
}

export function getAiConfig(): AiConfig {
  const stored = settingsRepository.getMany(Object.values(SETTINGS_KEYS));

  const apiKey = stored[SETTINGS_KEYS.apiKey] ?? ENV_DEFAULTS.apiKey;
  const searchApiKey = stored[SETTINGS_KEYS.searchApiKey] ?? ENV_DEFAULTS.searchApiKey;

  return {
    enabled: parseBoolean(stored[SETTINGS_KEYS.enabled], ENV_DEFAULTS.enabled),
    baseUrl: stored[SETTINGS_KEYS.baseUrl] ?? ENV_DEFAULTS.baseUrl,
    apiKey,
    modelSimple: stored[SETTINGS_KEYS.modelSimple] ?? ENV_DEFAULTS.modelSimple,
    modelAnalytics: stored[SETTINGS_KEYS.modelAnalytics] ?? ENV_DEFAULTS.modelAnalytics,
    searchBaseUrl: (stored[SETTINGS_KEYS.searchBaseUrl] ?? ENV_DEFAULTS.searchBaseUrl).trim(),
    searchApiKey,
    modelSearch: (stored[SETTINGS_KEYS.modelSearch] ?? ENV_DEFAULTS.modelSearch).trim(),
  };
}

/** Эффективный BASE_URL/API_KEY для модели с поиском (fallback на основной провайдер). */
export function resolveSearchConnection(config: AiConfig = getAiConfig()): {
  baseUrl: string;
  apiKey: string;
} {
  return {
    baseUrl: config.searchBaseUrl || config.baseUrl,
    apiKey: config.searchApiKey || config.apiKey,
  };
}

export function isSearchConfigured(config: AiConfig = getAiConfig()): boolean {
  if (!config.modelSearch) return false;
  const connection = resolveSearchConnection(config);
  return Boolean(connection.baseUrl && connection.apiKey);
}

export function getAiConfigPublic(): AiConfigPublic {
  const config = getAiConfig();
  const configured = Boolean(config.baseUrl && config.apiKey && config.modelSimple && config.modelAnalytics);

  return {
    enabled: config.enabled,
    baseUrl: config.baseUrl,
    apiKeySet: Boolean(config.apiKey),
    apiKeyHint: maskApiKey(config.apiKey),
    modelSimple: config.modelSimple,
    modelAnalytics: config.modelAnalytics,
    searchBaseUrl: config.searchBaseUrl,
    searchApiKeySet: Boolean(config.searchApiKey),
    searchApiKeyHint: maskApiKey(config.searchApiKey),
    modelSearch: config.modelSearch,
    searchConfigured: isSearchConfigured(config),
    configured,
  };
}

export function updateAiConfig(input: AiConfigInput): AiConfigPublic {
  const current = getAiConfig();
  const next: AiConfig = {
    enabled: input.enabled ?? current.enabled,
    baseUrl: input.baseUrl ?? current.baseUrl,
    apiKey: current.apiKey,
    modelSimple: input.modelSimple ?? current.modelSimple,
    modelAnalytics: input.modelAnalytics ?? current.modelAnalytics,
    searchBaseUrl: input.searchBaseUrl !== undefined
      ? input.searchBaseUrl.trim()
      : current.searchBaseUrl,
    searchApiKey: current.searchApiKey,
    modelSearch: input.modelSearch !== undefined
      ? input.modelSearch.trim()
      : current.modelSearch,
  };

  if (input.apiKey !== undefined && input.apiKey.trim() !== '') {
    next.apiKey = input.apiKey.trim();
  }

  if (input.searchApiKey !== undefined) {
    // Пустая строка сбрасывает отдельный ключ → fallback на AI_API_KEY
    next.searchApiKey = input.searchApiKey.trim();
  }

  settingsRepository.setMany({
    [SETTINGS_KEYS.enabled]: next.enabled ? '1' : '0',
    [SETTINGS_KEYS.baseUrl]: next.baseUrl,
    [SETTINGS_KEYS.apiKey]: next.apiKey,
    [SETTINGS_KEYS.modelSimple]: next.modelSimple,
    [SETTINGS_KEYS.modelAnalytics]: next.modelAnalytics,
    [SETTINGS_KEYS.searchBaseUrl]: next.searchBaseUrl,
    [SETTINGS_KEYS.searchApiKey]: next.searchApiKey,
    [SETTINGS_KEYS.modelSearch]: next.modelSearch,
  });

  return getAiConfigPublic();
}

export function resolveModelForTier(tier: AiModelTier, config: AiConfig = getAiConfig()): string {
  if (tier === 'search') return config.modelSearch;
  return tier === 'analytics' ? config.modelAnalytics : config.modelSimple;
}

export function assertAiConfigured(config: AiConfig = getAiConfig()): void {
  if (!config.enabled) {
    throw new Error('AI-провайдер отключён. Включите его в настройках администратора.');
  }
  if (!config.baseUrl || !config.apiKey) {
    throw new Error('AI-провайдер не настроен: укажите URL API и ключ доступа.');
  }
  if (!config.modelSimple || !config.modelAnalytics) {
    throw new Error('AI-провайдер не настроен: укажите обе модели.');
  }
}

export function assertSearchConfigured(config: AiConfig = getAiConfig()): void {
  if (!config.enabled) {
    throw new Error('AI-провайдер отключён. Включите его в настройках администратора.');
  }
  if (!config.modelSearch) {
    throw new Error('Модель с поиском не настроена: укажите AI_MODEL_SEARCH или задайте её в админке.');
  }
  const connection = resolveSearchConnection(config);
  if (!connection.baseUrl || !connection.apiKey) {
    throw new Error(
      'Модель с поиском не настроена: укажите AI_SEARCH_BASE_URL / AI_SEARCH_API_KEY '
      + 'или основной AI_BASE_URL / AI_API_KEY.',
    );
  }
}
