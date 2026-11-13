import type { Model, ModelInput } from '../types.js';
import type {
  EnrichedPartial,
  StalenessFilter,
  SyncableField,
  SyncFieldDiff,
  SyncModelResult,
  SyncOptions,
  SyncProgressCallback,
  SyncProgressSummary,
  SyncResult,
} from '../types/sync.js';
import { SYNCABLE_FIELDS } from '../types/sync.js';
import { modelRepository } from '../models/modelRepository.js';
import { providerRepository } from '../models/providerRepository.js';
import { inferFamily, resolveFamily } from '../utils/inferFamily.js';
import { resolveOpenRouterId } from './modelIdResolver.js';
import { getOpenRouterLastFetchError, getOpenRouterModelById } from './catalogSources/openRouterSource.js';
import { getRouterAiModelById } from './catalogSources/routerAiSource.js';
import { getBotHubListEntry, fetchBotHubList } from './catalogSources/bothubListSource.js';
import { getBotHubOpenAiModel } from './catalogSources/bothubOpenAiSource.js';
import { fetchBotHubPageData } from './catalogSources/bothubPageSource.js';
import {
  mergeCatalogData,
  normalizeBotHubListEntry,
  normalizeBotHubOpenAiModel,
  normalizeBotHubPageData,
} from './catalogNormalizer.js';
import { enrichWithAi } from './aiEnrichmentService.js';
import { normalizeUseCases } from '../utils/useCaseTaxonomy.js';
import { ModelSchema } from '../types.js';
import { normalizeModelName } from '../utils/normalizeModelName.js';
import { isBatchInferenceModelId } from '../utils/modelIdVariants.js';

let syncInProgress = false;

export function isSyncInProgress(): boolean {
  return syncInProgress;
}

class SyncAlreadyRunningError extends Error {
  constructor() {
    super('Синхронизация уже выполняется. Дождитесь завершения текущей операции.');
    this.name = 'SyncAlreadyRunningError';
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Операция отменена');
    error.name = 'AbortError';
    throw error;
  }
}

const AI_FIELDS = new Set<string>([
  'reasoning', 'task_quality', 'latency', 'generation_speed', 'hallucinations',
  'instruction_following', 'code_quality', 'multilingual_quality', 'robustness',
  'rag_compatibility', 'use_cases', 'pros', 'cons', 'benchmarks',
]);

const CAPABILITY_FIELDS = new Set<string>([
  'supports_vision',
  'supports_function_calling',
  'supports_json_mode',
  'supports_streaming',
  'supports_web_search',
]);

const STALENESS_MS: Record<Exclude<StalenessFilter, 'never'>, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  half_year: 182 * 24 * 60 * 60 * 1000,
};

function matchesStaleness(model: Model, staleness?: StalenessFilter): boolean {
  if (!staleness) return true;
  if (staleness === 'never') return !model.info_updated_at;
  const cutoff = Date.now() - STALENESS_MS[staleness];
  return !model.info_updated_at || new Date(model.info_updated_at).getTime() < cutoff;
}

function isEmptyValue(model: Model, field: SyncableField): boolean {
  const value = model[field as keyof Model];
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') {
    if (field === 'modality' && value === 'text' && model.supports_vision) {
      return true;
    }
    return value.trim() === '';
  }
  if (typeof value === 'number') {
    if (
      field.includes('price')
      || field === 'context_window'
      || field === 'max_output_tokens'
    ) {
      return value === 0;
    }
    return false;
  }
  if (typeof value === 'boolean') {
    if (CAPABILITY_FIELDS.has(field)) {
      return value === false;
    }
    return false;
  }
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

function buildDiff(before: Model, patch: EnrichedPartial, fields: SyncableField[]): SyncFieldDiff[] {
  const diff: SyncFieldDiff[] = [];
  for (const field of fields) {
    if (!(field in patch)) continue;
    const after = patch[field as keyof EnrichedPartial];
    const prev = before[field as keyof Model];
    if (JSON.stringify(prev) !== JSON.stringify(after)) {
      diff.push({ field, before: prev, after });
    }
  }
  return diff;
}

function pickFields(source: EnrichedPartial, fields: SyncableField[]): EnrichedPartial {
  const patch: EnrichedPartial = {};
  for (const field of fields) {
    if (field in source && source[field as keyof EnrichedPartial] !== undefined) {
      (patch as Record<string, unknown>)[field] = source[field as keyof EnrichedPartial];
    }
  }
  return patch;
}

function formatSyncMessage(
  baseMessage: string | undefined,
  includeOpenRouterWarning: boolean,
): string | undefined {
  if (!includeOpenRouterWarning) return baseMessage;
  const warning = getOpenRouterLastFetchError();
  if (!warning) return baseMessage;
  const suffix = `OpenRouter недоступен (${warning})`;
  return baseMessage ? `${baseMessage}. ${suffix}` : suffix;
}

function applyOnlyEmpty(model: Model, patch: EnrichedPartial, onlyEmpty: boolean): EnrichedPartial {
  if (!onlyEmpty) return patch;
  const result: EnrichedPartial = {};
  for (const [key, value] of Object.entries(patch)) {
    if (isEmptyValue(model, key as SyncableField)) {
      (result as Record<string, unknown>)[key] = value;
    }
  }
  return result;
}

async function fetchExternalData(model: Model): Promise<EnrichedPartial> {
  const bothubList = await getBotHubListEntry(model.name);
  const bothubOpenAi = await getBotHubOpenAiModel(model.name);
  const bothubPage = await fetchBotHubPageData(model.name);

  const openRouterId = await resolveOpenRouterId(model.name, model.family);
  const openRouter = openRouterId ? await getOpenRouterModelById(openRouterId) : null;
  const routerAi = openRouterId ? await getRouterAiModelById(openRouterId) : null;

  const merged = mergeCatalogData(
    openRouter,
    routerAi,
    bothubList ? normalizeBotHubListEntry(bothubList) : null,
    bothubOpenAi ? normalizeBotHubOpenAiModel(bothubOpenAi) : null,
    bothubPage ? normalizeBotHubPageData(bothubPage) : null,
  );

  const patch: EnrichedPartial = {
    family: resolveFamily(merged.family, inferFamily(model.name)),
    modality: merged.modality,
    context_window: merged.context_window,
    max_output_tokens: merged.max_output_tokens,
    input_price_per_mtok: merged.input_price_per_mtok,
    output_price_per_mtok: merged.output_price_per_mtok,
    supports_vision: merged.supports_vision,
    supports_function_calling: merged.supports_function_calling,
    supports_json_mode: merged.supports_json_mode,
    supports_streaming: merged.supports_streaming,
    supports_web_search: merged.supports_web_search,
    release_date: merged.release_date,
    description: merged.description,
    tags: merged.tags,
  };

  return patch;
}

function buildResultSummary(results: SyncModelResult[]): SyncProgressSummary {
  return {
    updated: results.filter((r) => r.status === 'updated').length,
    created: results.filter((r) => r.status === 'created').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter((r) => r.status === 'error').length,
  };
}

function filterModels(models: Model[], options: SyncOptions): Model[] {
  let result = models;

  if (options.provider) {
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
    result = result.filter((m) => matchesStaleness(m, options.staleness));
  }

  return result;
}

export async function enrichSingleModel(
  model: Model,
  options: SyncOptions,
): Promise<SyncModelResult> {
  const fields = options.fields.filter((f): f is SyncableField =>
    (SYNCABLE_FIELDS as readonly string[]).includes(f),
  );

  if (fields.length === 0) {
    return { name: model.name, modelId: model.id, status: 'skipped', message: 'Не выбраны поля' };
  }

  try {
    const externalFields = fields.filter((f) => !AI_FIELDS.has(f));
    const aiFields = fields.filter((f) => AI_FIELDS.has(f));
    const usedExternalSources = externalFields.length > 0;

    let patch = usedExternalSources
      ? pickFields(await fetchExternalData(model), externalFields)
      : {};

    if (aiFields.length > 0) {
      const aiPatch = await enrichWithAi(model, patch, aiFields);
      patch = { ...patch, ...pickFields(aiPatch, aiFields) };
    }

    patch = applyOnlyEmpty(model, patch, Boolean(options.onlyEmpty));
    if (patch.use_cases) {
      patch = { ...patch, use_cases: normalizeUseCases(patch.use_cases) };
    }
    const diff = buildDiff(model, patch, fields);

    if (diff.length === 0) {
      return {
        name: model.name,
        modelId: model.id,
        status: 'skipped',
        message: formatSyncMessage('Нет изменений', usedExternalSources),
      };
    }

    if (options.dryRun) {
      return {
        name: model.name,
        modelId: model.id,
        status: 'updated',
        diff,
        message: formatSyncMessage('Предпросмотр', usedExternalSources),
      };
    }

    const updated = modelRepository.update(model.id, {
      ...patch,
      info_updated_at: new Date().toISOString(),
    });
    return {
      name: model.name,
      modelId: updated?.id ?? model.id,
      status: 'updated',
      diff,
      message: formatSyncMessage(undefined, usedExternalSources),
    };
  } catch (error) {
    return {
      name: model.name,
      modelId: model.id,
      status: 'error',
      message: error instanceof Error ? error.message : 'Неизвестная ошибка',
    };
  }
}

function defaultImportInput(name: string, patch: EnrichedPartial): ModelInput {
  const bothub = providerRepository.getBotHub();
  return ModelSchema.parse({
    name,
    provider: bothub?.name ?? 'BotHub',
    provider_id: bothub?.id,
    family: resolveFamily(patch.family, inferFamily(name)),
    modality: patch.modality ?? 'text',
    context_window: patch.context_window ?? 0,
    max_output_tokens: patch.max_output_tokens ?? 0,
    input_price_per_mtok: patch.input_price_per_mtok ?? 0,
    output_price_per_mtok: patch.output_price_per_mtok ?? 0,
    supports_vision: patch.supports_vision ?? false,
    supports_function_calling: patch.supports_function_calling ?? false,
    supports_json_mode: patch.supports_json_mode ?? false,
    supports_streaming: patch.supports_streaming ?? true,
    supports_web_search: patch.supports_web_search ?? false,
    description: patch.description ?? '',
    tags: patch.tags ?? [],
    use_cases: patch.use_cases ?? [],
    pros: patch.pros ?? [],
    cons: patch.cons ?? [],
    benchmarks: patch.benchmarks ?? {},
    release_date: patch.release_date ?? null,
    reasoning: patch.reasoning ?? 3,
    task_quality: patch.task_quality ?? 3,
    latency: patch.latency ?? 3,
    generation_speed: patch.generation_speed ?? 3,
    hallucinations: patch.hallucinations ?? 3,
    instruction_following: patch.instruction_following ?? 3,
    code_quality: patch.code_quality ?? 3,
    multilingual_quality: patch.multilingual_quality ?? 3,
    robustness: patch.robustness ?? 3,
    rag_compatibility: patch.rag_compatibility ?? 3,
  });
}

async function importNewModels(
  options: SyncOptions,
  results: SyncModelResult[],
  onProgress?: SyncProgressCallback,
  signal?: AbortSignal,
): Promise<void> {
  const list = await fetchBotHubList();
  throwIfAborted(signal);
  const existingNames = modelRepository.getExistingNormalizedNames();
  const importEntries = list.filter(
    (entry) => !isBatchInferenceModelId(entry.id)
      && !existingNames.has(normalizeModelName(entry.id)),
  );
  const delayMs = options.delayMs ?? 250;

  onProgress?.({
    type: 'start',
    phase: 'import',
    current: 0,
    total: importEntries.length,
    modelName: '',
    summary: buildResultSummary(results),
  });

  for (let index = 0; index < importEntries.length; index++) {
    throwIfAborted(signal);
    const entry = importEntries[index];

    const bothub = providerRepository.getBotHub();
    const pseudoModel: Model = {
      id: '',
      name: entry.id,
      provider: bothub?.name ?? 'BotHub',
      provider_id: bothub?.id,
      family: inferFamily(entry.id),
      modality: 'text',
      context_window: 0,
      max_output_tokens: 0,
      input_price_per_mtok: 0,
      output_price_per_mtok: 0,
      supports_vision: false,
      supports_function_calling: false,
      supports_json_mode: false,
      supports_streaming: false,
      supports_web_search: false,
      is_favorite: false,
      is_hidden: false,
      reasoning: 3,
      task_quality: 3,
      latency: 3,
      generation_speed: 3,
      hallucinations: 3,
      instruction_following: 3,
      code_quality: 3,
      multilingual_quality: 3,
      robustness: 3,
      rag_compatibility: 3,
      description: '',
      use_cases: [],
      pros: [],
      cons: [],
      benchmarks: {},
      tags: [],
      info_updated_at: null,
      created_at: '',
      updated_at: '',
    };

    const importOptions: SyncOptions = { ...options, onlyEmpty: false };
    const enrichResult = await enrichSingleModel(pseudoModel, importOptions);

    if (enrichResult.status === 'error') {
      results.push({ name: entry.id, status: 'error', message: enrichResult.message });
      onProgress?.({
        type: 'progress',
        phase: 'import',
        current: index + 1,
        total: importEntries.length,
        modelName: entry.id,
        status: 'error',
        message: enrichResult.message,
        summary: buildResultSummary(results),
      });
      continue;
    }

    const patch: EnrichedPartial = {};
    if (enrichResult.diff) {
      for (const d of enrichResult.diff) {
        (patch as Record<string, unknown>)[d.field] = d.after;
      }
    }

    if (options.dryRun) {
      results.push({
        name: entry.id,
        status: 'created',
        diff: enrichResult.diff,
        message: 'Будет создана',
      });
      onProgress?.({
        type: 'progress',
        phase: 'import',
        current: index + 1,
        total: importEntries.length,
        modelName: entry.id,
        status: 'created',
        message: 'Будет создана',
        summary: buildResultSummary(results),
      });
      continue;
    }

    try {
      const existing = modelRepository.findByNormalizedName(entry.id);
      if (existing) {
        results.push({
          name: entry.id,
          modelId: existing.id,
          status: 'skipped',
          message: 'Уже существует',
        });
        onProgress?.({
          type: 'progress',
          phase: 'import',
          current: index + 1,
          total: importEntries.length,
          modelName: entry.id,
          status: 'skipped',
          message: 'Уже существует',
          summary: buildResultSummary(results),
        });
        continue;
      }

      const created = modelRepository.create({
        ...defaultImportInput(entry.id, patch),
        info_updated_at: new Date().toISOString(),
      });
      results.push({
        name: entry.id,
        modelId: created.id,
        status: 'created',
        diff: enrichResult.diff,
      });
      existingNames.add(normalizeModelName(entry.id));
      onProgress?.({
        type: 'progress',
        phase: 'import',
        current: index + 1,
        total: importEntries.length,
        modelName: entry.id,
        status: 'created',
        summary: buildResultSummary(results),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Ошибка создания';
      results.push({
        name: entry.id,
        status: 'error',
        message,
      });
      onProgress?.({
        type: 'progress',
        phase: 'import',
        current: index + 1,
        total: importEntries.length,
        modelName: entry.id,
        status: 'error',
        message,
        summary: buildResultSummary(results),
      });
    }

    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function runSync(
  options: SyncOptions,
  onProgress?: SyncProgressCallback,
  signal?: AbortSignal,
): Promise<SyncResult> {
  if (syncInProgress) {
    throw new SyncAlreadyRunningError();
  }

  syncInProgress = true;
  try {
    return await runSyncInternal(options, onProgress, signal);
  } finally {
    syncInProgress = false;
  }
}

async function runSyncInternal(
  options: SyncOptions,
  onProgress?: SyncProgressCallback,
  signal?: AbortSignal,
): Promise<SyncResult> {
  const mode = options.mode ?? 'update';
  const results: SyncModelResult[] = [];
  const delayMs = options.delayMs ?? 250;
  let cancelled = false;

  if (mode === 'update' || mode === 'both') {
    const models = filterModels(modelRepository.findAll(), options);

    onProgress?.({
      type: 'start',
      phase: 'update',
      current: 0,
      total: models.length,
      modelName: '',
      summary: buildResultSummary(results),
    });

    for (let index = 0; index < models.length; index++) {
      if (signal?.aborted) {
        cancelled = true;
        break;
      }
      const model = models[index];
      const result = await enrichSingleModel(model, options);
      results.push(result);
      onProgress?.({
        type: 'progress',
        phase: 'update',
        current: index + 1,
        total: models.length,
        modelName: model.name,
        status: result.status,
        message: result.message,
        summary: buildResultSummary(results),
      });
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  if (!cancelled && (mode === 'import' || mode === 'both')) {
    try {
      await importNewModels(options, results, onProgress, signal);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        cancelled = true;
      } else {
        throw error;
      }
    }
  }

  return {
    ...buildResultSummary(results),
    results,
    cancelled: cancelled || undefined,
  };
}
