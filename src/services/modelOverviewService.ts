import { modelRepository } from '../models/modelRepository.js';
import {
  assertAiConfigured,
  assertSearchConfigured,
  getAiConfig,
  isSearchConfigured,
} from './aiConfig.js';
import { chatCompletion } from './aiClient.js';
import { buildModelOverviewPrompt, MODEL_OVERVIEW_MAX_CHARS } from '../data/modelOverviewPrompt.js';
import { applyCitationsToContent } from '../utils/citations.js';
import type { AiModelTier } from '../types/ai.js';

export interface ModelOverviewResult {
  content: string;
  modelName: string;
  tier: AiModelTier;
  providerModel: string;
  citations?: string[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

function buildCatalogHints(modelId?: string, modelName?: string): string | null {
  const model = modelId
    ? modelRepository.findById(modelId)
    : (modelName ? modelRepository.findByNormalizedName(modelName) : null);
  if (!model) return null;

  const lines = [
    `Название в каталоге: ${model.name}`,
    `Семейство: ${model.family}`,
    `Провайдер: ${model.provider}`,
    `Модальность: ${model.modality}`,
    `Контекст: ${model.context_window}`,
    `Max output: ${model.max_output_tokens}`,
    model.description ? `Описание в каталоге: ${model.description.slice(0, 800)}` : null,
  ].filter(Boolean);

  return lines.join('\n');
}

/** Обрезка только «человеческого» текста, без HTML-сносок. */
function truncatePlainOverview(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const slice = trimmed.slice(0, maxChars);
  const breakAt = Math.max(
    slice.lastIndexOf('\n\n'),
    slice.lastIndexOf('\n'),
    slice.lastIndexOf('. '),
  );
  const cut = breakAt > maxChars * 0.6 ? slice.slice(0, breakAt + 1).trimEnd() : slice.trimEnd();
  return `${cut}…`;
}

export async function generateModelOverview(input: {
  modelName: string;
  modelId?: string;
}): Promise<ModelOverviewResult> {
  const config = getAiConfig();
  const useSearch = isSearchConfigured(config);
  const tier: AiModelTier = useSearch ? 'search' : 'analytics';

  if (useSearch) {
    assertSearchConfigured(config);
  } else {
    assertAiConfigured(config);
  }

  const modelName = input.modelName.trim();
  const catalogHints = buildCatalogHints(input.modelId, modelName);
  const prompt = buildModelOverviewPrompt(modelName, catalogHints);

  const result = await chatCompletion({
    tier,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    maxTokens: 4096,
    linkifyCitations: false,
  });

  // Сначала лимит по сырому тексту модели, потом сноски → иначе HTML «съедает» бюджет
  const plain = truncatePlainOverview(result.content, MODEL_OVERVIEW_MAX_CHARS + 400);
  const citations = result.citations ?? [];
  const content = citations.length ? applyCitationsToContent(plain, citations) : plain;

  return {
    content,
    modelName,
    tier,
    providerModel: result.model,
    citations: citations.length ? citations : undefined,
    usage: result.usage,
  };
}
