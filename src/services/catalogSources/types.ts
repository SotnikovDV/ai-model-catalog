import type { ModelInput } from '../../types.js';

export interface OpenRouterModel {
  id: string;
  name: string;
  hugging_face_id?: string;
  created?: number;
  description?: string;
  context_length?: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: {
    prompt?: string | number;
    completion?: string | number;
  };
  top_provider?: {
    max_completion_tokens?: number;
  };
  supported_parameters?: string[];
}

export interface BotHubListEntry {
  id: string;
  label?: string;
  features: string[];
  parentLabel?: string;
}

export interface BotHubOpenAiModel {
  id: string;
  name?: string;
  contextWindow?: number;
  maxTokens?: number;
  reasoning?: boolean;
  input?: string[];
  cost?: {
    input?: number;
    output?: number;
  };
}

export interface BotHubPageData {
  contextWindow?: number;
  maxTokens?: number;
  features?: string[];
  /** Цена на странице BotHub в рублях (уже RUB/MTok, без конвертации). */
  inputRubPerMtok?: number;
  outputRubPerMtok?: number;
  inputUsdPerMtok?: number;
  outputUsdPerMtok?: number;
}

export interface NormalizedCatalogData {
  family?: string;
  modality?: ModelInput['modality'];
  context_window?: number;
  max_output_tokens?: number;
  input_price_per_mtok?: number;
  output_price_per_mtok?: number;
  supports_vision?: boolean;
  supports_function_calling?: boolean;
  supports_json_mode?: boolean;
  supports_streaming?: boolean;
  supports_web_search?: boolean;
  release_date?: string;
  description?: string;
  tags?: string[];
  sources?: string[];
}
