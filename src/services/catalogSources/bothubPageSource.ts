import type { BotHubPageData } from './types.js';

const PAGE_DELAY_MS = 300;
let lastFetchAt = 0;

function parseEuropeanNumber(raw: string): number | undefined {
  const normalized = raw.replace(/[\s\u00a0\u202f]/g, '').replace(',', '.');
  const num = Number(normalized);
  return Number.isFinite(num) ? num : undefined;
}

/** Цена в рублях за 1M токенов: `<span>147,32 ₽</span><p>Стоимость промпта</p>`. */
function extractRubBeforeLabel(html: string, label: string): number | undefined {
  const idx = html.indexOf(label);
  if (idx < 0) return undefined;

  const chunk = html.slice(Math.max(0, idx - 400), idx);
  const matches = [...chunk.matchAll(/>([\d\s\u00a0\u202f]+(?:[.,]\d+)?)\s*(?:<!--\s*-->\s*)*₽\s*</g)];
  const last = matches.at(-1);
  return last ? parseEuropeanNumber(last[1]) : undefined;
}

/** Устаревший формат страницы: цена в долларах перед подписью. */
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

/**
 * Данные именно запрашиваемой модели из RSC-payload страницы
 * (`"model":{"id":"<name>","pricing":{...},"contextLength":..,"maxTokens":..,"features":[..]`).
 * Страница также содержит списки всех моделей, поэтому привязка к id обязательна.
 */
function extractEmbeddedJson(html: string, modelName: string): Partial<BotHubPageData> {
  const escapedName = modelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const startPattern = new RegExp(`\\\\"model\\\\":\\{\\\\"id\\\\":\\\\"${escapedName}\\\\"`);
  const start = html.search(startPattern);
  if (start < 0) {
    return {};
  }

  // Поля, нужные нам, идут до `params` — ограничиваем окно поиска.
  const rest = html.slice(start, start + 12000);
  const paramsIdx = rest.indexOf('\\"params\\"');
  const segment = paramsIdx > 0 ? rest.slice(0, paramsIdx) : rest;

  const ctx = segment.match(/\\"contextLength\\":(\d+),\\"maxTokens\\":(\d+)/);
  const featuresMatch = segment.match(/\\"features\\":\[([^\]]*)\]/);
  const features = featuresMatch
    ? [...featuresMatch[1].matchAll(/\\"([A-Z_]+)\\"/g)].map((m) => m[1])
    : undefined;

  const contextWindow = ctx ? Number(ctx[1]) : undefined;
  const maxTokens = ctx ? Number(ctx[2]) : undefined;

  // 4095/4096 — заглушка BotHub для моделей без токенного контекста (изображения, аудио)
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

  const inputRubPerMtok = extractRubBeforeLabel(html, 'Стоимость промпта');
  const outputRubPerMtok = extractRubBeforeLabel(html, 'Стоимость ответа');
  const inputUsdPerMtok = inputRubPerMtok === undefined
    ? extractUsdBeforeLabel(html, 'Стоимость промпта')
    : undefined;
  const outputUsdPerMtok = outputRubPerMtok === undefined
    ? extractUsdBeforeLabel(html, 'Стоимость ответа')
    : undefined;

  if (
    !embedded.contextWindow
    && !embedded.features?.length
    && inputRubPerMtok === undefined
    && inputUsdPerMtok === undefined
  ) {
    return null;
  }

  return {
    ...embedded,
    inputRubPerMtok,
    outputRubPerMtok,
    inputUsdPerMtok,
    outputUsdPerMtok,
  };
}
