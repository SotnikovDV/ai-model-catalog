const FAMILY_RULES: Array<{ pattern: RegExp; family: string }> = [
  { pattern: /^(gpt|o1|o3|o4|chatgpt|text-embedding|dall-e|whisper|tts)/, family: 'OpenAI' },
  { pattern: /^claude/, family: 'Anthropic' },
  { pattern: /^(llama|meta-llama)/, family: 'Meta' },
  { pattern: /^gemini/, family: 'Google' },
  { pattern: /^(mistral|mixtral|codestral|pixtral)/, family: 'Mistral AI' },
  { pattern: /^deepseek/, family: 'DeepSeek' },
  { pattern: /^grok/, family: 'xAI' },
  { pattern: /^(qwen|qwq)/, family: 'Alibaba' },
  { pattern: /^command/, family: 'Cohere' },
  { pattern: /^glm/, family: 'Z.AI' },
];

export const OPENROUTER_PROVIDER_FAMILY: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  'meta-llama': 'Meta',
  meta: 'Meta',
  mistralai: 'Mistral AI',
  mistral: 'Mistral AI',
  deepseek: 'DeepSeek',
  'x-ai': 'xAI',
  xai: 'xAI',
  qwen: 'Alibaba',
  alibaba: 'Alibaba',
  cohere: 'Cohere',
  perplexity: 'Perplexity',
  tencent: 'Tencent',
  'z-ai': 'Z.AI',
  zhipu: 'Z.AI',
};

export function inferFamily(modelName: string): string {
  const normalized = modelName.trim().toLowerCase();
  if (!normalized) return 'Unknown';

  for (const { pattern, family } of FAMILY_RULES) {
    if (pattern.test(normalized)) return family;
  }

  console.warn(`[inferFamily] Could not infer family for model: ${modelName}`);
  return 'Unknown';
}

export function inferFamilyFromOpenRouterId(openRouterId: string): string {
  const slashIndex = openRouterId.indexOf('/');
  if (slashIndex === -1) {
    return inferFamily(openRouterId);
  }

  const provider = openRouterId.slice(0, slashIndex).toLowerCase();
  const suffix = openRouterId.slice(slashIndex + 1);
  const fromProvider = OPENROUTER_PROVIDER_FAMILY[provider];
  if (fromProvider) return fromProvider;

  return inferFamily(suffix);
}

export function isUnknownFamily(family?: string | null): boolean {
  if (!family) return true;
  const normalized = family.trim().toLowerCase();
  return normalized === '' || normalized === 'unknown';
}

export function resolveFamily(...candidates: Array<string | undefined | null>): string {
  for (const candidate of candidates) {
    if (!isUnknownFamily(candidate)) return candidate!.trim();
  }
  return 'Unknown';
}
