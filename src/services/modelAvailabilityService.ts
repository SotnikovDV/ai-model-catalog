import type { Model } from '../types.js';
import type { Provider } from '../types/provider.js';
import type {
  AvailabilityCheckResult,
  AvailabilityMode,
  AvailabilityOptions,
  AvailabilityProbeResult,
  AvailabilityProgressCallback,
  AvailabilityProgressSummary,
  AvailabilityRunResult,
  AvailabilityStalenessFilter,
} from '../types/availability.js';
import { modelRepository } from '../models/modelRepository.js';
import { providerRepository } from '../models/providerRepository.js';
import { probeModelWithConnection } from './aiClient.js';
import { ProviderConnectionError, resolveModelProviderConnection } from './providerConnection.js';
import { getBotHubListEntry } from './catalogSources/bothubListSource.js';
import { getBotHubOpenAiModel } from './catalogSources/bothubOpenAiSource.js';
import { getOpenRouterModelById } from './catalogSources/openRouterSource.js';
import { getRouterAiModelById } from './catalogSources/routerAiSource.js';
import { resolveOpenRouterId } from './modelIdResolver.js';

let availabilityCheckInProgress = false;

const STALENESS_MS: Record<Exclude<AvailabilityStalenessFilter, 'never'>, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  half_year: 182 * 24 * 60 * 60 * 1000,
};

export function isAvailabilityCheckInProgress(): boolean {
  return availabilityCheckInProgress;
}

class AvailabilityAlreadyRunningError extends Error {
  constructor() {
    super('Проверка доступности уже выполняется. Дождитесь завершения текущей операции.');
    this.name = 'AvailabilityAlreadyRunningError';
  }
}

function resolveProviderForModel(model: Model): Provider {
  const provider = model.provider_id
    ? providerRepository.findById(model.provider_id)
    : providerRepository.findByNameOrSlug(model.provider);

  if (!provider) {
    throw new ProviderConnectionError(`Провайдер «${model.provider}» не найден в справочнике`);
  }
  if (!provider.enabled) {
    throw new ProviderConnectionError(`Провайдер «${provider.name}» отключён`);
  }
  return provider;
}

async function isModelInBothubCatalog(modelName: string): Promise<boolean> {
  const listEntry = await getBotHubListEntry(modelName);
  if (listEntry) return true;
  const openAiModel = await getBotHubOpenAiModel(modelName);
  return openAiModel !== null;
}

async function isModelInOpenRouterCatalog(model: Model): Promise<boolean> {
  const externalId = await resolveOpenRouterId(model.name, model.family);
  if (!externalId) return false;
  const catalogEntry = await getOpenRouterModelById(externalId);
  return catalogEntry !== null;
}

async function isModelInRouterAiCatalog(model: Model): Promise<boolean> {
  const externalId = await resolveOpenRouterId(model.name, model.family);
  if (!externalId) return false;
  const catalogEntry = await getRouterAiModelById(externalId);
  return catalogEntry !== null;
}

async function isModelInProviderCatalog(model: Model, provider: Provider): Promise<boolean> {
  switch (provider.catalog_source) {
    case 'bothub':
      return isModelInBothubCatalog(model.name);
    case 'openrouter':
      return isModelInOpenRouterCatalog(model);
    case 'routerai':
      return isModelInRouterAiCatalog(model);
    default:
      return false;
  }
}

function matchesAvailabilityStaleness(model: Model, staleness?: AvailabilityStalenessFilter): boolean {
  if (!staleness) return true;
  if (staleness === 'never') return !model.availability_checked_at;
  const cutoff = Date.now() - STALENESS_MS[staleness];
  return !model.availability_checked_at
    || new Date(model.availability_checked_at).getTime() < cutoff;
}

function filterModelsForAvailability(models: Model[], options: AvailabilityOptions): Model[] {
  let result = models;

  if (options.filter === 'provider' && options.provider) {
    const catalogProvider = providerRepository.findByNameOrSlug(options.provider);
    result = result.filter((m) => {
      if (catalogProvider) {
        return m.provider_id === catalogProvider.id || m.provider === catalogProvider.name;
      }
      return m.provider === options.provider;
    });
  } else if (options.provider) {
    const catalogProvider = providerRepository.findByNameOrSlug(options.provider);
    result = result.filter((m) => {
      if (catalogProvider) {
        return m.provider_id === catalogProvider.id || m.provider === catalogProvider.name;
      }
      return m.provider === options.provider;
    });
  }

  if (options.family) {
    result = result.filter((m) => m.family === options.family);
  }

  if (options.filter === 'empty_description') {
    result = result.filter((m) => !m.description?.trim());
  }

  if (options.staleness) {
    result = result.filter((m) => matchesAvailabilityStaleness(m, options.staleness));
  }

  if (options.catalogAvailability) {
    if (options.catalogAvailability === 'unchecked') {
      result = result.filter((m) => !m.availability_status);
    } else {
      result = result.filter((m) => m.availability_status === options.catalogAvailability);
    }
  }

  if (options.inferenceFilter) {
    switch (options.inferenceFilter) {
      case 'inference':
        result = result.filter((m) => m.availability_status === 'inference');
        break;
      case 'not_inference':
        result = result.filter((m) => m.availability_status != null && m.availability_status !== 'inference');
        break;
      case 'unchecked':
        result = result.filter((m) => m.availability_response_ms == null);
        break;
      default:
        break;
    }
  }

  return result;
}

async function probeCatalogAvailability(model: Model): Promise<AvailabilityProbeResult> {
  const startedMs = Date.now();
  try {
    const provider = resolveProviderForModel(model);
    const found = await isModelInProviderCatalog(model, provider);
    return {
      status: found ? 'available' : 'unavailable',
      responseMs: Date.now() - startedMs,
      error: found ? undefined : `Модель не найдена в каталоге ${provider.name}`,
    };
  } catch (error) {
    return {
      status: 'unavailable',
      responseMs: Date.now() - startedMs,
      error: error instanceof Error ? error.message : 'Ошибка проверки каталога',
    };
  }
}

async function resolveInferenceModelName(model: Model, provider: Provider): Promise<string> {
  if (provider.catalog_source === 'openrouter' || provider.catalog_source === 'routerai') {
    const externalId = await resolveOpenRouterId(model.name, model.family);
    return externalId ?? model.name;
  }
  return model.name;
}

async function probeInferenceAvailability(model: Model): Promise<AvailabilityProbeResult> {
  const startedMs = Date.now();
  const provider = resolveProviderForModel(model);
  const connection = resolveModelProviderConnection(model);
  const inferenceModelName = await resolveInferenceModelName(model, provider);
  const result = await probeModelWithConnection(connection, inferenceModelName);
  return {
    status: 'inference',
    responseMs: Date.now() - startedMs,
    usage: result.usage ? { totalTokens: result.usage.totalTokens } : undefined,
  };
}

async function runInferenceWithCatalogFallback(model: Model): Promise<{
  probe: AvailabilityProbeResult;
  persistMode: AvailabilityMode;
}> {
  try {
    const probe = await probeInferenceAvailability(model);
    return { probe, persistMode: 'inference' };
  } catch {
    const probe = await probeCatalogAvailability(model);
    return { probe, persistMode: 'catalog' };
  }
}

export async function probeModelAvailability(
  model: Model,
  mode: AvailabilityMode,
): Promise<AvailabilityProbeResult> {
  if (mode === 'catalog') {
    return probeCatalogAvailability(model);
  }
  const { probe } = await runInferenceWithCatalogFallback(model);
  return probe;
}

function persistAvailabilityResult(model: Model, mode: AvailabilityMode, probe: AvailabilityProbeResult): Model {
  const checkedAt = new Date().toISOString();
  return modelRepository.update(model.id, {
    availability_checked_at: checkedAt,
    availability_status: probe.status,
    availability_response_ms: mode === 'inference' ? (probe.responseMs ?? null) : null,
    availability_error: probe.error ?? null,
  }) ?? model;
}

export async function checkModelAvailability(
  model: Model,
  mode: AvailabilityMode,
  persist = true,
): Promise<{ probe: AvailabilityProbeResult; model: Model }> {
  if (mode === 'catalog') {
    const probe = await probeCatalogAvailability(model);
    const updated = persist ? persistAvailabilityResult(model, 'catalog', probe) : model;
    return { probe, model: updated };
  }

  const { probe, persistMode } = await runInferenceWithCatalogFallback(model);
  const updated = persist ? persistAvailabilityResult(model, persistMode, probe) : model;
  return { probe, model: updated };
}

function buildResultSummary(results: AvailabilityCheckResult[]): AvailabilityProgressSummary {
  return {
    available: results.filter((r) => r.status === 'available').length,
    inference: results.filter((r) => r.status === 'inference').length,
    unavailable: results.filter((r) => r.status === 'unavailable').length,
    errors: results.filter((r) => r.status === 'error').length,
  };
}

export async function runAvailabilityCheck(
  options: AvailabilityOptions,
  onProgress?: AvailabilityProgressCallback,
  signal?: AbortSignal,
): Promise<AvailabilityRunResult> {
  if (availabilityCheckInProgress) {
    throw new AvailabilityAlreadyRunningError();
  }

  availabilityCheckInProgress = true;
  try {
    const models = filterModelsForAvailability(modelRepository.findAll(), options);
    const results: AvailabilityCheckResult[] = [];
    const delayMs = options.delayMs ?? 200;
    let cancelled = false;

    onProgress?.({
      type: 'start',
      current: 0,
      total: models.length,
      modelName: '',
      summary: buildResultSummary(results),
    });

    for (let index = 0; index < models.length; index += 1) {
      if (signal?.aborted) {
        cancelled = true;
        break;
      }

      const model = models[index];
      let checkResult: AvailabilityCheckResult;

      try {
        const { probe } = await checkModelAvailability(model, options.mode, true);
        checkResult = {
          modelId: model.id,
          name: model.name,
          status: probe.status,
          responseMs: probe.responseMs,
          error: probe.error,
          usage: probe.usage,
        };
      } catch (error) {
        checkResult = {
          modelId: model.id,
          name: model.name,
          status: 'error',
          error: error instanceof Error ? error.message : 'Неизвестная ошибка',
        };
      }

      results.push(checkResult);
      onProgress?.({
        type: 'progress',
        current: index + 1,
        total: models.length,
        modelName: model.name,
        status: checkResult.status,
        message: checkResult.error,
        summary: buildResultSummary(results),
      });

      if (delayMs > 0 && index < models.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return {
      ...buildResultSummary(results),
      results,
      cancelled: cancelled || undefined,
    };
  } finally {
    availabilityCheckInProgress = false;
  }
}
