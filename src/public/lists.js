const COMPARE_CHECK_OFF_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>';
const COMPARE_CHECK_ON_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7.5 12.2l3 3 6-6.4"/></svg>';
const CARD_DETAIL_ICON = '<svg class="card-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>';
const CARD_CHAT_ICON = '<svg class="card-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const LIST_ICON_FALLBACK = '<svg class="card-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>';
const LIST_COPY_NAME_ICON = '<svg class="rec-copy-name-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2 2v1"/></svg>';

const PRICE_LABELS = {
  '🆓 Бесплатные': '🆓 Бесплатные',
  '💚 Бюджетные (до ~200 руб./1М)': '💚 Бюджетные',
  '🟡 Оптимальные (200–1500 руб./1М)': '🟡 Оптимальные',
  '🔴 Премиум (1500–5000 руб./1М)': '🔴 Премиум',
  '⛔ Топ-флагманы (>5000 руб./1М)': '⛔ Топ-флагманы',
};

let listModelsById = new Map();
let currentList = null;
let listsCatalog = [];

function escHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getPriceCategory(input, output) {
  if (input === 0 && output === 0) return '🆓 Бесплатные';
  const price = Math.max(input, output);
  if (price <= 200) return '💚 Бюджетные (до ~200 руб./1М)';
  if (price <= 1500) return '🟡 Оптимальные (200–1500 руб./1М)';
  if (price <= 5000) return '🔴 Премиум (1500–5000 руб./1М)';
  return '⛔ Топ-флагманы (>5000 руб./1М)';
}

function getAvailabilityStatusLabel(status) {
  if (!status) return 'Не проверялась';
  if (status === 'available') return 'Доступна';
  if (status === 'inference') return 'Инференс';
  if (status === 'unavailable') return 'Недоступна';
  return status;
}

function getAvailabilityBadgeClass(status) {
  if (status === 'available') return 'availability-available';
  if (status === 'inference') return 'availability-inference';
  if (status === 'unavailable') return 'availability-unavailable';
  return 'availability-unknown';
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

function formatListMtokPrice(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  const num = Number(value);
  if (num === 0) return '0';
  return `${num} ₽`;
}

function renderListItemBadges(model) {
  const priceCategory = getPriceCategory(model.input_price_per_mtok ?? 0, model.output_price_per_mtok ?? 0);
  const priceLabel = PRICE_LABELS[priceCategory] || priceCategory;
  const parts = [
    `<span class="availability-badge ${getAvailabilityBadgeClass(model.availability_status)}">${escHtml(getAvailabilityStatusLabel(model.availability_status))}</span>`,
  ];
  if (model.modality) {
    parts.push(`<span class="detail-badge accent">${escHtml(model.modality)}</span>`);
  }
  parts.push(`<span class="detail-badge">${escHtml(priceLabel)}</span>`);
  if (model.is_favorite) {
    parts.push('<span class="detail-badge favorite">⭐ Избранное</span>');
  }
  if (model.release_date) {
    parts.push(`<span class="detail-badge">Релиз: ${escHtml(model.release_date)}</span>`);
  }
  return parts.join('');
}

function updateListCompareButton(button) {
  if (!button?.dataset?.id || !window.CompareBuffer) return;
  const active = window.CompareBuffer.has(button.dataset.id);
  button.classList.toggle('active', active);
  button.setAttribute('aria-pressed', active ? 'true' : 'false');
  const icon = button.querySelector('.compare-btn-icon');
  if (icon) icon.innerHTML = active ? COMPARE_CHECK_ON_ICON : COMPARE_CHECK_OFF_ICON;
}

function renderListItemActions(model) {
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
    <a href="${editHref}" class="card-edit-btn" title="Редактировать модель" aria-label="Редактировать модель">✎</a>
    <a href="${loginDetailHref}" class="card-favorite-btn${model.is_favorite ? ' active' : ''}" title="${favoriteTitle}" aria-label="${favoriteTitle}">★</a>
    <a href="${loginDetailHref}" class="card-list-btn" title="Добавить в список" aria-label="Добавить в список">${window.AddToList?.LIST_ICON || LIST_ICON_FALLBACK}</a>
    <button type="button" class="card-compare-btn list-compare-btn${inCompare ? ' active' : ''}" data-id="${escId}" title="Добавить к сравнению" aria-label="Добавить к сравнению" aria-pressed="${inCompare ? 'true' : 'false'}">
      <span class="compare-btn-icon" aria-hidden="true">${inCompare ? COMPARE_CHECK_ON_ICON : COMPARE_CHECK_OFF_ICON}</span>
    </button>`;
  }

  return `
    <a href="/models/${escId}" class="card-detail-btn" title="Подробнее" aria-label="Подробнее">${CARD_DETAIL_ICON}</a>
    <a href="/models/${escId}/chat" class="card-chat-btn" title="Чат с моделью" aria-label="Чат с моделью">${CARD_CHAT_ICON}</a>
    <a href="/models/${escId}/edit" class="card-edit-btn" title="Редактировать модель" aria-label="Редактировать модель">✎</a>
    <button type="button" class="card-favorite-btn list-favorite-btn${model.is_favorite ? ' active' : ''}" data-id="${escId}" title="${favoriteTitle}" aria-label="${favoriteTitle}">★</button>
    <button type="button" class="card-list-btn" data-id="${escId}" title="Добавить в список" aria-label="Добавить в список">${window.AddToList?.LIST_ICON || LIST_ICON_FALLBACK}</button>
    <button type="button" class="card-compare-btn list-compare-btn${inCompare ? ' active' : ''}" data-id="${escId}" title="Добавить к сравнению" aria-label="Добавить к сравнению" aria-pressed="${inCompare ? 'true' : 'false'}">
      <span class="compare-btn-icon" aria-hidden="true">${inCompare ? COMPARE_CHECK_ON_ICON : COMPARE_CHECK_OFF_ICON}</span>
    </button>`;
}

function getListIdFromUrl() {
  return new URLSearchParams(window.location.search).get('id') || '';
}

function setListIdInUrl(id) {
  if (!window.history.replaceState) return;
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('id', id);
  else url.searchParams.delete('id');
  window.history.replaceState({}, '', url.pathname + url.search);
}

function getModelIds(list) {
  return (list?.items || [])
    .filter((item) => item.model && !item.model.is_hidden)
    .map((item) => item.model.id)
    .filter(Boolean);
}

function goToCompare(list) {
  const ids = getModelIds(list);
  if (!ids.length) return;
  if (window.CompareBuffer) window.CompareBuffer.setIds(ids);
  window.location.href = window.CompareBuffer?.getUrl(ids)
    || `/compare?ids=${ids.map(encodeURIComponent).join(',')}`;
}

function goToCompareChat(list) {
  const max = window.CompareBuffer?.CHAT_MAX_MODELS || 8;
  const ids = getModelIds(list).slice(0, max);
  if (!ids.length) return;
  if (window.CompareBuffer) window.CompareBuffer.setIds(ids);
  const base = window.CompareBuffer?.getChatUrl(ids)
    || `/compare/chat?ids=${ids.map(encodeURIComponent).join(',')}`;
  const params = new URLSearchParams({ from: 'lists', list: list.id });
  const url = `${base}${base.includes('?') ? '&' : '?'}${params.toString()}`;
  window.location.href = window.AdminAccess?.protectedHref(url) || url;
}

async function patchListModelFields(id, fields) {
  const response = await fetch(`/api/models/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || 'Не удалось обновить модель');
  return payload.data;
}

function bindListItemActions(container) {
  container.querySelectorAll('.list-compare-btn').forEach((button) => {
    updateListCompareButton(button);
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!window.CompareBuffer || !button.dataset.id) return;
      window.CompareBuffer.toggle(button.dataset.id);
      updateListCompareButton(button);
    });
  });

  if (window.AdminAccess?.needsLogin()) {
    container.querySelectorAll('.rec-item-actions a').forEach((link) => {
      link.addEventListener('click', (event) => event.stopPropagation());
    });
    return;
  }

  container.querySelectorAll('.list-favorite-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.stopPropagation();
      const id = button.dataset.id;
      const model = listModelsById.get(id);
      if (!model) return;
      try {
        const updated = await patchListModelFields(id, { is_favorite: !model.is_favorite });
        listModelsById.set(id, { ...model, ...updated });
        const next = listModelsById.get(id);
        button.classList.toggle('active', Boolean(next.is_favorite));
        button.title = next.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное';
        button.setAttribute('aria-label', button.title);
      } catch {
        alert('Не удалось обновить избранное');
      }
    });
  });

  container.querySelectorAll('.rec-item-actions .card-chat-btn, .rec-item-actions .card-edit-btn').forEach((link) => {
    link.addEventListener('click', (event) => event.stopPropagation());
  });
}

function bindListCopyNameButtons(container) {
  if (window.CopyModelName?.bindAll) {
    window.CopyModelName.bindAll(container);
    return;
  }
  container.querySelectorAll('.rec-copy-name-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();
      const text = button.dataset.copyText || '';
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // ignore
      }
    });
  });
}

function renderShell(selectedId) {
  const container = document.getElementById('listsContent');
  if (!container) return;

  if (!listsCatalog.length) {
    container.innerHTML = `
      <div class="page-card" style="text-align:center;">
        <p style="color:var(--text-muted); margin-bottom:16px;">Списков пока нет.</p>
        <a href="${escHtml(window.AdminAccess?.protectedHref('/admin/lists') || '/admin/lists')}" class="btn btn-primary">Создать в админке</a>
      </div>
    `;
    return;
  }

  const options = listsCatalog.map((list) => `
    <option value="${escHtml(list.id)}"${list.id === selectedId ? ' selected' : ''}>
      ${escHtml(list.name)} (${list.itemCount})
    </option>
  `).join('');

  container.innerHTML = `
    <div class="rec-header page-card">
      <label class="list-picker-label" for="listSelect">Выберите список</label>
      <select id="listSelect" class="list-picker-select">
        <option value="">— не выбран —</option>
        ${options}
      </select>
      <div id="listDetail"></div>
    </div>
  `;

  const select = container.querySelector('#listSelect');
  select?.addEventListener('change', () => {
    void loadAndRenderList(select.value);
  });
}

function renderListDetail(list) {
  const detail = document.getElementById('listDetail');
  if (!detail) return;

  if (!list) {
    detail.innerHTML = '<p class="rec-summary" style="margin-top:12px;">Выберите список, чтобы увидеть модели.</p>';
    return;
  }

  listModelsById.clear();
  (list.items || []).forEach((item) => {
    const model = { ...(item.model || {}), id: item.modelId };
    listModelsById.set(item.modelId, model);
  });

  const catalogUrl = `/?list=${encodeURIComponent(list.id)}&view=cards`;
  const hasItems = (list.items || []).length > 0;

  const itemsHtml = (list.items || []).map((item, index) => {
    const model = listModelsById.get(item.modelId) || { id: item.modelId };
    const comment = item.comment?.trim()
      ? `<p class="rec-rationale">${escHtml(item.comment)}</p>`
      : '';
    return `
      <article class="rec-item page-card" data-id="${escHtml(item.modelId)}">
        <div class="rec-item-header">
          <div class="rec-item-rank">${index + 1}</div>
          <div class="rec-item-title-wrap">
            <h2 class="rec-item-title">
              <span class="rec-item-title-row">
                <a href="/models/${escHtml(item.modelId)}" data-model-modal-id="${escHtml(item.modelId)}" title="Открыть описание модели">${escHtml(model.name || item.modelId)}</a>
                ${window.CopyModelName?.actionsHtml(model.name || item.modelId, item.modelId) || `<button type="button" class="rec-copy-name-btn" data-copy-text="${escHtml(model.name || item.modelId)}" title="Копировать название" aria-label="Копировать название">${LIST_COPY_NAME_ICON}</button>`}
              </span>
            </h2>
            <div class="rec-item-badges detail-badges">${renderListItemBadges(model)}</div>
          </div>
          <div class="rec-item-actions card-actions">
            ${renderListItemActions(model)}
          </div>
        </div>
        ${comment}
        <div class="rec-specs">
          <span>Контекст: <strong>${escHtml(formatTokens(model.context_window))}</strong></span>
          <span>Промпт / 1M: <strong>${escHtml(formatListMtokPrice(model.input_price_per_mtok))}</strong></span>
          <span>Ответ / 1M: <strong>${escHtml(formatListMtokPrice(model.output_price_per_mtok))}</strong></span>
        </div>
      </article>
    `;
  }).join('');

  detail.innerHTML = `
    ${list.description ? `<p class="rec-summary list-description">${escHtml(list.description)}</p>` : '<p class="rec-summary list-description muted">Без описания</p>'}
    <div class="rec-header-actions">
      <a href="${escHtml(catalogUrl)}" class="btn btn-primary${!hasItems ? ' disabled' : ''}" ${!hasItems ? 'aria-disabled="true" tabindex="-1"' : ''}>Показать карточками в каталоге</a>
      <button type="button" class="btn btn-secondary" id="listCompareBtn" ${!hasItems ? 'disabled' : ''}>Сравнить</button>
      <button type="button" class="btn btn-secondary" id="listCompareChatBtn" ${!hasItems ? 'disabled' : ''}>Чат-сравнение</button>
    </div>
    <div class="rec-list" style="margin-top:20px;">
      ${hasItems ? itemsHtml : '<div class="page-card"><p class="detail-empty">В списке пока нет моделей.</p></div>'}
    </div>
  `;

  const listRoot = detail;
  bindListItemActions(listRoot);
  bindListCopyNameButtons(listRoot);
  window.ModelModal?.bindNameClicks(listRoot);

  listRoot.querySelector('#listCompareBtn')?.addEventListener('click', () => goToCompare(list));
  listRoot.querySelector('#listCompareChatBtn')?.addEventListener('click', () => goToCompareChat(list));

  if (window.CompareBuffer) {
    window.CompareBuffer.onChange(() => {
      listRoot.querySelectorAll('.list-compare-btn').forEach((button) => updateListCompareButton(button));
    });
  }
}

async function loadAndRenderList(id) {
  currentList = null;
  setListIdInUrl(id || '');
  if (!id) {
    renderListDetail(null);
    return;
  }

  const detail = document.getElementById('listDetail');
  if (detail) {
    detail.innerHTML = '<p class="rec-summary" style="margin-top:12px; color:var(--text-muted);">Загрузка…</p>';
  }

  try {
    const response = await fetch(`/api/lists/${encodeURIComponent(id)}`);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      renderListDetail(null);
      if (detail) {
        detail.innerHTML = `<p class="rec-summary" style="margin-top:12px; color:var(--danger, #c00);">${escHtml(payload?.error || 'Список не найден')}</p>`;
      }
      return;
    }
    currentList = payload.data;
    renderListDetail(currentList);
  } catch {
    if (detail) {
      detail.innerHTML = '<p class="rec-summary" style="margin-top:12px; color:var(--danger, #c00);">Не удалось загрузить список</p>';
    }
  }
}

async function initListsPage() {
  const container = document.getElementById('listsContent');
  if (!container) return;

  try {
    const response = await fetch('/api/lists');
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      container.innerHTML = `<div class="page-card" style="text-align:center; color:var(--danger, #c00);">${escHtml(payload?.error || 'Не удалось загрузить списки')}</div>`;
      return;
    }
    listsCatalog = Array.isArray(payload.data) ? payload.data : [];
  } catch {
    container.innerHTML = '<div class="page-card" style="text-align:center; color:var(--danger, #c00);">Не удалось загрузить списки</div>';
    return;
  }

  const requestedId = getListIdFromUrl();
  const initialId = listsCatalog.some((list) => list.id === requestedId)
    ? requestedId
    : (listsCatalog[0]?.id || '');

  renderShell(initialId);
  if (initialId) {
    await loadAndRenderList(initialId);
  } else {
    renderListDetail(null);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  void initListsPage();
});
