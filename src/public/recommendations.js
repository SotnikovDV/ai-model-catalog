const COMPARE_CHECK_OFF_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>';
const COMPARE_CHECK_ON_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7.5 12.2l3 3 6-6.4"/></svg>';
const CARD_DETAIL_ICON = '<svg class="card-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
const CARD_CHAT_ICON = '<svg class="card-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const CARD_AVAIL_INFERENCE_ICON = '<svg class="card-action-icon card-avail-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>';
const CARD_SYNC_ICON = '<svg class="card-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><polyline points="21 3 21 9 15 9"/></svg>';
const REC_COPY_NAME_ICON = '<svg class="rec-copy-name-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

const REC_SYNC_FIELDS = [
  'modality',
  'context_window',
  'max_output_tokens',
  'input_price_per_mtok',
  'output_price_per_mtok',
  'supports_vision',
  'supports_function_calling',
  'supports_json_mode',
  'supports_streaming',
  'supports_web_search',
  'release_date',
  'description',
  'tags',
];

let recModelsById = new Map();

const PRICE_LABELS = {
  '🆓 Бесплатные': '🆓 Бесплатные',
  '💚 Бюджетные (до ~200 руб./1М)': '💚 Бюджетные',
  '🟡 Оптимальные (200–1500 руб./1М)': '🟡 Оптимальные',
  '🔴 Премиум (1500–5000 руб./1М)': '🔴 Премиум',
  '⛔ Топ-флагманы (>5000 руб./1М)': '⛔ Топ-флагманы',
};

function getPriceCategory(input, output) {
  if (input === 0 && output === 0) return '🆓 Бесплатные';
  const price = Math.max(input, output);
  if (price <= 200) return '💚 Бюджетные (до ~200 руб./1М)';
  if (price <= 1500) return '🟡 Оптимальные (200–1500 руб./1М)';
  if (price <= 5000) return '🔴 Премиум (1500–5000 руб./1М)';
  return '⛔ Топ-флагманы (>5000 руб./1М)';
}

function getAvailabilityBadgeClass(status) {
  if (status === 'available') return 'availability-available';
  if (status === 'inference') return 'availability-inference';
  if (status === 'unavailable') return 'availability-unavailable';
  return 'availability-unknown';
}

function getAvailabilityStatusLabel(status) {
  if (!status) return 'Не проверялась';
  if (status === 'available') return 'Доступна';
  if (status === 'inference') return 'Инференс';
  if (status === 'unavailable') return 'Недоступна';
  return status;
}

function formatRecInferenceSpeedBadge(ms) {
  if (ms == null || !Number.isFinite(ms)) return null;
  const latencyLabels = {
    1: 'очень медленно',
    2: 'медленно',
    3: 'средне',
    4: 'быстро',
    5: 'мгновенно',
  };
  let rating = 1;
  if (ms <= 800) rating = 5;
  else if (ms <= 2000) rating = 4;
  else if (ms <= 4000) rating = 3;
  else if (ms <= 8000) rating = 2;
  const label = latencyLabels[rating];
  const formattedMs = Math.round(ms).toLocaleString('ru-RU');
  return {
    label: `⚡ ${rating}/5`,
    title: `Скорость ответа при проверке inference: ${rating}/5 (${label}) · ${formattedMs} мс`,
  };
}

function formatRecAvailabilityBadgeTitle(model) {
  const label = getAvailabilityStatusLabel(model.availability_status);
  if (!model?.availability_checked_at) return label;
  const formatted = new Date(model.availability_checked_at).toLocaleDateString('ru-RU');
  return `${label} · проверено ${formatted}`;
}

function formatRecChatRatingBadge(model) {
  if (model.chat_rating_label) {
    return {
      label: model.chat_rating_label,
      title: model.chat_rating_title || '',
    };
  }
  const avg = model.chat_rating_avg;
  const count = model.chat_rating_count;
  if (avg == null || !count) return null;
  const formatted = Number(avg).toFixed(1).replace(/\.0$/, '');
  const countLabel = count === 1 ? '1 оценка' : count < 5 ? `${count} оценки` : `${count} оценок`;
  return {
    label: `★ ${formatted}`,
    title: `Средняя оценка ответов в чате: ${formatted}/5 (${countLabel})`,
  };
}

function renderRecItemBadges(model) {
  const priceCategory = getPriceCategory(model.input_price_per_mtok ?? 0, model.output_price_per_mtok ?? 0);
  const priceLabel = PRICE_LABELS[priceCategory] || priceCategory;
  const availabilityLabel = getAvailabilityStatusLabel(model.availability_status);
  const availabilityClass = getAvailabilityBadgeClass(model.availability_status);
  const availabilityTitle = formatRecAvailabilityBadgeTitle(model);
  const inferenceSpeed = formatRecInferenceSpeedBadge(model.availability_response_ms);
  const parts = [
    `<span class="availability-badge ${availabilityClass}" title="${escHtml(availabilityTitle)}">${escHtml(availabilityLabel)}</span>`,
  ];

  if (inferenceSpeed) {
    parts.push(`<span class="assistant-preview-meta-badge rec-inference-speed-badge" title="${escHtml(inferenceSpeed.title)}">${escHtml(inferenceSpeed.label)}</span>`);
  }
  const chatRating = formatRecChatRatingBadge(model);
  if (chatRating) {
    parts.push(`<span class="assistant-preview-meta-badge chat-rating-badge" title="${escHtml(chatRating.title)}">${escHtml(chatRating.label)}</span>`);
  }
  if (model.modality) {
    parts.push(`<span class="detail-badge accent">${escHtml(model.modality)}</span>`);
  }
  parts.push(`<span class="detail-badge">${escHtml(priceLabel)}</span>`);
  if (model.is_favorite) {
    parts.push('<span class="detail-badge favorite">⭐ Избранное</span>');
  }
  if (model.is_hidden) {
    parts.push('<span class="detail-badge">Скрытая</span>');
  }
  if (model.release_date) {
    parts.push(`<span class="detail-badge">Релиз: ${escHtml(model.release_date)}</span>`);
  }

  return parts.join('');
}

function updateRecItemBadges(article, model) {
  const container = article?.querySelector('.rec-item-badges');
  if (!container || !model) return;
  container.innerHTML = renderRecItemBadges(model);
}

function flashRecAvailabilityUpdated(article) {
  [
    article?.querySelector('.rec-item-badges .availability-badge'),
    article?.querySelector('.rec-inference-speed-badge'),
    article?.querySelector('.rec-item-badges .chat-rating-badge'),
  ]
    .filter(Boolean)
    .forEach((el) => {
      el.classList.remove('availability-updated');
      void el.offsetWidth;
      el.classList.add('availability-updated');
      el.addEventListener('animationend', () => {
        el.classList.remove('availability-updated');
      }, { once: true });
    });
}

function flashRecAvailButtonResult(button, status) {
  if (!button) return;
  button.classList.remove(
    'is-result-available',
    'is-result-inference',
    'is-result-unavailable',
    'is-result-error',
  );
  const className = status === 'available'
    ? 'is-result-available'
    : status === 'inference'
      ? 'is-result-inference'
      : status === 'unavailable'
        ? 'is-result-unavailable'
        : status === 'error'
          ? 'is-result-error'
          : null;
  if (!className) return;
  button.classList.add(className);
  window.setTimeout(() => button.classList.remove(className), 1500);
}

function setRecAvailabilityChecking(article, button, isChecking) {
  setRecAvailChecking(button, isChecking);
  const badge = article?.querySelector('.rec-item-badges .availability-badge');
  if (!badge) return;

  badge.classList.toggle('is-checking', isChecking);

  if (isChecking) {
    if (!badge.dataset.prevTitle) {
      badge.dataset.prevTitle = badge.getAttribute('title') || '';
    }
    badge.setAttribute('title', 'Проверка inference…');
    return;
  }

  if (badge.dataset.prevTitle != null) {
    badge.setAttribute('title', badge.dataset.prevTitle);
    delete badge.dataset.prevTitle;
  }
}

function showRecAvailabilityError(message) {
  alert(message);
}

function updateRecCompareButton(button) {
  if (!button?.dataset?.id || !window.CompareBuffer) return;
  const active = window.CompareBuffer.has(button.dataset.id);
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  const icon = button.querySelector('.compare-btn-icon');
  if (icon) icon.innerHTML = active ? COMPARE_CHECK_ON_ICON : COMPARE_CHECK_OFF_ICON;
}

function updateRecFavoriteButton(button, isFavorite) {
  if (!button) return;
  button.classList.toggle('active', isFavorite);
  button.title = isFavorite ? 'Убрать из избранного' : 'Добавить в избранное';
  button.setAttribute('aria-label', button.title);
}

function updateRecItemActionButtons(article, model) {
  if (!article || !model) return;
  updateRecItemBadges(article, model);
  updateRecFavoriteButton(article.querySelector('.rec-favorite-btn'), model.is_favorite);
  updateRecCompareButton(article.querySelector('.rec-compare-btn'));
}

function escHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTokens(value) {
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

function formatPrice(value) {
  if (value === 0) return '0';
  return String(value);
}

function formatRecMtokPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const num = Number(value);
  if (num === 0) return '0';
  return `${formatPrice(num)} ₽`;
}

async function patchRecModelFields(id, fields) {
  const response = await fetch(`/api/models/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || 'Не удалось обновить модель');
  }
  return payload.data;
}

function setRecAvailChecking(button, checking) {
  if (!button) return;
  button.disabled = checking;
  button.classList.toggle('is-checking', checking);
  button.setAttribute('aria-busy', checking ? 'true' : 'false');
}

async function runRecAvailability(modelId, mode, button) {
  const article = button.closest('.rec-item');
  setRecAvailabilityChecking(article, button, true);
  try {
    const response = await fetch(`/api/models/${modelId}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      showRecAvailabilityError(payload?.error || 'Проверка не удалась');
      flashRecAvailButtonResult(button, 'error');
      return;
    }
    if (payload?.model) {
      recModelsById.set(modelId, { ...recModelsById.get(modelId), ...payload.model });
      const model = recModelsById.get(modelId);
      updateRecItemBadges(article, model);
      flashRecAvailabilityUpdated(article);
      flashRecAvailButtonResult(button, payload.data?.status || model.availability_status);
    }
  } catch {
    showRecAvailabilityError('Проверка не удалась');
    flashRecAvailButtonResult(button, 'error');
  } finally {
    setRecAvailabilityChecking(article, button, false);
  }
}

async function runRecSync(modelId, button) {
  if (!button) return;
  button.disabled = true;
  try {
    const response = await fetch(`/api/models/${modelId}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: REC_SYNC_FIELDS, onlyEmpty: false }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      alert(payload?.error || 'Обновление не удалось');
      return;
    }
    if (payload?.data?.status === 'updated') {
      const modelResponse = await fetch(`/api/models/${modelId}`);
      if (modelResponse.ok) {
        const modelPayload = await modelResponse.json();
        if (modelPayload?.data) {
          recModelsById.set(modelId, { ...recModelsById.get(modelId), ...modelPayload.data });
        }
      }
    } else if (payload?.data?.status === 'error') {
      alert('Обновление не удалось');
    }
  } catch {
    alert('Обновление не удалось');
  } finally {
    button.disabled = false;
  }
}

function renderRecItemActions(model) {
  const id = model.id;
  const escId = escHtml(id);
  const inCompare = window.CompareBuffer?.has(id) ?? false;
  const detailPath = `/models/${id}`;
  const AA = window.AdminAccess;
  const favoriteTitle = model.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное';

  if (AA?.needsLogin()) {
    const chatHref = escHtml(AA.protectedHref(`${detailPath}/chat`));
    const editHref = escHtml(AA.protectedHref(`${detailPath}/edit`));
    const loginDetailHref = escHtml(AA.protectedHref(detailPath));

    return `
    <a href="/models/${escId}" class="card-detail-btn" title="Подробнее" aria-label="Подробнее">${CARD_DETAIL_ICON}</a>
    <a href="${chatHref}" class="card-chat-btn" title="Чат с моделью" aria-label="Чат с моделью">${CARD_CHAT_ICON}</a>
    <a href="${loginDetailHref}" class="card-avail-btn card-avail-inference-btn" title="Проверка inference" aria-label="Проверка inference">
      ${CARD_AVAIL_INFERENCE_ICON}
    </a>
    <a href="${loginDetailHref}" class="card-sync-btn" title="Обновить из источников" aria-label="Обновить из источников">
      ${CARD_SYNC_ICON}
    </a>
    <a href="${editHref}" class="card-edit-btn" title="Редактировать модель" aria-label="Редактировать модель">✎</a>
    <a href="${loginDetailHref}" class="card-favorite-btn${model.is_favorite ? ' active' : ''}" title="${favoriteTitle}" aria-label="${favoriteTitle}">★</a>
    <button
      type="button"
      class="card-compare-btn rec-compare-btn${inCompare ? ' active' : ''}"
      data-id="${escId}"
      title="Добавить к сравнению"
      aria-label="Добавить к сравнению"
      aria-pressed="${inCompare ? 'true' : 'false'}"
    ><span class="compare-btn-icon" aria-hidden="true">${inCompare ? COMPARE_CHECK_ON_ICON : COMPARE_CHECK_OFF_ICON}</span></button>
  `;
  }

  return `
    <a href="/models/${escId}" class="card-detail-btn" title="Подробнее" aria-label="Подробнее">${CARD_DETAIL_ICON}</a>
    <a href="/models/${escId}/chat" class="card-chat-btn" title="Чат с моделью" aria-label="Чат с моделью">${CARD_CHAT_ICON}</a>
    <button type="button" class="card-avail-btn card-avail-inference-btn rec-avail-inference-btn" data-id="${escId}" title="Проверка inference" aria-label="Проверка inference">
      ${CARD_AVAIL_INFERENCE_ICON}
      <span class="card-avail-spinner" aria-hidden="true"></span>
    </button>
    <button type="button" class="card-sync-btn rec-sync-btn" data-id="${escId}" title="Обновить из источников" aria-label="Обновить из источников">
      ${CARD_SYNC_ICON}
    </button>
    <a href="/models/${escId}/edit" class="card-edit-btn" title="Редактировать модель" aria-label="Редактировать модель">✎</a>
    <button type="button" class="card-favorite-btn rec-favorite-btn${model.is_favorite ? ' active' : ''}" data-id="${escId}" title="${favoriteTitle}" aria-label="${favoriteTitle}">★</button>
    <button
      type="button"
      class="card-compare-btn rec-compare-btn${inCompare ? ' active' : ''}"
      data-id="${escId}"
      title="Добавить к сравнению"
      aria-label="Добавить к сравнению"
      aria-pressed="${inCompare ? 'true' : 'false'}"
    ><span class="compare-btn-icon" aria-hidden="true">${inCompare ? COMPARE_CHECK_ON_ICON : COMPARE_CHECK_OFF_ICON}</span></button>
  `;
}

async function copyRecText(text) {
  if (window.CopyModelName?.copy) {
    return window.CopyModelName.copy(text);
  }
  const value = String(text ?? '');
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function bindRecCopyNameButtons(container) {
  if (window.CopyModelName?.bindAll) {
    window.CopyModelName.bindAll(container);
    return;
  }
  container.querySelectorAll('.rec-copy-name-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const id = button.dataset.id;
      const model = recModelsById.get(id);
      const name = model?.name || id;
      await copyRecText(name);
    });
  });
}

function bindRecItemActions(container) {
  container.querySelectorAll('.rec-compare-btn').forEach((button) => {
    updateRecCompareButton(button);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!window.CompareBuffer || !button.dataset.id) return;
      window.CompareBuffer.toggle(button.dataset.id);
      updateRecCompareButton(button);
    });
  });

  if (window.AdminAccess?.needsLogin()) {
    container.querySelectorAll('.rec-item-actions .card-chat-btn, .rec-item-actions .card-edit-btn, .rec-item-actions a.card-detail-btn').forEach((link) => {
      link.addEventListener('click', (event) => event.stopPropagation());
    });
    return;
  }

  container.querySelectorAll('.rec-favorite-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = button.dataset.id;
      const model = recModelsById.get(id);
      if (!model) return;
      try {
        const updated = await patchRecModelFields(id, { is_favorite: !model.is_favorite });
        recModelsById.set(id, { ...model, ...updated });
        updateRecItemActionButtons(button.closest('.rec-item'), recModelsById.get(id));
      } catch {
        alert('Не удалось обновить избранное');
      }
    });
  });

  container.querySelectorAll('.rec-avail-inference-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!button.dataset.id) return;
      void runRecAvailability(button.dataset.id, 'inference', button);
    });
  });

  container.querySelectorAll('.rec-sync-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!button.dataset.id) return;
      void runRecSync(button.dataset.id, button);
    });
  });

  container.querySelectorAll('.rec-item-actions .card-chat-btn, .rec-item-actions .card-edit-btn').forEach((link) => {
    link.addEventListener('click', (event) => event.stopPropagation());
  });
}

function renderEmpty(message) {
  const container = document.getElementById('recommendationsContent');
  if (!container) return;
  container.innerHTML = `
    <div class="page-card" style="text-align:center;">
      <p style="color:var(--text-muted); margin-bottom:16px;">${escHtml(message)}</p>
      <a href="/assistant" class="btn btn-primary">Перейти к AI-ассистенту</a>
    </div>
  `;
}

function renderResult(result, token) {
  const container = document.getElementById('recommendationsContent');
  if (!container) return;

  recModelsById.clear();
  (result.items || []).forEach((item) => {
    const model = { ...(item.model || {}), id: item.modelId };
    recModelsById.set(item.modelId, model);
  });

  const catalogUrl = window.RecommendationStore?.getCatalogUrl(token) || `/?rec=${encodeURIComponent(token)}`;

  const itemsHtml = (result.items || []).map((item) => {
    const model = recModelsById.get(item.modelId) || { id: item.modelId };
    return `
      <article class="rec-item page-card" data-id="${escHtml(item.modelId)}">
        <div class="rec-item-header">
          <div class="rec-item-rank">${item.rank}</div>
          <div class="rec-item-title-wrap">
            <h2 class="rec-item-title">
              <span class="rec-item-title-row">
                <a href="/models/${escHtml(item.modelId)}">${escHtml(model.name || item.modelId)}</a>
                <button type="button" class="rec-copy-name-btn" data-copy-text="${escHtml(model.name || item.modelId)}" title="Копировать название" aria-label="Копировать название">${REC_COPY_NAME_ICON}</button>
              </span>
            </h2>
            <div class="rec-item-badges detail-badges">${renderRecItemBadges(model)}</div>
          </div>
          <div class="rec-item-actions card-actions">
            ${renderRecItemActions(model)}
          </div>
        </div>
        <p class="rec-rationale">${escHtml(item.rationale)}</p>
        <div class="rec-specs">
          <span>Контекст: <strong>${escHtml(formatTokens(model.context_window))}</strong></span>
          <span>Промпт / 1M: <strong>${escHtml(formatRecMtokPrice(model.input_price_per_mtok))}</strong></span>
          <span>Ответ / 1M: <strong>${escHtml(formatRecMtokPrice(model.output_price_per_mtok))}</strong></span>
        </div>
      </article>
    `;
  }).join('');

  container.innerHTML = `
    <div class="rec-header page-card">
      <div class="rec-query-label muted">Ваш запрос</div>
      <blockquote class="rec-query">«${escHtml(result.query)}»</blockquote>
      <p class="rec-summary">${escHtml(result.summary || '')}</p>
      <div class="rec-header-actions">
        <a href="${escHtml(catalogUrl)}" class="btn btn-primary">Показать карточками в каталоге</a>
        <a href="/assistant" class="btn btn-secondary">Новый запрос</a>
      </div>
    </div>
    <div class="rec-list">${itemsHtml}</div>
  `;

  bindRecItemActions(container);
  bindRecCopyNameButtons(container);

  if (window.CompareBuffer) {
    window.CompareBuffer.onChange(() => {
      container.querySelectorAll('.rec-compare-btn').forEach((button) => updateRecCompareButton(button));
    });
  }
}

function initRecommendations() {
  const token = window.RecommendationStore?.getTokenFromUrl();
  if (!token) {
    renderEmpty('Результаты подбора не найдены. Сначала сделайте запрос в AI-ассистенте.');
    return;
  }

  const result = window.RecommendationStore?.load(token);
  if (!result?.items?.length) {
    renderEmpty('Результаты устарели или недоступны. Повторите запрос в AI-ассистенте.');
    return;
  }

  renderResult(result, token);
}

document.addEventListener('DOMContentLoaded', initRecommendations);
