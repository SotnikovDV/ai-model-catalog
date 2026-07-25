import type { Model, AvailabilityStatus } from '../types.js';
import { getCategoriesForUseCases, normalizeUseCases } from './useCaseTaxonomy.js';

export const AVAILABILITY_STATUS_LABELS: Record<AvailabilityStatus, string> = {
  available: 'Доступна',
  inference: 'Инференс',
  unavailable: 'Недоступна',
};

export function getAvailabilityStatusLabel(status?: AvailabilityStatus | null): string {
  if (!status) return 'Не проверялась';
  return AVAILABILITY_STATUS_LABELS[status] ?? status;
}

export function getAvailabilityBadgeClass(status?: AvailabilityStatus | null): string {
  if (status === 'available') return 'availability-available';
  if (status === 'inference') return 'availability-inference';
  if (status === 'unavailable') return 'availability-unavailable';
  return 'availability-unknown';
}

export const PRICE_LABELS: Record<string, string> = {
  '🆓 Бесплатные': '🆓 Бесплатные',
  '💚 Бюджетные (до ~200 руб./1М)': '💚 Бюджетные',
  '🟡 Оптимальные (200–1500 руб./1М)': '🟡 Оптимальные',
  '🔴 Премиум (1500–5000 руб./1М)': '🔴 Премиум',
  '⛔ Топ-флагманы (>5000 руб./1М)': '⛔ Топ-флагманы',
};

export const RATING_FIELDS: Array<{ key: keyof Model; label: string }> = [
  { key: 'reasoning', label: 'Размышление' },
  { key: 'task_quality', label: 'Качество на задаче' },
  { key: 'latency', label: 'Задержка' },
  { key: 'generation_speed', label: 'Скорость генерации' },
  { key: 'hallucinations', label: 'Устойчивость к галлюсинациям' },
  { key: 'instruction_following', label: 'Следование инструкциям' },
  { key: 'code_quality', label: 'Качество кода' },
  { key: 'multilingual_quality', label: 'Многоязычность' },
  { key: 'robustness', label: 'Робастность' },
  { key: 'rag_compatibility', label: 'RAG-совместимость' },
];

export function getPriceCategory(input: number, output: number): string {
  if (input === 0 && output === 0) return '🆓 Бесплатные';
  const price = Math.max(input, output);
  if (price <= 200) return '💚 Бюджетные (до ~200 руб./1М)';
  if (price <= 1500) return '🟡 Оптимальные (200–1500 руб./1М)';
  if (price <= 5000) return '🔴 Премиум (1500–5000 руб./1М)';
  return '⛔ Топ-флагманы (>5000 руб./1М)';
}

export function formatTokens(value: number): string {
  if (!value) return '—';
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(value);
}

const INFERENCE_LATENCY_LABELS: Record<number, string> = {
  1: 'очень медленно',
  2: 'медленно',
  3: 'средне',
  4: 'быстро',
  5: 'мгновенно',
};

export function getInferenceResponseRating(ms: number): number {
  if (ms <= 800) return 5;
  if (ms <= 2000) return 4;
  if (ms <= 4000) return 3;
  if (ms <= 8000) return 2;
  return 1;
}

export function formatInferenceSpeedBadgeForView(ms?: number | null): {
  label: string | null;
  title: string | null;
} {
  if (ms == null || !Number.isFinite(ms)) {
    return { label: null, title: null };
  }
  const rating = getInferenceResponseRating(ms);
  const label = INFERENCE_LATENCY_LABELS[rating];
  const formattedMs = Math.round(ms).toLocaleString('ru-RU');
  return {
    label: `⚡ ${rating}/5`,
    title: `Скорость ответа при проверке inference: ${rating}/5 (${label}) · ${formattedMs} мс`,
  };
}

export function formatInferenceResponseForView(ms?: number | null): {
  label: string | null;
  title: string | null;
} {
  return formatInferenceSpeedBadgeForView(ms);
}

export type ChatRatingSummary = {
  avg: number;
  count: number;
};

function formatRatingCountLabel(count: number): string {
  const value = Math.abs(count) % 100;
  const lastDigit = value % 10;
  if (value > 10 && value < 20) return `${count} оценок`;
  if (lastDigit > 1 && lastDigit < 5) return `${count} оценки`;
  if (lastDigit === 1) return `${count} оценка`;
  return `${count} оценок`;
}

export function formatChatRatingBadgeForView(
  avg?: number | null,
  count?: number | null,
): {
  label: string | null;
  title: string | null;
} {
  if (avg == null || !count) {
    return { label: null, title: null };
  }

  const formatted = avg.toLocaleString('ru-RU', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return {
    label: `★ ${formatted}`,
    title: `Средняя оценка ответов в чате: ${formatted}/5 (${formatRatingCountLabel(count)})`,
  };
}

export function enrichModelForView(
  model: Model,
  chatRating?: ChatRatingSummary | null,
) {
  const priceCategory = getPriceCategory(model.input_price_per_mtok, model.output_price_per_mtok);
  const isFree = priceCategory === '🆓 Бесплатные';
  const inferenceSpeed = formatInferenceSpeedBadgeForView(model.availability_response_ms);
  const chatRatingBadge = formatChatRatingBadgeForView(chatRating?.avg, chatRating?.count);

  return {
    ...model,
    use_case_categories: getCategoriesForUseCases(model.use_cases),
    use_cases: normalizeUseCases(model.use_cases),
    price_category: priceCategory,
    price_label: PRICE_LABELS[priceCategory] || priceCategory,
    context_formatted: formatTokens(model.context_window),
    output_formatted: formatTokens(model.max_output_tokens),
    is_free: isFree,
    info_updated_formatted: model.info_updated_at
      ? new Date(model.info_updated_at).toLocaleDateString('ru-RU')
      : null,
    updated_at_formatted: model.updated_at
      ? new Date(model.updated_at).toLocaleDateString('ru-RU')
      : null,
    availability_status_label: getAvailabilityStatusLabel(model.availability_status),
    availability_badge_class: getAvailabilityBadgeClass(model.availability_status),
    availability_checked_formatted: model.availability_checked_at
      ? new Date(model.availability_checked_at).toLocaleDateString('ru-RU')
      : null,
    inference_response_label: inferenceSpeed.label,
    inference_response_title: inferenceSpeed.title,
    inference_speed_label: inferenceSpeed.label,
    inference_speed_title: inferenceSpeed.title,
    chat_rating_avg: chatRating?.avg ?? null,
    chat_rating_count: chatRating?.count ?? 0,
    chat_rating_label: chatRatingBadge.label,
    chat_rating_title: chatRatingBadge.title,
  };
}

export function enrichModelsForView(
  models: Model[],
  ratingsMap: Map<string, ChatRatingSummary>,
) {
  return models.map((model) => enrichModelForView(model, ratingsMap.get(model.id) ?? null));
}
