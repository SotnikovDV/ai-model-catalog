import {
  assertAiConfigured,
  assertSearchConfigured,
  getAiConfig,
  resolveModelForTier,
  resolveSearchConnection,
} from './aiConfig.js';
import type { AiModelTier, ChatMessage } from '../types/ai.js';
import { applyCitationsToContent, extractCitationUrls } from '../utils/citations.js';

export interface ChatCompletionOptions {
  messages: ChatMessage[];
  tier?: AiModelTier;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object';
  /** Превращать [n] в ссылки по citations (по умолчанию true) */
  linkifyCitations?: boolean;
}

export interface ProviderChatCompletionOptions {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'json_object';
  /** Включить/выключить reasoning у моделей, которые это поддерживают */
  includeReasoning?: boolean;
}

export interface ProviderConnectionConfig {
  baseUrl: string;
  apiKey: string;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  tier?: AiModelTier;
  /** Текст рассуждений модели (если провайдер вернул отдельно от content) */
  reasoning?: string | null;
  /** URL источников (Perplexity Sonar и аналоги) */
  citations?: string[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface OpenAiChatResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      reasoning?: string | null;
      reasoning_details?: unknown[];
    };
  }>;
  model?: string;
  citations?: unknown;
  search_results?: unknown;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string; code?: string | number };
}

function formatProviderError(payload: OpenAiChatResponse, status: number): string {
  const err = payload.error;
  const message = err?.message?.trim();
  const code = err?.code != null && String(err.code).trim() ? String(err.code) : '';
  if (message && code) return `${message} (${code})`;
  if (message) return message;
  if (code) return code;
  return `HTTP ${status}`;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function isResponseFormatError(status: number, message: string): boolean {
  if (status !== 400 && status !== 422) return false;
  const lower = message.toLowerCase();
  return lower.includes('response_format')
    || lower.includes('json_object')
    || lower.includes('json schema');
}

async function postChatCompletion(
  url: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<{ response: Response; payload: OpenAiChatResponse }> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  let payload: OpenAiChatResponse;
  try {
    payload = await response.json() as OpenAiChatResponse;
  } catch {
    throw new Error(`AI-провайдер вернул некорректный ответ (HTTP ${response.status})`);
  }

  return { response, payload };
}

function mapUsage(payload: OpenAiChatResponse): ChatCompletionResult['usage'] {
  if (!payload.usage) return undefined;
  return {
    promptTokens: payload.usage.prompt_tokens,
    completionTokens: payload.usage.completion_tokens,
    totalTokens: payload.usage.total_tokens,
  };
}

function extractReasoningText(message?: {
  reasoning?: string | null;
  reasoning_details?: unknown[];
} | null): string {
  if (!message) return '';

  if (typeof message.reasoning === 'string' && message.reasoning.trim()) {
    return message.reasoning.trim();
  }

  const details = message.reasoning_details;
  if (!Array.isArray(details) || details.length === 0) return '';

  const parts: string[] = [];
  for (const item of details) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (typeof record.text === 'string' && record.text.trim()) {
      parts.push(record.text.trim());
      continue;
    }
    if (typeof record.content === 'string' && record.content.trim()) {
      parts.push(record.content.trim());
      continue;
    }
    if (Array.isArray(record.summary)) {
      for (const summary of record.summary) {
        if (typeof summary === 'string' && summary.trim()) parts.push(summary.trim());
      }
    }
  }
  return parts.join('\n').trim();
}

function buildReasoningRequestBody(includeReasoning?: boolean): Record<string, unknown> {
  if (includeReasoning === true) {
    return { reasoning: { enabled: true } };
  }
  if (includeReasoning === false) {
    return { reasoning: { effort: 'none', enabled: false } };
  }
  return {};
}

async function executeChatCompletion(
  connection: ProviderConnectionConfig,
  baseBody: Record<string, unknown>,
  responseFormat?: 'json_object',
): Promise<ChatCompletionResult> {
  const url = `${normalizeBaseUrl(connection.baseUrl)}/chat/completions`;
  const model = String(baseBody.model ?? '');

  let attempt = await postChatCompletion(url, connection.apiKey, {
    ...baseBody,
    ...(responseFormat ? { response_format: { type: responseFormat } } : {}),
  });

  if (
    !attempt.response.ok
    && responseFormat
    && isResponseFormatError(
      attempt.response.status,
      attempt.payload.error?.message || '',
    )
  ) {
    attempt = await postChatCompletion(url, connection.apiKey, baseBody);
  }

  const { response, payload } = attempt;

  if (!response.ok) {
    const message = formatProviderError(payload, response.status);
    throw new Error(`Ошибка AI-провайдера: ${message}`);
  }

  const choice = payload.choices?.[0];
  const message = choice?.message;
  const rawContent = message?.content?.trim() || '';
  const reasoning = extractReasoningText(message);
  const citations = extractCitationUrls(payload);

  if (!rawContent && !reasoning) {
    throw new Error('AI-провайдер вернул пустой ответ');
  }

  // Если основного текста нет — показываем reasoning как content, без дубля строки
  if (!rawContent) {
    return {
      content: reasoning,
      reasoning: null,
      model: payload.model ?? model,
      citations: citations.length ? citations : undefined,
      usage: mapUsage(payload),
    };
  }

  return {
    content: rawContent,
    reasoning: reasoning || null,
    model: payload.model ?? model,
    citations: citations.length ? citations : undefined,
    usage: mapUsage(payload),
  };
}

export async function chatCompletionWithConnection(
  connection: ProviderConnectionConfig,
  options: ProviderChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const baseBody = {
    model: options.model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
  };
  const reasoningBody = buildReasoningRequestBody(options.includeReasoning);
  const hasReasoningParams = Object.keys(reasoningBody).length > 0;

  try {
    return await executeChatCompletion(connection, {
      ...baseBody,
      ...reasoningBody,
    }, options.responseFormat);
  } catch (error) {
    if (!hasReasoningParams) throw error;
    const message = error instanceof Error ? error.message.toLowerCase() : '';
    const looksUnsupported = message.includes('reasoning')
      || message.includes('thinking')
      || message.includes('unknown')
      || message.includes('unsupported')
      || message.includes('unexpected');
    if (!looksUnsupported) throw error;
    return executeChatCompletion(connection, baseBody, options.responseFormat);
  }
}

function defaultTemperatureForTier(tier: AiModelTier): number {
  if (tier === 'analytics' || tier === 'search') return 0.3;
  return 0.7;
}

function defaultMaxTokensForTier(tier: AiModelTier): number {
  if (tier === 'analytics' || tier === 'search') return 4096;
  return 1024;
}

export async function chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
  const config = getAiConfig();
  const tier = options.tier ?? 'simple';

  if (tier === 'search') {
    assertSearchConfigured(config);
  } else {
    assertAiConfigured(config);
  }

  const model = options.model ?? resolveModelForTier(tier, config);
  if (!model) {
    throw new Error(tier === 'search'
      ? 'Модель с поиском не настроена: укажите AI_MODEL_SEARCH.'
      : 'AI-провайдер не настроен: укажите модель.');
  }

  const connection = tier === 'search'
    ? resolveSearchConnection(config)
    : { baseUrl: config.baseUrl, apiKey: config.apiKey };

  const result = await executeChatCompletion(
    connection,
    {
      model,
      messages: options.messages,
      temperature: options.temperature ?? defaultTemperatureForTier(tier),
      max_tokens: options.maxTokens ?? defaultMaxTokensForTier(tier),
      // Perplexity Sonar: явный запрос массива citations для сносок [1], [2]…
      ...(tier === 'search' ? { return_citations: true } : {}),
    },
    options.responseFormat,
  );

  const linkify = options.linkifyCitations !== false;
  const citations = result.citations ?? [];
  const content = linkify && citations.length
    ? applyCitationsToContent(result.content, citations)
    : result.content;

  return { ...result, content, tier };
}

export async function testAiConnection(tier: AiModelTier = 'simple'): Promise<ChatCompletionResult> {
  return chatCompletion({
    tier,
    messages: [{ role: 'user', content: 'Ответь одним словом: OK' }],
    temperature: 0,
    maxTokens: 16,
  });
}

export async function probeModelWithConnection(
  connection: ProviderConnectionConfig,
  modelName: string,
): Promise<ChatCompletionResult> {
  const url = `${normalizeBaseUrl(connection.baseUrl)}/chat/completions`;
  const body = {
    model: modelName,
    messages: [{ role: 'user', content: 'Ответь одним словом: OK' }],
    temperature: 0,
    max_tokens: 64,
  };

  const { response, payload } = await postChatCompletion(url, connection.apiKey, body);

  if (!response.ok) {
    const message = formatProviderError(payload, response.status);
    throw new Error(`Ошибка AI-провайдера: ${message}`);
  }

  const choice = payload.choices?.[0];
  const message = choice?.message;
  const content = message?.content?.trim()
    || (typeof message?.reasoning === 'string' ? message.reasoning.trim() : '')
    || '';

  const responded = Boolean(content)
    || choice?.finish_reason === 'stop'
    || choice?.finish_reason === 'length'
    || (Array.isArray(message?.reasoning_details) && message.reasoning_details.length > 0);

  if (!responded) {
    throw new Error('AI-провайдер вернул пустой ответ');
  }

  return {
    content: content || 'OK',
    model: payload.model ?? modelName,
    usage: mapUsage(payload),
  };
}
