import type { ModelInput } from '../types.js';
import type { BotHubListEntry, BotHubOpenAiModel, BotHubPageData, NormalizedCatalogData } from './catalogSources/types.js';
import { getSyncConfig, usdPerMtokToRubPerMtok } from './syncConfig.js';

const CAPABILITY_BOOL_KEYS = new Set([
  'supports_vision',
  'supports_function_calling',
  'supports_json_mode',
  'supports_streaming',
  'supports_web_search',
]);

const MODALITY_RANK: Record<ModelInput['modality'], number> = {
  text: 0,
  image: 1,
  audio: 2,
  video: 3,
  multimodal: 4,
};

function pickHigherModality(
  current?: ModelInput['modality'],
  incoming?: ModelInput['modality'],
): ModelInput['modality'] | undefined {
  if (!incoming) return current;
  if (!current) return incoming;
  return MODALITY_RANK[incoming] > MODALITY_RANK[current] ? incoming : current;
}

function inferModalityFromTags(tags: string[] | undefined): ModelInput['modality'] | undefined {
  if (!tags?.length) return undefined;

  const features = tags
    .map((tag) => tag.toUpperCase())
    .filter((tag) => tag.includes('_'));

  if (features.length === 0) return undefined;
  return mapBotHubFeaturesToCapabilities(features).modality;
}

export function mapBotHubFeaturesToCapabilities(features: string[]): Pick<
  NormalizedCatalogData,
  'supports_vision' | 'supports_function_calling' | 'supports_json_mode' | 'supports_streaming' | 'supports_web_search' | 'modality'
> {
  const set = new Set(features);
  const hasImage = set.has('IMAGE_TO_TEXT') || set.has('TEXT_TO_IMAGE') || set.has('IMAGE_TO_IMAGE');
  const hasAudio = set.has('AUDIO_TO_TEXT') || set.has('TEXT_TO_AUDIO') || set.has('AUDIO_TO_AUDIO');
  const hasVideo = set.has('IMAGE_TO_VIDEO') || set.has('TEXT_TO_VIDEO') || set.has('VIDEO_TO_VIDEO');
  const modalityCount = [set.has('TEXT_TO_TEXT'), hasImage, hasAudio, hasVideo].filter(Boolean).length;

  let modality: ModelInput['modality'] = 'text';
  if (modalityCount > 1) modality = 'multimodal';
  else if (hasVideo) modality = 'video';
  else if (hasAudio) modality = 'audio';
  else if (hasImage && !set.has('TEXT_TO_TEXT')) modality = 'image';

  return {
    modality,
    supports_vision: hasImage,
    supports_function_calling: set.has('TOOLS'),
    supports_json_mode: false,
    supports_streaming: true,
    supports_web_search: set.has('NATIVE_WEB_SEARCH'),
  };
}

export function normalizeBotHubListEntry(entry: BotHubListEntry): NormalizedCatalogData {
  const caps = mapBotHubFeaturesToCapabilities(entry.features);
  const family = entry.parentLabel?.trim() || entry.label?.trim() || undefined;
  return {
    ...caps,
    family,
    tags: [...entry.features.map((f) => f.toLowerCase())],
    sources: ['bothub-list'],
  };
}

export function normalizeBotHubOpenAiModel(model: BotHubOpenAiModel): NormalizedCatalogData {
  const { usdToRubRate } = getSyncConfig();
  const inputModalities = model.input ?? [];
  const hasImage = inputModalities.includes('image');

  return {
    context_window: model.contextWindow,
    max_output_tokens: model.maxTokens,
    input_price_per_mtok: model.cost?.input !== undefined
      ? usdPerMtokToRubPerMtok(model.cost.input, usdToRubRate)
      : undefined,
    output_price_per_mtok: model.cost?.output !== undefined
      ? usdPerMtokToRubPerMtok(model.cost.output, usdToRubRate)
      : undefined,
    supports_vision: hasImage,
    supports_function_calling: true,
    supports_streaming: true,
    tags: model.reasoning ? ['reasoning'] : undefined,
    sources: ['bothub-openai'],
  };
}

export function normalizeBotHubPageData(data: BotHubPageData): NormalizedCatalogData {
  const { usdToRubRate } = getSyncConfig();
  const caps = mapBotHubFeaturesToCapabilities(data.features ?? []);

  return {
    ...caps,
    context_window: data.contextWindow,
    max_output_tokens: data.maxTokens,
    input_price_per_mtok: data.inputUsdPerMtok !== undefined
      ? usdPerMtokToRubPerMtok(data.inputUsdPerMtok, usdToRubRate)
      : undefined,
    output_price_per_mtok: data.outputUsdPerMtok !== undefined
      ? usdPerMtokToRubPerMtok(data.outputUsdPerMtok, usdToRubRate)
      : undefined,
    sources: ['bothub-page'],
  };
}

export function mergeCatalogData(...chunks: Array<NormalizedCatalogData | null | undefined>): NormalizedCatalogData {
  const result: NormalizedCatalogData = { sources: [] };

  for (const chunk of chunks) {
    if (!chunk) continue;

    for (const [key, value] of Object.entries(chunk)) {
      if (key === 'sources') {
        result.sources = [...new Set([...(result.sources ?? []), ...(chunk.sources ?? [])])];
        continue;
      }
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && value.length === 0) continue;
      if (CAPABILITY_BOOL_KEYS.has(key) && typeof value === 'boolean') {
        (result as Record<string, unknown>)[key] = Boolean((result as Record<string, unknown>)[key]) || value;
        continue;
      }
      if (key === 'modality' && typeof value === 'string') {
        result.modality = pickHigherModality(result.modality, value as ModelInput['modality']);
        continue;
      }
      (result as Record<string, unknown>)[key] = value;
    }
  }

  result.modality = pickHigherModality(result.modality, inferModalityFromTags(result.tags));

  return result;
}