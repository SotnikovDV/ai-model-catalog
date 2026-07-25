import type { Model } from '../types.js';
import { providerRepository } from '../models/providerRepository.js';

export interface ProviderConnection {
  baseUrl: string;
  apiKey: string;
  providerName: string;
}

export class ProviderConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderConnectionError';
  }
}

export function resolveModelProviderConnection(model: Model): ProviderConnection {
  const provider = model.provider_id
    ? providerRepository.findById(model.provider_id)
    : providerRepository.findByNameOrSlug(model.provider);

  if (!provider) {
    throw new ProviderConnectionError(`Провайдер «${model.provider}» не найден в справочнике`);
  }

  if (!provider.enabled) {
    throw new ProviderConnectionError(`Провайдер «${provider.name}» отключён`);
  }

  const baseUrl = provider.base_url.trim();
  if (!baseUrl) {
    throw new ProviderConnectionError(`У провайдера «${provider.name}» не задан Base URL`);
  }

  const apiKey = provider.api_key.trim();
  if (!apiKey) {
    throw new ProviderConnectionError(`Настройте API-ключ провайдера «${provider.name}»`);
  }

  return {
    baseUrl,
    apiKey,
    providerName: provider.name,
  };
}
