import type { BotHubPageData } from './types.js';

const PAGE_DELAY_MS = 300;
let lastFetchAt = 0;

function parseEuropeanNumber(raw: string): number | undefined {
  const normalized = raw.replace(/\s/g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

function extractUsdBeforeLabel(html: string, label: string): number | undefined {
  const idx = html.indexOf(label);
  if (idx < 0) return undefined;

  const chunk = html.slice(Math.max(0, idx - 400), idx);
  const matches = [...chunk.matchAll(/>([\d]+(?:[.,]\d+)?)\s*<!--\s*-->\s*<!--\s*-->\s*\$/g)];
  if (matches.length === 0) {
    const fallback = [...chunk.matchAll(/>([\d]+(?:[.,]\d+)?)\s*\$/g)];
    const last = fallback.at(-1);
    return last ? parseEuropeanNumber(last[1]) : undefined;
  }

  return parseEuropeanNumber(matches.at(-1)![1]);
}

function extractEmbeddedJson(html: string, modelName: string): Partial<BotHubPageData> {
  const idPattern = new RegExp(`\\\\"id\\\\":\\\\"${modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\\\"`);
  if (!idPattern.test(html)) {
    return {};
  }

  const ctx = html.match(/contextLength\\":(\d+),\\"maxTokens\\":(\d+)/);
  const featuresMatch = html.match(/\\"features\\":\[([^\]]*)\]/);
  const features = featuresMatch
    ? [...featuresMatch[1].matchAll(/\\"([A-Z_]+)\\"/g)].map((m) => m[1])
    : undefined;

  const contextWindow = ctx ? Number(ctx[1]) : undefined;
  const maxTokens = ctx ? Number(ctx[2]) : undefined;

  if (contextWindow === 4095 && maxTokens === 4096) {
    return { features };
  }

  return {
    contextWindow,
    maxTokens,
    features,
  };
}

async function throttle(): Promise<void> {
  const elapsed = Date.now() - lastFetchAt;
  if (elapsed < PAGE_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, PAGE_DELAY_MS - elapsed));
  }
  lastFetchAt = Date.now();
}

export async function fetchBotHubPageData(modelName: string): Promise<BotHubPageData | null> {
  await throttle();

  const response = await fetch(`https://bothub.chat/${encodeURIComponent(modelName)}`, {
    headers: { 'User-Agent': 'ai-model-catalog/0.1' },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const embedded = extractEmbeddedJson(html, modelName);

  const inputUsdPerMtok = extractUsdBeforeLabel(html, 'Стоимость промпта');
  const outputUsdPerMtok = extractUsdBeforeLabel(html, 'Стоимость ответа');

  if (!embedded.contextWindow && !inputUsdPerMtok && !embedded.features?.length) {
    return null;
  }

  return {
    ...embedded,
    inputUsdPerMtok,
    outputUsdPerMtok,
  };
}
