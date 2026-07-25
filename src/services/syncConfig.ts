import { settingsRepository } from '../models/settingsRepository.js';
import { providerRepository } from '../models/providerRepository.js';
import { getAiConfig } from './aiConfig.js';

const SETTINGS_KEYS = {
  usdToRubRate: 'sync.usd_to_rub_rate',
} as const;

const DEFAULT_USD_TO_RUB = 105;

export interface SyncConfig {
  usdToRubRate: number;
  bothubApiKey: string | null;
  bothubApiAvailable: boolean;
}

export interface SyncConfigPublic {
  usdToRubRate: number;
}

export function getSyncConfigPublic(): SyncConfigPublic {
  return { usdToRubRate: getSyncConfig().usdToRubRate };
}

export function updateSyncConfig(usdToRubRate: number): SyncConfigPublic {
  settingsRepository.set(SETTINGS_KEYS.usdToRubRate, String(usdToRubRate));
  return getSyncConfigPublic();
}

export function getSyncConfig(): SyncConfig {
  const ai = getAiConfig();
  const rateRaw = settingsRepository.get(SETTINGS_KEYS.usdToRubRate);
  const usdToRubRate = rateRaw ? Number(rateRaw) : DEFAULT_USD_TO_RUB;

  const bothubProvider = providerRepository.getBotHub();
  const providerKey = bothubProvider?.api_key?.trim() ?? '';
  const isBothubUrl = /(?:openai\.)?bothub\.(?:chat|ru)/i.test(ai.baseUrl);
  const bothubApiKey = providerKey || (isBothubUrl && ai.apiKey ? ai.apiKey : null);

  return {
    usdToRubRate: Number.isFinite(usdToRubRate) && usdToRubRate > 0 ? usdToRubRate : DEFAULT_USD_TO_RUB,
    bothubApiKey,
    bothubApiAvailable: Boolean(bothubApiKey),
  };
}

export function usdPerTokenToRubPerMtok(usdPerToken: number, rate: number): number {
  return Math.round(usdPerToken * 1_000_000 * rate);
}

export function usdPerMtokToRubPerMtok(usdPerM: number, rate: number): number {
  return Math.round(usdPerM * rate);
}
