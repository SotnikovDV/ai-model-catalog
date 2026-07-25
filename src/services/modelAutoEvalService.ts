import type { Model } from '../types.js';
import type { Provider } from '../types/provider.js';
import type {
  EvaluationCheckResult,
  EvaluationOptions,
  EvaluationProgressCallback,
  EvaluationProgressSummary,
  EvaluationResult,
  EvaluationRunResult,
  EvaluationStalenessFilter,
} from '../types/autoEval.js';
import { AUTO_BENCHMARK_RESPONSE_ID } from '../types/autoEval.js';
import type { ModelChatRating } from '../types/modelRating.js';
import { modelRepository } from '../models/modelRepository.js';
import { modelRatingRepository } from '../models/modelRatingRepository.js';
import { providerRepository } from '../models/providerRepository.js';
import { chatCompletionWithConnection } from './aiClient.js';
import { resolveModelProviderConnection } from './providerConnection.js';
import { resolveOpenRouterId } from './modelIdResolver.js';
import {
  evaluateResult,
  formatEvalComment,
  TEST_PROMPT,
  totalToScore,
  tryParseBenchmarkResponse,
} from './autoEvalBenchmark.js';

let evaluationInProgress = false;

const STALENESS_MS: Record<Exclude<EvaluationStalenessFilter, 'never'>, number> = {
  week: 7 * 24 * 60 * 60 * 1000,
  month: 30 * 24 * 60 * 60 * 1000,
  half_year: 182 * 24 * 60 * 60 * 1000,
};

export function isEvaluationInProgress(): boolean {
  return evaluationInProgress;
}

class EvaluationAlreadyRunningError extends Error {
  constructor() {
    super('Автооценка уже выполняется. Дождитесь завершения текущей операции.');
    this.name = 'EvaluationAlreadyRunningError';
  }
}

async function resolveInferenceModelName(model: Model, provider: Provider): Promise<string> {
  if (provider.catalog_source === 'openrouter' || provider.catalog_source === 'routerai') {
    const externalId = await resolveOpenRouterId(model.name, model.family);
    return externalId ?? model.name;
  }
  return model.name;
}

function resolveProviderForModel(model: Model): Provider {
  const provider = model.provider_id
    ? providerRepository.findById(model.provider_id)
    : providerRepository.findByNameOrSlug(model.provider);

  if (!provider) {
    throw new Error(`Провайдер «${model.provider}» не найден в справочнике`);
  }
  if (!provider.enabled) {
    throw new Error(`Провайдер «${provider.name}» отключён`);
  }
  return provider;
}

function matchesEvaluationStaleness(
  model: Model,
  ratedAtMap: Map<string, string>,
  staleness?: EvaluationStalenessFilter,
): boolean {
  if (!staleness) return true;
  const ratedAt = ratedAtMap.get(model.id) ?? null;
  if (staleness === 'never') return !ratedAt;
  const cutoff = Date.now() - STALENESS_MS[staleness];
  return !ratedAt || new Date(ratedAt).getTime() < cutoff;
}

function filterModelsForEvaluation(models: Model[], options: EvaluationOptions): Model[] {
  const ratedAtMap = modelRatingRepository.getAutoBenchmarkRatedAtMap();
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

  if (options.inferenceOnly) {
    result = result.filter((m) => m.availability_status === 'inference');
  }

  if (options.staleness) {
    result = result.filter((m) => matchesEvaluationStaleness(m, ratedAtMap, options.staleness));
  }

  return result;
}

function persistInferenceAvailability(model: Model, responseMs: number): Model {
  const checkedAt = new Date().toISOString();
  return modelRepository.update(model.id, {
    availability_checked_at: checkedAt,
    availability_status: 'inference',
    availability_response_ms: responseMs,
    availability_error: null,
  }) ?? model;
}

function persistUnavailable(model: Model, error: string): Model {
  const checkedAt = new Date().toISOString();
  return modelRepository.update(model.id, {
    availability_checked_at: checkedAt,
    availability_status: 'unavailable',
    availability_response_ms: null,
    availability_error: error,
  }) ?? model;
}

export interface ModelBenchmarkOutcome {
  evaluation: EvaluationResult | null;
  rating: ModelChatRating | null;
  model: Model;
  status: EvaluationCheckResult['status'];
  responseMs?: number;
  error?: string;
}

export async function runModelBenchmark(model: Model): Promise<ModelBenchmarkOutcome> {
  const startedMs = Date.now();

  try {
    const provider = resolveProviderForModel(model);
    const connection = resolveModelProviderConnection(model);
    const inferenceModelName = await resolveInferenceModelName(model, provider);

    const completion = await chatCompletionWithConnection(connection, {
      model: inferenceModelName,
      messages: [
        {
          role: 'system',
          content: 'Ты оценочная модель. Отвечай только JSON с ключами: logic_answer, logic_reason, fact_answer, json_task, hallucination_answer, api_10_words.',
        },
        { role: 'user', content: TEST_PROMPT },
      ],
      temperature: 0,
      maxTokens: 1024,
      responseFormat: 'json_object',
    });

    const responseMs = Date.now() - startedMs;
    const rawText = completion.content;
    const { parsed, error: parseError } = tryParseBenchmarkResponse(rawText);

    let updatedModel = persistInferenceAvailability(model, responseMs);

    if (!parsed) {
      const comment = `Автооценка: не удалось разобрать JSON-ответ.\n${parseError ?? ''}`.trim();
      const rating = modelRatingRepository.upsert(model.id, {
        responseId: AUTO_BENCHMARK_RESPONSE_ID,
        responseContent: rawText.slice(0, 8000),
        score: 1,
        comment,
      });

      return {
        evaluation: null,
        rating,
        model: updatedModel,
        status: 'parse_error',
        responseMs,
        error: parseError ?? 'Ошибка парсинга ответа',
      };
    }

    const evaluation = evaluateResult(parsed, rawText);
    const rating = modelRatingRepository.upsert(model.id, {
      responseId: AUTO_BENCHMARK_RESPONSE_ID,
      responseContent: rawText.slice(0, 8000),
      score: evaluation.score,
      comment: formatEvalComment(evaluation),
    });

    return {
      evaluation,
      rating,
      model: updatedModel,
      status: 'success',
      responseMs,
    };
  } catch (error) {
    const responseMs = Date.now() - startedMs;
    const message = error instanceof Error ? error.message : 'Неизвестная ошибка';
    const updatedModel = persistUnavailable(model, message);

    return {
      evaluation: null,
      rating: null,
      model: updatedModel,
      status: 'error',
      responseMs,
      error: message,
    };
  }
}

function buildResultSummary(results: EvaluationCheckResult[]): EvaluationProgressSummary {
  return {
    success: results.filter((r) => r.status === 'success').length,
    parseErrors: results.filter((r) => r.status === 'parse_error').length,
    errors: results.filter((r) => r.status === 'error').length,
  };
}

export async function runEvaluationCheck(
  options: EvaluationOptions,
  onProgress?: EvaluationProgressCallback,
): Promise<EvaluationRunResult> {
  if (evaluationInProgress) {
    throw new EvaluationAlreadyRunningError();
  }

  evaluationInProgress = true;
  try {
    const models = filterModelsForEvaluation(modelRepository.findAll(), options);
    const results: EvaluationCheckResult[] = [];
    const delayMs = options.delayMs ?? 750;

    onProgress?.({
      type: 'start',
      current: 0,
      total: models.length,
      modelName: '',
      summary: buildResultSummary(results),
    });

    for (let index = 0; index < models.length; index += 1) {
      const model = models[index];
      const outcome = await runModelBenchmark(model);

      const checkResult: EvaluationCheckResult = {
        modelId: model.id,
        name: model.name,
        status: outcome.status,
        total: outcome.evaluation?.total,
        score: outcome.evaluation?.score ?? (outcome.rating?.score),
        responseMs: outcome.responseMs,
        error: outcome.error,
      };

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
    };
  } finally {
    evaluationInProgress = false;
  }
}

export { totalToScore };
