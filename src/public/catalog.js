const PRICE_ORDER = [
  '🆓 Бесплатные',
  '💚 Бюджетные (до ~200 руб./1М)',
  '🟡 Оптимальные (200–1500 руб./1М)',
  '🔴 Премиум (1500–5000 руб./1М)',
  '⛔ Топ-флагманы (>5000 руб./1М)',
];

const PRICE_COLORS = {
  '🆓 Бесплатные': 'free-color',
  '💚 Бюджетные (до ~200 руб./1М)': 'budget-color',
  '🟡 Оптимальные (200–1500 руб./1М)': 'optimal-color',
  '🔴 Премиум (1500–5000 руб./1М)': 'premium-color',
  '⛔ Топ-флагманы (>5000 руб./1М)': 'top-color',
};

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

function escHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('ru-RU');
}

function getModelLastUpdateText(model) {
  const sourceDate = model.info_updated_at || model.updated_at;
  if (sourceDate) {
    const formatted = formatDate(sourceDate);
    if (formatted) return `Актуализация: ${formatted}`;
  }
  return 'Актуализация не указана';
}

const CARD_EYE_ICON = '<svg class="card-hidden-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
const CARD_EYE_OFF_ICON = '<svg class="card-hidden-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
const CARD_CHAT_ICON = '<svg class="card-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
const COMPARE_CHECK_OFF_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>';
const COMPARE_CHECK_ON_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7.5 12.2l3 3 6-6.4"/></svg>';
const COMPARE_CHECK_PARTIAL_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12h8"/></svg>';

function getCompareIcon(inBuffer) {
  return inBuffer ? COMPARE_CHECK_ON_ICON : COMPARE_CHECK_OFF_ICON;
}

function getListSelectAllIcon(allSelected, indeterminate) {
  if (allSelected) return COMPARE_CHECK_ON_ICON;
  if (indeterminate) return COMPARE_CHECK_PARTIAL_ICON;
  return COMPARE_CHECK_OFF_ICON;
}

function formatChatRatingFields(avg, count) {
  if (avg == null || !count) {
    return {
      chat_rating_avg: null,
      chat_rating_count: 0,
      chat_rating_label: null,
      chat_rating_title: null,
    };
  }
  const formatted = Number(avg).toFixed(1).replace(/\.0$/, '');
  const countLabel = count === 1 ? '1 оценка' : count < 5 ? `${count} оценки` : `${count} оценок`;
  return {
    chat_rating_avg: avg,
    chat_rating_count: count,
    chat_rating_label: `★ ${formatted}`,
    chat_rating_title: `Средняя оценка ответов в чате: ${formatted}/5 (${countLabel})`,
  };
}

function enrichModel(model) {
  return {
    ...model,
    price_category: getPriceCategory(model.input_price_per_mtok, model.output_price_per_mtok),
    context: formatTokens(model.context_window),
    output_max: formatTokens(model.max_output_tokens),
    prompt_price: formatPrice(model.input_price_per_mtok),
    answer_price: formatPrice(model.output_price_per_mtok),
  };
}

function buildModelNameSearchHaystack(model) {
  return [
    model.name,
    model.family,
    model.provider,
    model.id,
  ].join(' ').toLowerCase();
}

let catalogModels = [];
let lastFilteredModelIds = [];
let bulkSelectionMenuOpen = false;

const BULK_ADMIN_ACTIONS = new Set([
  'favorite-add',
  'favorite-remove',
  'hidden-set',
  'hidden-unset',
  'availability-catalog',
  'availability-inference',
  'evaluate-benchmark',
  'update',
  'delete',
]);

const FALLBACK_SYNC_FIELDS = [
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
const CAPABILITY_FILTERS = [
  { key: 'supports_vision', label: 'Vision' },
  { key: 'supports_function_calling', label: 'Function calling' },
  { key: 'supports_json_mode', label: 'JSON mode' },
  { key: 'supports_streaming', label: 'Streaming' },
  { key: 'supports_web_search', label: 'Поиск в интернете' },
];

const CAPABILITY_LABELS = Object.fromEntries(
  CAPABILITY_FILTERS.map(({ key, label }) => [key, label]),
);

const AVAILABILITY_FILTERS = [
  { key: 'available', label: 'Доступна' },
  { key: 'inference', label: 'Инференс' },
  { key: 'unavailable', label: 'Недоступна' },
  { key: 'unchecked', label: 'Не проверялась' },
];

const AVAILABILITY_LABELS = Object.fromEntries(
  AVAILABILITY_FILTERS.map(({ key, label }) => [key, label]),
);

const DEFAULT_QUALITY_RANGE = { min: 0, max: 5 };
const CHAT_RATING_EMPTY_LABEL = 'Не оценивалась';
const INFERENCE_SPEED_EMPTY_LABEL = 'Не замерялась';
const FAMILY_FILTER_PREVIEW_COUNT = 6;

let familyFiltersExpanded = false;
let familyFilterCollapseBound = false;

const LIST_SORT_COLUMNS = {
  model: { asc: 'name_asc', desc: 'name_desc', default: 'name_asc' },
  availability: { asc: 'availability_asc', desc: 'availability_desc', default: 'availability_desc' },
  inference_speed: { asc: 'inference_speed_asc', desc: 'inference_speed_desc', default: 'inference_speed_desc' },
  chat_rating: { asc: 'chat_rating_asc', desc: 'chat_rating_desc', default: 'chat_rating_desc' },
  context: { asc: 'context_asc', desc: 'context_desc', default: 'context_desc' },
  price: { asc: 'price_asc', desc: 'price_desc', default: 'price_desc' },
};

let state = {
  search: '',
  prices: new Set(),
  families: new Set(),
  modalities: new Set(),
  capabilities: new Set(),
  years: new Set(),
  useCase: null,
  favoritesOnly: false,
  showHidden: false,
  availabilityStatus: null,
  chatRatingRange: { ...DEFAULT_QUALITY_RANGE },
  inferenceSpeedRange: { ...DEFAULT_QUALITY_RANGE },
  sort: 'default',
  view: 'grid',
  page: 1,
  perPage: 24,
  recMode: false,
  recToken: null,
  recOrder: [],
  recSummary: '',
  recQuery: '',
};

const CATALOG_FILTERS_SESSION_KEY = 'catalog_filters';
const CATALOG_FILTERS_LAST_KEY = 'catalog_filters_last';

function isCatalogPage() {
  return Boolean(document.getElementById('cardsGrid'));
}

function serializeCatalogFilters() {
  return {
    search: state.search,
    prices: [...state.prices],
    families: [...state.families],
    modalities: [...state.modalities],
    capabilities: [...state.capabilities],
    years: [...state.years],
    useCase: state.useCase,
    favoritesOnly: state.favoritesOnly,
    showHidden: state.showHidden,
    availabilityStatus: state.availabilityStatus,
    chatRatingRange: { ...state.chatRatingRange },
    inferenceSpeedRange: { ...state.inferenceSpeedRange },
    sort: state.sort,
    view: state.view,
  };
}

function applySerializedCatalogFilters(saved) {
  if (!saved || typeof saved !== 'object') return;
  state.search = saved.search || '';
  state.prices = new Set(saved.prices || []);
  state.families = new Set(saved.families || []);
  state.modalities = new Set(saved.modalities || []);
  state.capabilities = new Set(saved.capabilities || []);
  state.years = new Set(saved.years || []);
  const savedUseCase = saved.useCase || null;
  const categories = getUseCaseCategories();
  state.useCase = savedUseCase && categories.includes(savedUseCase) ? savedUseCase : null;
  state.favoritesOnly = Boolean(saved.favoritesOnly);
  state.showHidden = Boolean(saved.showHidden);
  state.availabilityStatus = saved.availabilityStatus || null;
  state.chatRatingRange = normalizeQualityRange(saved.chatRatingRange);
  state.inferenceSpeedRange = normalizeQualityRange(saved.inferenceSpeedRange);
  state.sort = saved.sort || 'default';
  if (saved.view === 'grid' || saved.view === 'list') {
    state.view = saved.view;
  }
}

function saveCatalogFilters() {
  try {
    sessionStorage.setItem(CATALOG_FILTERS_SESSION_KEY, JSON.stringify(serializeCatalogFilters()));
  } catch {
    // ignore storage errors
  }
}

function persistLastCatalogFilters() {
  if (!isCatalogPage()) return;
  try {
    localStorage.setItem(CATALOG_FILTERS_LAST_KEY, JSON.stringify(serializeCatalogFilters()));
  } catch {
    // ignore storage errors
  }
}

function navigateToCatalogFromDetail() {
  if (isCatalogPage()) return;
  saveCatalogFilters();
  window.location.href = '/';
}

function restoreCatalogFilters() {
  try {
    let saved = null;

    const sessionRaw = sessionStorage.getItem(CATALOG_FILTERS_SESSION_KEY);
    if (sessionRaw) {
      saved = JSON.parse(sessionRaw);
      if (isCatalogPage()) sessionStorage.removeItem(CATALOG_FILTERS_SESSION_KEY);
    } else {
      const localRaw = localStorage.getItem(CATALOG_FILTERS_LAST_KEY);
      if (localRaw) saved = JSON.parse(localRaw);
    }

    if (saved) applySerializedCatalogFilters(saved);
  } catch {
    // ignore invalid saved state
  }
}

function getCompareButtonTitle(inBuffer) {
  return inBuffer ? 'Убрать из сравнения' : 'Добавить к сравнению';
}

function updateCompareButtonState(button, inBuffer) {
  button.classList.toggle('active', inBuffer);
  const title = getCompareButtonTitle(inBuffer);
  button.title = title;
  button.setAttribute('aria-label', title);
  button.setAttribute('aria-pressed', inBuffer ? 'true' : 'false');
  const icon = button.querySelector('.compare-btn-icon');
  if (icon) icon.innerHTML = getCompareIcon(inBuffer);
}

function syncCompareButtonsFromBuffer() {
  if (!window.CompareBuffer) return;
  document.querySelectorAll('.card-compare-btn[data-id]').forEach((button) => {
    updateCompareButtonState(button, window.CompareBuffer.has(button.dataset.id));
  });
  const modalCompareBtn = document.getElementById('mCompareBtn');
  if (modalCompareBtn?.dataset.id) {
    updateCompareButtonState(modalCompareBtn, window.CompareBuffer.has(modalCompareBtn.dataset.id));
  }
  updateListSelectAllCheckbox();
}

function syncSearchClearButton() {
  const searchInput = document.getElementById('searchInput');
  const clearBtn = document.getElementById('searchClearBtn');
  if (!searchInput || !clearBtn) return;
  clearBtn.hidden = !searchInput.value;
}

function clearSearchInput() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput) return;
  searchInput.value = '';
  state.search = '';
  state.page = 1;
  syncSearchClearButton();
  if (!isCatalogPage()) {
    navigateToCatalogFromDetail();
    return;
  }
  applyFilters();
}

function clearRecMode() {
  state.recMode = false;
  state.recToken = null;
  state.recOrder = [];
  state.recSummary = '';
  state.recQuery = '';
  const banner = document.getElementById('recBanner');
  if (banner) {
    banner.hidden = true;
    banner.innerHTML = '';
  }
  if (isCatalogPage() && window.history.replaceState) {
    const url = new URL(window.location.href);
    url.searchParams.delete('rec');
    url.searchParams.delete('view');
    window.history.replaceState({}, '', url.pathname + url.search);
  }
}

function initRecMode() {
  if (!isCatalogPage() || !window.RecommendationStore) return;

  const token = window.RecommendationStore.getTokenFromUrl();
  if (!token) return;

  const result = window.RecommendationStore.load(token);
  if (!result?.items?.length) return;

  state.recMode = true;
  state.recToken = token;
  state.recOrder = result.items.map((item) => item.modelId);
  state.recSummary = result.summary || '';
  state.recQuery = result.query || '';
  state.search = '';
  state.page = 1;

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = '';
  syncSearchClearButton();
  renderRecBanner();
}

function renderRecBanner() {
  const banner = document.getElementById('recBanner');
  if (!banner || !state.recMode) return;

  const recUrl = window.RecommendationStore?.getRecommendationsUrl(state.recToken)
    || `/recommendations?rec=${encodeURIComponent(state.recToken)}`;

  banner.hidden = false;
  banner.innerHTML = `
    <div class="rec-banner-inner">
      <div class="rec-banner-text">
        <strong>Результаты AI-подбора</strong>
        ${state.recQuery ? `<span class="rec-banner-query">«${escHtml(state.recQuery)}»</span>` : ''}
        ${state.recSummary ? `<span class="rec-banner-summary">${escHtml(state.recSummary)}</span>` : ''}
      </div>
      <div class="rec-banner-actions">
        <a href="${escHtml(recUrl)}" class="btn btn-secondary btn-sm">С комментариями</a>
        <button type="button" class="btn btn-secondary btn-sm" id="recBannerClearBtn">Сбросить</button>
      </div>
    </div>
  `;

  document.getElementById('recBannerClearBtn')?.addEventListener('click', () => {
    clearRecMode();
    applyFilters();
  });
}

function initCatalog() {
  if (!Array.isArray(window.MODELS_DATA)) return;

  catalogModels = window.MODELS_DATA.map(enrichModel);
  restoreCatalogFilters();
  initRecMode();

  const searchInput = document.getElementById('searchInput');
  if (searchInput) searchInput.value = state.search;
  syncSearchClearButton();
  const sortSelect = document.getElementById('sortSelect');
  if (sortSelect) sortSelect.value = state.sort;

  document.getElementById('gridViewBtn')?.classList.toggle('active', state.view === 'grid');
  document.getElementById('listViewBtn')?.classList.toggle('active', state.view === 'list');
  document.getElementById('cardsGrid')?.classList.toggle('list-view', state.view === 'list');

  renderFavoriteFilter();
  renderHiddenFilter();
  renderAvailabilityFilters();
  initQualityFilters();
  renderPriceFilters();
  renderFamilyFilters();
  renderModalityFilters();
  renderCapabilityFilters();
  renderYearFilters();
  renderCatFilters();
  applyFilters();

  document.getElementById('searchInput')?.addEventListener('input', (event) => {
    state.search = event.target.value.toLowerCase();
    state.page = 1;
    syncSearchClearButton();
    if (!isCatalogPage()) {
      navigateToCatalogFromDetail();
      return;
    }
    applyFilters();
  });

  document.getElementById('searchClearBtn')?.addEventListener('click', clearSearchInput);

  document.getElementById('sortSelect')?.addEventListener('change', () => {
    state.sort = document.getElementById('sortSelect').value;
    state.page = 1;
    applyFilters();
  });

  document.getElementById('resetFiltersBtn')?.addEventListener('click', resetFilters);
  document.getElementById('gridViewBtn')?.addEventListener('click', () => setView('grid'));
  document.getElementById('listViewBtn')?.addEventListener('click', () => setView('list'));
  document.getElementById('modalClose')?.addEventListener('click', closeModal);
  document.getElementById('modalOverlay')?.addEventListener('click', handleOverlayClick);
  document.getElementById('mDetailLink')?.addEventListener('click', () => {
    if (isCatalogPage()) saveCatalogFilters();
  });
  document.getElementById('mChatLink')?.addEventListener('click', () => {
    if (isCatalogPage()) saveCatalogFilters();
  });
  document.getElementById('mFavoriteBtn')?.addEventListener('click', (event) => {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    if (!window.AdminAccess?.guardAction(event, `/models/${id}`)) return;
    toggleFavorite(id);
  });
  document.getElementById('mHiddenBtn')?.addEventListener('click', (event) => {
    const id = event.currentTarget.dataset.id;
    if (!id) return;
    if (!window.AdminAccess?.guardAction(event, `/models/${id}`)) return;
    toggleHidden(id);
  });
  document.getElementById('mCompareBtn')?.addEventListener('click', (event) => {
    event.stopPropagation();
    const button = event.currentTarget;
    if (!window.CompareBuffer || !button.dataset.id) return;
    window.CompareBuffer.toggle(button.dataset.id);
    updateCompareButtonState(button, window.CompareBuffer.has(button.dataset.id));
  });

  document.querySelectorAll('[data-nav-compare]').forEach((link) => {
    link.addEventListener('click', () => {
      if (isCatalogPage()) saveCatalogFilters();
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });

  initToolbarBulkMenu();

  if (window.CompareBuffer) {
    syncCompareButtonsFromBuffer();
    window.CompareBuffer.onChange(() => {
      syncCompareButtonsFromBuffer();
      updateBulkMenuButtonState();
    });
  }

  initDetailHeroActions();
}

function renderFavoriteFilter() {
  const container = document.getElementById('favoriteFilter');
  if (!container) return;
  container.innerHTML = '';

  const count = catalogModels.filter((model) => model.is_favorite).length;
  const div = document.createElement('div');
  div.className = `price-chip${state.favoritesOnly ? ' active' : ''}`;
  div.innerHTML = `
    <span>⭐</span>
    <span>Только избранные</span>
    <span class="count">${count}</span>
  `;
  div.onclick = () => {
    state.favoritesOnly = !state.favoritesOnly;
    state.page = 1;
    if (!isCatalogPage()) {
      navigateToCatalogFromDetail();
      return;
    }
    renderFavoriteFilter();
    applyFilters();
  };
  container.appendChild(div);
}

function renderHiddenFilter() {
  const container = document.getElementById('hiddenFilter');
  if (!container) return;
  container.innerHTML = '';

  const count = catalogModels.filter((model) => model.is_hidden).length;

  const div = document.createElement('div');
  div.className = `price-chip${state.showHidden ? ' active' : ''}`;
  div.innerHTML = `
    <span>👁</span>
    <span>Показывать скрытые</span>
    <span class="count">${count}</span>
  `;
  div.onclick = () => {
    state.showHidden = !state.showHidden;
    state.page = 1;
    if (!isCatalogPage()) {
      navigateToCatalogFromDetail();
      return;
    }
    renderHiddenFilter();
    applyFilters();
  };
  container.appendChild(div);
}

function renderAvailabilityFilters() {
  const container = document.getElementById('availabilityFilters');
  if (!container) return;
  container.innerHTML = '';

  AVAILABILITY_FILTERS.forEach(({ key, label }) => {
    const count = catalogModels.filter((model) => {
      if (key === 'unchecked') return !model.availability_status;
      return model.availability_status === key;
    }).length;
    if (!count) return;

    const div = document.createElement('div');
    div.className = `price-chip${state.availabilityStatus === key ? ' active' : ''}`;
    div.innerHTML = `
      <span class="availability-dot availability-${key}"></span>
      <span>${label}</span>
      <span class="count">${count}</span>
    `;
    div.onclick = () => {
      state.availabilityStatus = state.availabilityStatus === key ? null : key;
      state.page = 1;
      if (!isCatalogPage()) {
        navigateToCatalogFromDetail();
        return;
      }
      renderAvailabilityFilters();
      applyFilters();
    };
    container.appendChild(div);
  });
}

function renderPriceFilters() {
  const container = document.getElementById('priceFilters');
  if (!container) return;
  container.innerHTML = '';

  PRICE_ORDER.forEach((price) => {
    const count = catalogModels.filter((model) => model.price_category === price).length;
    if (!count) return;

    const div = document.createElement('div');
    div.className = `price-chip${state.prices.has(price) ? ' active' : ''}`;
    div.innerHTML = `
      <span>${PRICE_LABELS[price]}</span>
      <span class="count">${count}</span>
    `;
    div.onclick = () => togglePrice(price);
    container.appendChild(div);
  });
}

function getAllFamilies() {
  return [...new Set(catalogModels.map((model) => model.family).filter(Boolean))].sort();
}

function getVisibleFamilies(allFamilies) {
  if (familyFiltersExpanded) return allFamilies;
  if (state.families.size > 0) {
    return allFamilies.filter((family) => state.families.has(family));
  }
  return allFamilies.slice(0, FAMILY_FILTER_PREVIEW_COUNT);
}

function shouldShowFamilyToggle(allFamilies) {
  if (familyFiltersExpanded) return false;
  if (state.families.size > 0) {
    return state.families.size < allFamilies.length;
  }
  return allFamilies.length > FAMILY_FILTER_PREVIEW_COUNT;
}

function collapseFamilyFilters() {
  if (!familyFiltersExpanded) return;
  familyFiltersExpanded = false;
  renderFamilyFilters();
}

function expandFamilyFilters() {
  if (familyFiltersExpanded) return;
  familyFiltersExpanded = true;
  renderFamilyFilters();
}

function initFamilyFilterCollapse() {
  const section = document.getElementById('familyFilterSection');
  const toggle = document.getElementById('familyFiltersToggle');
  if (!section || !toggle) return;

  if (!familyFilterCollapseBound) {
    familyFilterCollapseBound = true;
    toggle.addEventListener('click', (event) => {
      event.preventDefault();
      expandFamilyFilters();
    });
    document.addEventListener('pointerdown', (event) => {
      if (!familyFiltersExpanded) return;
      const target = event.target;
      if (target instanceof Node && section.contains(target)) return;
      collapseFamilyFilters();
    });
  }

  const allFamilies = getAllFamilies();
  toggle.hidden = !shouldShowFamilyToggle(allFamilies);
  toggle.textContent = allFamilies.length
    ? `показать все (${allFamilies.length})`
    : 'показать все';
}

function renderFamilyFilters() {
  const container = document.getElementById('familyFilters');
  if (!container) return;
  container.innerHTML = '';

  const allFamilies = getAllFamilies();
  const visibleFamilies = getVisibleFamilies(allFamilies);

  container.classList.toggle('family-list-expanded', familyFiltersExpanded);
  container.classList.toggle('family-list-collapsed', !familyFiltersExpanded);

  visibleFamilies.forEach((family) => {
    const count = catalogModels.filter((model) => model.family === family).length;
    const div = document.createElement('div');
    div.className = `family-item${state.families.has(family) ? ' active' : ''}`;
    div.innerHTML = `
      <input type="checkbox"${state.families.has(family) ? ' checked' : ''} tabindex="-1">
      <span>${escHtml(family)}</span>
      <span class="count">${count}</span>
    `;
    div.onclick = () => toggleFamily(family);
    container.appendChild(div);
  });

  initFamilyFilterCollapse();
}

function renderModalityFilters() {
  const container = document.getElementById('modalityFilters');
  if (!container) return;
  container.innerHTML = '';

  const modalities = [...new Set(catalogModels.map((model) => model.modality).filter(Boolean))].sort();
  modalities.forEach((modality) => {
    const count = catalogModels.filter((model) => model.modality === modality).length;
    const div = document.createElement('div');
    div.className = `family-item${state.modalities.has(modality) ? ' active' : ''}`;
    div.innerHTML = `
      <input type="checkbox"${state.modalities.has(modality) ? ' checked' : ''} tabindex="-1">
      <span>${escHtml(modality)}</span>
      <span class="count">${count}</span>
    `;
    div.onclick = () => toggleModality(modality);
    container.appendChild(div);
  });
}

function renderCapabilityFilters() {
  const container = document.getElementById('capabilityFilters');
  if (!container) return;
  container.innerHTML = '';

  CAPABILITY_FILTERS.forEach(({ key, label }) => {
    const count = catalogModels.filter((model) => model[key]).length;
    if (count === 0) return;

    const div = document.createElement('div');
    div.className = `family-item${state.capabilities.has(key) ? ' active' : ''}`;
    div.innerHTML = `
      <input type="checkbox"${state.capabilities.has(key) ? ' checked' : ''} tabindex="-1">
      <span>${escHtml(label)}</span>
      <span class="count">${count}</span>
    `;
    div.onclick = () => toggleCapability(key);
    container.appendChild(div);
  });
}

function getModelYear(model) {
  const raw = model.release_date;
  if (!raw) return null;
  const match = /^(\d{4})/.exec(String(raw));
  return match ? match[1] : null;
}

function releaseToNum(model) {
  const raw = model.release_date;
  if (!raw) return null;
  const time = Date.parse(String(raw));
  return Number.isNaN(time) ? null : time;
}

function infoUpdatedToNum(model) {
  const raw = model.info_updated_at;
  if (!raw) return null;
  const time = Date.parse(String(raw));
  return Number.isNaN(time) ? null : time;
}

function availabilityCheckedToNum(model) {
  const raw = model.availability_checked_at;
  if (!raw) return null;
  const time = Date.parse(String(raw));
  return Number.isNaN(time) ? null : time;
}

function availabilityStatusToNum(model) {
  const status = model.availability_status;
  if (status === 'available') return 3;
  if (status === 'inference') return 2;
  if (status === 'unavailable') return 1;
  return 0;
}

function compareOptionalAvailability(aModel, bModel, direction) {
  const aLevel = availabilityStatusToNum(aModel);
  const bLevel = availabilityStatusToNum(bModel);
  if (aLevel === 0 && bLevel === 0) return 0;
  if (aLevel === 0) return 1;
  if (bLevel === 0) return -1;
  return direction === 'asc' ? aLevel - bLevel : bLevel - aLevel;
}

function clampQualityLevel(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(5, Math.max(0, Math.round(parsed)));
}

function normalizeQualityRange(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_QUALITY_RANGE };
  }
  let min = clampQualityLevel(raw.min);
  let max = clampQualityLevel(raw.max);
  if (min > max) {
    const swap = min;
    min = max;
    max = swap;
  }
  return { min, max };
}

function isDefaultQualityRange(range) {
  return range.min === DEFAULT_QUALITY_RANGE.min && range.max === DEFAULT_QUALITY_RANGE.max;
}

function formatQualityRangeLabel(min, max, emptyLabel) {
  if (min === 0 && max === 5) return `${emptyLabel} — 5`;
  if (min === 0 && max === 0) return emptyLabel;
  const minLabel = min === 0 ? emptyLabel : String(min);
  const maxLabel = String(max);
  return `${minLabel} — ${maxLabel}`;
}

function getModelChatRatingLevel(model) {
  const avg = model.chat_rating_avg;
  const count = model.chat_rating_count;
  if (avg == null || !count) return 0;
  return avg;
}

function getModelInferenceSpeedLevel(model) {
  const ms = model.availability_response_ms;
  if (ms == null || !Number.isFinite(ms)) return 0;
  return getInferenceResponseRating(ms);
}

function modelPassesQualityRange(level, range) {
  const { min, max } = range;
  if (isDefaultQualityRange(range)) return true;
  if (level === 0) return min === 0;
  if (min > 0 && level < min) return false;
  return level <= max;
}

let qualityFiltersBound = false;

function formatThumbValue(value, emptyLabel) {
  if (value === 0) return '—';
  return String(value);
}

function formatThumbTitle(value, emptyLabel) {
  if (value === 0) return emptyLabel;
  return `${value} из 5`;
}

function qualityValueToOffset(value) {
  const percent = value / 5;
  return `calc(8px + (100% - 16px) * ${percent})`;
}

function updateDualRangeUI(container, min, max, emptyLabel) {
  if (!container) return;

  const fill = container.querySelector('.dual-range-fill');
  const minLabel = container.querySelector('[data-thumb="min"]');
  const maxLabel = container.querySelector('[data-thumb="max"]');
  const minPercent = (min / 5) * 100;
  const maxPercent = (max / 5) * 100;

  if (fill) {
    fill.style.left = `${minPercent}%`;
    fill.style.width = `${Math.max(0, maxPercent - minPercent)}%`;
  }

  if (minLabel) {
    minLabel.textContent = formatThumbValue(min, emptyLabel);
    minLabel.title = formatThumbTitle(min, emptyLabel);
    minLabel.style.left = qualityValueToOffset(min);
  }

  if (maxLabel) {
    maxLabel.textContent = formatThumbValue(max, emptyLabel);
    maxLabel.title = formatThumbTitle(max, emptyLabel);
    maxLabel.style.left = qualityValueToOffset(max);
  }
}

function syncQualityRangeInputs() {
  const chatMin = document.getElementById('chatRatingRangeMin');
  const chatMax = document.getElementById('chatRatingRangeMax');
  const speedMin = document.getElementById('inferenceSpeedRangeMin');
  const speedMax = document.getElementById('inferenceSpeedRangeMax');

  if (chatMin && chatMax) {
    chatMin.value = String(state.chatRatingRange.min);
    chatMax.value = String(state.chatRatingRange.max);
    updateDualRangeUI(
      chatMin.closest('.dual-range'),
      state.chatRatingRange.min,
      state.chatRatingRange.max,
      CHAT_RATING_EMPTY_LABEL,
    );
  }

  if (speedMin && speedMax) {
    speedMin.value = String(state.inferenceSpeedRange.min);
    speedMax.value = String(state.inferenceSpeedRange.max);
    updateDualRangeUI(
      speedMin.closest('.dual-range'),
      state.inferenceSpeedRange.min,
      state.inferenceSpeedRange.max,
      INFERENCE_SPEED_EMPTY_LABEL,
    );
  }
}

function bindQualityDualRange(minInput, maxInput, stateKey, emptyLabel) {
  const container = minInput.closest('.dual-range');

  const onChange = (source) => {
    let min = clampQualityLevel(minInput.value);
    let max = clampQualityLevel(maxInput.value);
    if (min > max) {
      if (source === 'min') {
        max = min;
        maxInput.value = String(max);
      } else {
        min = max;
        minInput.value = String(min);
      }
    }
    state[stateKey] = { min, max };
    updateDualRangeUI(container, min, max, emptyLabel);
    state.page = 1;
    if (!isCatalogPage()) {
      navigateToCatalogFromDetail();
      return;
    }
    applyFilters();
  };

  minInput.addEventListener('input', () => onChange('min'));
  maxInput.addEventListener('input', () => onChange('max'));
  minInput.addEventListener('pointerdown', () => {
    minInput.style.zIndex = '5';
    maxInput.style.zIndex = '4';
  });
  maxInput.addEventListener('pointerdown', () => {
    maxInput.style.zIndex = '5';
    minInput.style.zIndex = '3';
  });
}

function initQualityFilters() {
  const chatMin = document.getElementById('chatRatingRangeMin');
  const chatMax = document.getElementById('chatRatingRangeMax');
  const speedMin = document.getElementById('inferenceSpeedRangeMin');
  const speedMax = document.getElementById('inferenceSpeedRangeMax');
  if (!chatMin || !chatMax || !speedMin || !speedMax) return;

  syncQualityRangeInputs();

  if (qualityFiltersBound) return;
  qualityFiltersBound = true;

  bindQualityDualRange(chatMin, chatMax, 'chatRatingRange', CHAT_RATING_EMPTY_LABEL);
  bindQualityDualRange(speedMin, speedMax, 'inferenceSpeedRange', INFERENCE_SPEED_EMPTY_LABEL);
}

function resetQualityRange(stateKey, emptyLabel, minInputId, maxInputId) {
  state[stateKey] = { ...DEFAULT_QUALITY_RANGE };
  const minInput = document.getElementById(minInputId);
  const maxInput = document.getElementById(maxInputId);
  if (minInput) minInput.value = '0';
  if (maxInput) maxInput.value = '5';
  updateDualRangeUI(minInput?.closest('.dual-range'), 0, 5, emptyLabel);
}

function compareOptionalTimestamps(aValue, bValue, direction) {
  if (aValue === null && bValue === null) return 0;
  if (aValue === null) return 1;
  if (bValue === null) return -1;
  return direction === 'asc' ? aValue - bValue : bValue - aValue;
}

function compareOptionalQualityLevel(aLevel, bLevel, direction) {
  if (aLevel === 0 && bLevel === 0) return 0;
  if (aLevel === 0) return 1;
  if (bLevel === 0) return -1;
  return direction === 'asc' ? aLevel - bLevel : bLevel - aLevel;
}

function renderYearFilters() {
  const container = document.getElementById('yearFilters');
  if (!container) return;
  container.innerHTML = '';

  const years = [...new Set(catalogModels.map((model) => getModelYear(model)).filter(Boolean))]
    .sort((a, b) => Number(b) - Number(a));
  years.forEach((year) => {
    const count = catalogModels.filter((model) => getModelYear(model) === year).length;
    const div = document.createElement('div');
    div.className = `family-item${state.years.has(year) ? ' active' : ''}`;
    div.innerHTML = `
      <input type="checkbox"${state.years.has(year) ? ' checked' : ''} tabindex="-1">
      <span>${escHtml(year)}</span>
      <span class="count">${count}</span>
    `;
    div.onclick = () => toggleYear(year);
    container.appendChild(div);
  });
}

function getUseCaseCategories() {
  return Array.isArray(window.USE_CASE_CATEGORIES) ? window.USE_CASE_CATEGORIES : [];
}

function modelMatchesUseCaseCategory(model, category) {
  return (model.use_case_categories || []).includes(category);
}

function renderCatFilters() {
  const container = document.getElementById('catFilters');
  if (!container) return;
  container.innerHTML = '';

  const categories = getUseCaseCategories();
  categories.forEach((category) => {
    const count = catalogModels.filter((model) => modelMatchesUseCaseCategory(model, category)).length;
    if (count === 0) return;
    const div = document.createElement('div');
    div.className = `family-item${state.useCase === category ? ' active' : ''}`;
    div.innerHTML = `
      <span>📌</span>
      <span>${escHtml(category)}</span>
      <span class="count">${count}</span>
    `;
    div.onclick = () => toggleUseCase(category);
    container.appendChild(div);
  });
}

function togglePrice(price) {
  if (state.prices.has(price)) state.prices.delete(price);
  else state.prices.add(price);
  state.page = 1;
  if (!isCatalogPage()) {
    navigateToCatalogFromDetail();
    return;
  }
  renderPriceFilters();
  applyFilters();
}

function toggleFamily(family) {
  if (state.families.has(family)) state.families.delete(family);
  else state.families.add(family);
  state.page = 1;
  if (!isCatalogPage()) {
    navigateToCatalogFromDetail();
    return;
  }
  renderFamilyFilters();
  applyFilters();
}

function toggleModality(modality) {
  if (state.modalities.has(modality)) state.modalities.delete(modality);
  else state.modalities.add(modality);
  state.page = 1;
  if (!isCatalogPage()) {
    navigateToCatalogFromDetail();
    return;
  }
  renderModalityFilters();
  applyFilters();
}

function toggleCapability(key) {
  if (state.capabilities.has(key)) state.capabilities.delete(key);
  else state.capabilities.add(key);
  state.page = 1;
  if (!isCatalogPage()) {
    navigateToCatalogFromDetail();
    return;
  }
  renderCapabilityFilters();
  applyFilters();
}

function toggleYear(year) {
  if (state.years.has(year)) state.years.delete(year);
  else state.years.add(year);
  state.page = 1;
  if (!isCatalogPage()) {
    navigateToCatalogFromDetail();
    return;
  }
  renderYearFilters();
  applyFilters();
}

function toggleUseCase(useCase) {
  state.useCase = state.useCase === useCase ? null : useCase;
  state.page = 1;
  if (!isCatalogPage()) {
    navigateToCatalogFromDetail();
    return;
  }
  renderCatFilters();
  applyFilters();
}

function resetFilters() {
  state.search = '';
  state.prices = new Set();
  state.families = new Set();
  state.modalities = new Set();
  state.capabilities = new Set();
  state.years = new Set();
  state.useCase = null;
  state.favoritesOnly = false;
  state.showHidden = false;
  state.availabilityStatus = null;
  state.chatRatingRange = { ...DEFAULT_QUALITY_RANGE };
  state.inferenceSpeedRange = { ...DEFAULT_QUALITY_RANGE };
  familyFiltersExpanded = false;
  state.page = 1;
  state.sort = 'default';

  const searchInput = document.getElementById('searchInput');
  const sortSelect = document.getElementById('sortSelect');
  if (searchInput) searchInput.value = '';
  syncSearchClearButton();
  if (sortSelect) sortSelect.value = 'default';

  if (!isCatalogPage()) {
    navigateToCatalogFromDetail();
    return;
  }

  renderFavoriteFilter();
  renderHiddenFilter();
  renderAvailabilityFilters();
  resetQualityRange(
    'chatRatingRange',
    CHAT_RATING_EMPTY_LABEL,
    'chatRatingRangeMin',
    'chatRatingRangeMax',
  );
  resetQualityRange(
    'inferenceSpeedRange',
    INFERENCE_SPEED_EMPTY_LABEL,
    'inferenceSpeedRangeMin',
    'inferenceSpeedRangeMax',
  );
  renderPriceFilters();
  renderFamilyFilters();
  renderModalityFilters();
  renderCapabilityFilters();
  renderYearFilters();
  renderCatFilters();
  applyFilters();
}

function setView(view) {
  state.view = view;
  document.getElementById('gridViewBtn')?.classList.toggle('active', view === 'grid');
  document.getElementById('listViewBtn')?.classList.toggle('active', view === 'list');
  document.getElementById('cardsGrid')?.classList.toggle('list-view', view === 'list');
  applyFilters();
}

function applyFilters() {
  let filtered;

  if (state.recMode && state.recOrder.length) {
    const orderMap = new Map(state.recOrder.map((id, index) => [id, index]));
    filtered = catalogModels.filter((model) => {
      if (!orderMap.has(model.id)) return false;
      if (!state.showHidden && model.is_hidden) return false;
      return true;
    });
    filtered.sort((a, b) => orderMap.get(a.id) - orderMap.get(b.id));
  } else {
    filtered = catalogModels.filter((model) => {
      if (state.search) {
        if (!buildModelNameSearchHaystack(model).includes(state.search)) return false;
      }

      if (state.prices.size > 0 && !state.prices.has(model.price_category)) return false;
      if (state.families.size > 0 && !state.families.has(model.family)) return false;
      if (state.modalities.size > 0 && !state.modalities.has(model.modality)) return false;
      for (const key of state.capabilities) {
        if (!model[key]) return false;
      }
      if (state.years.size > 0 && !state.years.has(getModelYear(model))) return false;
      if (state.useCase && !modelMatchesUseCaseCategory(model, state.useCase)) return false;
      if (state.favoritesOnly && !model.is_favorite) return false;
      if (!state.showHidden && model.is_hidden) return false;
      if (state.availabilityStatus === 'unchecked' && model.availability_status) return false;
      if (state.availabilityStatus && state.availabilityStatus !== 'unchecked'
        && model.availability_status !== state.availabilityStatus) return false;
      if (!modelPassesQualityRange(getModelChatRatingLevel(model), state.chatRatingRange)) return false;
      if (!modelPassesQualityRange(getModelInferenceSpeedLevel(model), state.inferenceSpeedRange)) return false;

      return true;
    });
  }

  const priceToNum = (value) => {
    if (!value || value === '—') return -1;
    return parseFloat(String(value).replace(',', '.')) || 0;
  };

  const contextToNum = (value) => modelContextToNum(value);

  if (!state.recMode) {
    if (state.sort === 'name_asc') filtered.sort((a, b) => a.name.localeCompare(b.name));
    else if (state.sort === 'name_desc') filtered.sort((a, b) => b.name.localeCompare(a.name));
    else if (state.sort === 'price_asc') {
      filtered.sort((a, b) => {
        const pa = priceToNum(a.prompt_price);
        const pb = priceToNum(b.prompt_price);
        if (pa === -1 && pb === -1) return 0;
        if (pa === -1) return -1;
        if (pb === -1) return 1;
        return pa - pb;
      });
    } else if (state.sort === 'price_desc') {
      filtered.sort((a, b) => {
        const pa = priceToNum(a.prompt_price);
        const pb = priceToNum(b.prompt_price);
        if (pa === -1 && pb === -1) return 0;
        if (pa === -1) return 1;
        if (pb === -1) return -1;
        return pb - pa;
      });
    } else if (state.sort === 'context_desc') {
      filtered.sort((a, b) => contextToNum(b.context_window) - contextToNum(a.context_window));
    } else if (state.sort === 'context_asc') {
      filtered.sort((a, b) => contextToNum(a.context_window) - contextToNum(b.context_window));
    } else if (state.sort === 'release_desc') {
      filtered.sort((a, b) => compareOptionalTimestamps(releaseToNum(a), releaseToNum(b), 'desc'));
    } else if (state.sort === 'release_asc') {
      filtered.sort((a, b) => compareOptionalTimestamps(releaseToNum(a), releaseToNum(b), 'asc'));
    } else if (state.sort === 'info_updated_desc') {
      filtered.sort((a, b) => compareOptionalTimestamps(infoUpdatedToNum(a), infoUpdatedToNum(b), 'desc'));
    } else if (state.sort === 'info_updated_asc') {
      filtered.sort((a, b) => compareOptionalTimestamps(infoUpdatedToNum(a), infoUpdatedToNum(b), 'asc'));
    } else if (state.sort === 'availability_desc') {
      filtered.sort((a, b) => compareOptionalAvailability(a, b, 'desc'));
    } else if (state.sort === 'availability_asc') {
      filtered.sort((a, b) => compareOptionalAvailability(a, b, 'asc'));
    } else if (state.sort === 'availability_checked_desc') {
      filtered.sort((a, b) => compareOptionalTimestamps(
        availabilityCheckedToNum(a),
        availabilityCheckedToNum(b),
        'desc',
      ));
    } else if (state.sort === 'inference_speed_desc') {
      filtered.sort((a, b) => compareOptionalQualityLevel(
        getModelInferenceSpeedLevel(a),
        getModelInferenceSpeedLevel(b),
        'desc',
      ));
    } else if (state.sort === 'inference_speed_asc') {
      filtered.sort((a, b) => compareOptionalQualityLevel(
        getModelInferenceSpeedLevel(a),
        getModelInferenceSpeedLevel(b),
        'asc',
      ));
    } else if (state.sort === 'chat_rating_desc') {
      filtered.sort((a, b) => compareOptionalQualityLevel(
        getModelChatRatingLevel(a),
        getModelChatRatingLevel(b),
        'desc',
      ));
    } else if (state.sort === 'chat_rating_asc') {
      filtered.sort((a, b) => compareOptionalQualityLevel(
        getModelChatRatingLevel(a),
        getModelChatRatingLevel(b),
        'asc',
      ));
    }
  }

  lastFilteredModelIds = filtered.map((model) => model.id);

  const filteredCount = document.getElementById('filteredCount');
  const shownCount = document.getElementById('shownCount');
  if (filteredCount) filteredCount.textContent = String(filtered.length);
  document.querySelectorAll('[data-stat="shown"]').forEach((el) => {
    el.textContent = String(filtered.length);
  });

  renderActiveFilters();
  renderCards(filtered);
  renderPagination(filtered.length);
  persistLastCatalogFilters();
}

function modelContextToNum(value) {
  if (!value) return 0;
  return Number(value) || 0;
}

function renderActiveFilters() {
  const container = document.getElementById('activeFilters');
  if (!container) return;
  container.innerHTML = '';

  state.prices.forEach((price) => {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${PRICE_LABELS[price]} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => togglePrice(price));
    container.appendChild(tag);
  });

  state.families.forEach((family) => {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escHtml(family)} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => toggleFamily(family));
    container.appendChild(tag);
  });

  state.modalities.forEach((modality) => {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escHtml(modality)} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => toggleModality(modality));
    container.appendChild(tag);
  });

  state.capabilities.forEach((key) => {
    const label = CAPABILITY_LABELS[key] || key;
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escHtml(label)} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => toggleCapability(key));
    container.appendChild(tag);
  });

  state.years.forEach((year) => {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escHtml(year)} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => toggleYear(year));
    container.appendChild(tag);
  });

  if (state.useCase) {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escHtml(state.useCase)} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => toggleUseCase(state.useCase));
    container.appendChild(tag);
  }

  if (state.favoritesOnly) {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = '⭐ Избранные <span class="remove">×</span>';
    tag.querySelector('.remove')?.addEventListener('click', () => {
      state.favoritesOnly = false;
      state.page = 1;
      renderFavoriteFilter();
      applyFilters();
    });
    container.appendChild(tag);
  }

  if (state.showHidden) {
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = '👁 Скрытые <span class="remove">×</span>';
    tag.querySelector('.remove')?.addEventListener('click', () => {
      state.showHidden = false;
      state.page = 1;
      renderHiddenFilter();
      applyFilters();
    });
    container.appendChild(tag);
  }

  if (state.availabilityStatus) {
    const label = AVAILABILITY_LABELS[state.availabilityStatus] || state.availabilityStatus;
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escHtml(label)} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => {
      state.availabilityStatus = null;
      state.page = 1;
      renderAvailabilityFilters();
      applyFilters();
    });
    container.appendChild(tag);
  }

  if (!isDefaultQualityRange(state.chatRatingRange)) {
    const label = `★ Оценка: ${formatQualityRangeLabel(
      state.chatRatingRange.min,
      state.chatRatingRange.max,
      CHAT_RATING_EMPTY_LABEL,
    )}`;
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escHtml(label)} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => {
      resetQualityRange(
        'chatRatingRange',
        CHAT_RATING_EMPTY_LABEL,
        'chatRatingRangeMin',
        'chatRatingRangeMax',
      );
      state.page = 1;
      applyFilters();
    });
    container.appendChild(tag);
  }

  if (!isDefaultQualityRange(state.inferenceSpeedRange)) {
    const label = `⚡ Скорость: ${formatQualityRangeLabel(
      state.inferenceSpeedRange.min,
      state.inferenceSpeedRange.max,
      INFERENCE_SPEED_EMPTY_LABEL,
    )}`;
    const tag = document.createElement('div');
    tag.className = 'filter-tag';
    tag.innerHTML = `${escHtml(label)} <span class="remove">×</span>`;
    tag.querySelector('.remove')?.addEventListener('click', () => {
      resetQualityRange(
        'inferenceSpeedRange',
        INFERENCE_SPEED_EMPTY_LABEL,
        'inferenceSpeedRangeMin',
        'inferenceSpeedRangeMax',
      );
      state.page = 1;
      applyFilters();
    });
    container.appendChild(tag);
  }
}

function renderCards(filtered) {
  const grid = document.getElementById('cardsGrid');
  if (!grid) return;

  grid.className = `cards-grid${state.view === 'list' ? ' list-view' : ''}`;

  const start = (state.page - 1) * state.perPage;
  const pageData = filtered.slice(start, start + state.perPage);

  if (!pageData.length) {
    grid.innerHTML = `
      <div class="no-results">
        <div class="icon">🔍</div>
        <p>Ничего не найдено. Попробуйте изменить фильтры.</p>
      </div>`;
    return;
  }

  if (state.view === 'list') {
    grid.innerHTML = `
      <div class="catalog-list-wrap">
        <div class="catalog-list">
          ${renderListHeader()}
          <div class="catalog-list-body">
            ${pageData.map((model) => renderListRow(model)).join('')}
          </div>
        </div>
      </div>`;
  } else {
    grid.innerHTML = pageData.map((model) => renderCard(model)).join('');
  }

  updateBulkMenuButtonState();

  grid.querySelectorAll('.card-compare-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!window.CompareBuffer || !button.dataset.id) return;
      window.CompareBuffer.toggle(button.dataset.id);
      updateCompareButtonState(button, window.CompareBuffer.has(button.dataset.id));
    });
  });

  grid.querySelectorAll('.card-edit-btn, .card-chat-btn').forEach((link) => {
    link.addEventListener('click', (event) => event.stopPropagation());
  });

  grid.querySelectorAll('button.card-hidden-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleHidden(button.dataset.id);
    });
  });

  grid.querySelectorAll('button.card-favorite-btn').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleFavorite(button.dataset.id);
    });
  });

  grid.querySelectorAll('.card-model-name').forEach((element) => {
    element.addEventListener('click', () => {
      const id = element.dataset.id;
      const model = catalogModels.find((item) => item.id === id);
      if (model) openModal(model);
    });
  });

  window.CopyModelName?.bindAll(grid);

  grid.querySelectorAll('[data-list-sort]').forEach((button) => {
    button.addEventListener('click', () => {
      applyListColumnSort(button.dataset.listSort);
    });
  });

  const listSelectAllCheckbox = document.getElementById('listSelectAllCheckbox');
  if (listSelectAllCheckbox) {
    listSelectAllCheckbox.addEventListener('click', () => {
      const visibleIds = getVisibleCardIds();
      const selectedSet = new Set(getSelectedModelIds());
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
      if (allSelected) {
        deselectAllVisibleCards();
      } else {
        selectAllVisibleCardsOnPage();
      }
      syncCompareButtonsFromBuffer();
    });
    updateListSelectAllCheckbox();
  }
}

function syncSortSelect() {
  const sortSelect = document.getElementById('sortSelect');
  if (!sortSelect) return;
  const hasOption = Array.from(sortSelect.options).some((option) => option.value === state.sort);
  sortSelect.value = hasOption ? state.sort : 'default';
}

function getListSortColumnKey(sort) {
  return Object.entries(LIST_SORT_COLUMNS).find(([, config]) => (
    config.asc === sort || config.desc === sort
  ))?.[0] ?? null;
}

function getListSortDirection(sort) {
  return Object.values(LIST_SORT_COLUMNS).find((config) => config.asc === sort)
    ? 'asc'
    : Object.values(LIST_SORT_COLUMNS).find((config) => config.desc === sort)
      ? 'desc'
      : null;
}

function applyListColumnSort(columnKey) {
  const config = LIST_SORT_COLUMNS[columnKey];
  if (!config) return;

  const activeColumn = getListSortColumnKey(state.sort);
  if (activeColumn === columnKey) {
    state.sort = getListSortDirection(state.sort) === 'desc' ? config.asc : config.desc;
  } else {
    state.sort = config.default;
  }

  state.page = 1;
  syncSortSelect();
  applyFilters();
}

function renderListSortIndicator(columnKey) {
  if (getListSortColumnKey(state.sort) !== columnKey) return '';
  const direction = getListSortDirection(state.sort);
  return `<span class="list-sort-indicator" aria-hidden="true">${direction === 'asc' ? '↑' : '↓'}</span>`;
}

function renderListHeaderSortButton(columnKey, label, alignClass = '', title = '') {
  const isActive = getListSortColumnKey(state.sort) === columnKey;
  const titleAttr = title ? ` title="${escHtml(title)}"` : '';
  return `
    <button
      type="button"
      class="list-col-sort${alignClass ? ` ${alignClass}` : ''}${isActive ? ' is-active' : ''}"
      data-list-sort="${columnKey}"
      aria-label="Сортировать: ${escHtml(label)}"${titleAttr}
    ><span class="list-sort-label">${escHtml(label)}</span>${renderListSortIndicator(columnKey)}</button>`;
}

function getAvailabilityBadgeClass(status) {
  if (status === 'available') return 'availability-available';
  if (status === 'inference') return 'availability-inference';
  if (status === 'unavailable') return 'availability-unavailable';
  return 'availability-unknown';
}

function getAvailabilityBadgeLabel(status) {
  if (status === 'available') return 'Доступна';
  if (status === 'inference') return 'Инференс';
  if (status === 'unavailable') return 'Недоступна';
  return '';
}

const INFERENCE_LATENCY_LABELS = {
  1: 'очень медленно',
  2: 'медленно',
  3: 'средне',
  4: 'быстро',
  5: 'мгновенно',
};

function getInferenceResponseRating(ms) {
  if (ms <= 800) return 5;
  if (ms <= 2000) return 4;
  if (ms <= 4000) return 3;
  if (ms <= 8000) return 2;
  return 1;
}

function renderInferenceSpeedBadge(model) {
  const ms = model.availability_response_ms;
  if (ms == null || !Number.isFinite(ms)) return '';
  const rating = getInferenceResponseRating(ms);
  const label = INFERENCE_LATENCY_LABELS[rating];
  const formattedMs = Math.round(ms).toLocaleString('ru-RU');
  const title = `Скорость ответа при проверке inference: ${rating}/5 (${label}) · ${formattedMs} мс`;
  return `<span class="assistant-preview-meta-badge" title="${escHtml(title)}">⚡ ${rating}/5</span>`;
}

function renderChatRatingBadge(model) {
  if (!model.chat_rating_label) return '';
  const titleAttr = model.chat_rating_title
    ? ` title="${escHtml(model.chat_rating_title)}"`
    : '';
  return `<span class="assistant-preview-meta-badge chat-rating-badge"${titleAttr}>${escHtml(model.chat_rating_label)}</span>`;
}

function getModelPriceValues(model) {
  const isFree = model.price_category === '🆓 Бесплатные';
  const promptVal = model.prompt_price === '—' || !model.prompt_price ? '—' : model.prompt_price;
  const answerVal = model.answer_price === '—' || !model.answer_price ? '—' : model.answer_price;
  return { isFree, promptVal, answerVal };
}

function formatListPriceCell(model, totalPrice) {
  const { value, isFree } = totalPrice;
  if (value === '—' || !value) {
    return '<span class="list-col-value list-col-value-muted">—</span>';
  }
  const colorClass = PRICE_COLORS[model.price_category] || 'optimal-color';
  const text = isFree ? '0' : `${value} ₽`;
  return `<span class="list-col-value ${colorClass}">${escHtml(text)}</span>`;
}

function getModelTotalPriceDisplay(model) {
  const { isFree, promptVal, answerVal } = getModelPriceValues(model);
  if (isFree) return { value: '0', isFree: true };

  const toNum = (value) => {
    if (!value || value === '—') return null;
    return parseFloat(String(value).replace(',', '.')) || 0;
  };

  const promptNum = toNum(promptVal);
  const answerNum = toNum(answerVal);

  if (promptNum === null && answerNum === null) return { value: '—', isFree: false };

  const sum = (promptNum ?? 0) + (answerNum ?? 0);
  return { value: String(sum), isFree: sum === 0 };
}

function renderCardActions(model) {
  const inCompare = window.CompareBuffer?.has(model.id) ?? false;
  const detailPath = `/models/${model.id}`;
  const id = escHtml(model.id);
  const AA = window.AdminAccess;
  const hiddenTitle = model.is_hidden ? 'Показать в каталоге' : 'Скрыть модель';
  const favoriteTitle = model.is_favorite ? 'Убрать из избранного' : 'Добавить в избранное';

  if (AA?.needsLogin()) {
    const chatHref = escHtml(AA.protectedHref(`${detailPath}/chat?from=catalog`));
    const editHref = escHtml(AA.protectedHref(`${detailPath}/edit`));
    const loginDetailHref = escHtml(AA.protectedHref(detailPath));

    return `
    <a href="${chatHref}" class="card-chat-btn" title="Чат с моделью" aria-label="Чат с моделью">${CARD_CHAT_ICON}</a>
    <a href="${editHref}" class="card-edit-btn" title="Редактировать модель" aria-label="Редактировать модель">✎</a>
    <a href="${loginDetailHref}" class="card-hidden-btn" title="${hiddenTitle}" aria-label="${hiddenTitle}">${model.is_hidden ? CARD_EYE_OFF_ICON : CARD_EYE_ICON}</a>
    <a href="${loginDetailHref}" class="card-favorite-btn${model.is_favorite ? ' active' : ''}" title="${favoriteTitle}" aria-label="${favoriteTitle}">★</a>
    <button
      type="button"
      class="card-compare-btn${inCompare ? ' active' : ''}"
      data-id="${id}"
      title="${getCompareButtonTitle(inCompare)}"
      aria-label="${getCompareButtonTitle(inCompare)}"
      aria-pressed="${inCompare ? 'true' : 'false'}"
    >
      <span class="compare-btn-icon" aria-hidden="true">${getCompareIcon(inCompare)}</span>
    </button>`;
  }

  return `
    <a href="/models/${id}/chat?from=catalog" class="card-chat-btn" title="Чат с моделью" aria-label="Чат с моделью">${CARD_CHAT_ICON}</a>
    <a href="/models/${id}/edit" class="card-edit-btn" title="Редактировать модель" aria-label="Редактировать модель">✎</a>
    <button type="button" class="card-hidden-btn" data-id="${id}" title="${hiddenTitle}" aria-label="${hiddenTitle}">${model.is_hidden ? CARD_EYE_OFF_ICON : CARD_EYE_ICON}</button>
    <button type="button" class="card-favorite-btn${model.is_favorite ? ' active' : ''}" data-id="${id}" title="${favoriteTitle}" aria-label="${favoriteTitle}">★</button>
    <button
      type="button"
      class="card-compare-btn${inCompare ? ' active' : ''}"
      data-id="${id}"
      title="${getCompareButtonTitle(inCompare)}"
      aria-label="${getCompareButtonTitle(inCompare)}"
      aria-pressed="${inCompare ? 'true' : 'false'}"
    >
      <span class="compare-btn-icon" aria-hidden="true">${getCompareIcon(inCompare)}</span>
    </button>`;
}

function renderListHeader() {
  return `
    <div class="catalog-list-header">
      <div class="list-col list-col-model">${renderListHeaderSortButton('model', 'Модель')}</div>
      <div class="list-col list-col-availability">${renderListHeaderSortButton('availability', 'Доступность')}</div>
      <div class="list-col list-col-badge">${renderListHeaderSortButton('inference_speed', 'Скорость', '', 'Скорость ответа при проверке inference')}</div>
      <div class="list-col list-col-badge">${renderListHeaderSortButton('chat_rating', 'Оценка', '', 'Средняя оценка ответов в чате')}</div>
      <div class="list-col list-col-num">${renderListHeaderSortButton('context', 'Контекст', 'list-col-sort-end')}</div>
      <div class="list-col list-col-num">${renderListHeaderSortButton('price', 'Стоимость', 'list-col-sort-end')}</div>
      <div class="list-col list-col-actions">
        <button
          type="button"
          class="card-compare-btn list-select-all-btn"
          id="listSelectAllCheckbox"
          role="checkbox"
          aria-checked="false"
          aria-label="Выделить все на странице"
          title="Выделить все на странице"
        >
          <span class="compare-btn-icon" aria-hidden="true">${COMPARE_CHECK_OFF_ICON}</span>
        </button>
      </div>
    </div>`;
}

function formatListModelLabel(model) {
  const name = model.name?.trim() || '';
  const family = model.family?.trim() || '';
  if (family) return `${family} / ${name}`;
  return name;
}

function renderModelNameWithCopy(model, displayLabel) {
  const label = displayLabel ?? model.name ?? '';
  const copyBtn = model.name ? (window.CopyModelName?.buttonHtml(model.name) || '') : '';
  return `<span class="card-model-name-row">
    <span class="card-model-name" data-id="${escHtml(model.id)}" title="Открыть описание модели">${escHtml(label)}</span>
    ${copyBtn}
  </span>`;
}

function renderListRow(model) {
  const totalPrice = getModelTotalPriceDisplay(model);
  const availabilityCell = model.availability_status
    ? `<span class="availability-badge ${getAvailabilityBadgeClass(model.availability_status)}" title="${escHtml(getAvailabilityBadgeLabel(model.availability_status))}">${escHtml(getAvailabilityBadgeLabel(model.availability_status))}</span>`
    : '<span class="list-col-muted">—</span>';
  const inferenceSpeedCell = renderInferenceSpeedBadge(model) || '<span class="list-col-muted">—</span>';
  const chatRatingCell = renderChatRatingBadge(model) || '<span class="list-col-muted">—</span>';

  return `
    <div class="catalog-list-row model-card${model.is_favorite ? ' is-favorite' : ''}${model.is_hidden ? ' is-hidden' : ''}" data-id="${escHtml(model.id)}">
      <div class="list-col list-col-model">
        ${renderModelNameWithCopy(model, formatListModelLabel(model))}
      </div>
      <div class="list-col list-col-availability">${availabilityCell}</div>
      <div class="list-col list-col-badge">${inferenceSpeedCell}</div>
      <div class="list-col list-col-badge">${chatRatingCell}</div>
      <div class="list-col list-col-num"><span class="list-context-chip">${escHtml(model.context || '—')}</span></div>
      <div class="list-col list-col-num">${formatListPriceCell(model, totalPrice)}</div>
      <div class="list-col list-col-actions">
        <div class="card-actions">${renderCardActions(model)}</div>
      </div>
    </div>`;
}

function renderCard(model) {
  const colorClass = PRICE_COLORS[model.price_category] || '';
  const { isFree, promptVal, answerVal } = getModelPriceValues(model);
  const availabilityBadge = model.availability_status
    ? `<span class="availability-badge ${getAvailabilityBadgeClass(model.availability_status)}" title="${escHtml(getAvailabilityBadgeLabel(model.availability_status))}">${escHtml(getAvailabilityBadgeLabel(model.availability_status))}</span>`
    : '';
  const inferenceSpeedBadge = renderInferenceSpeedBadge(model);

  const catBadges = (model.use_case_categories || []).slice(0, 3).map((category) => {
    const isHighlight = state.useCase === category;
    return `<span class="cat-badge${isHighlight ? ' highlight' : ''}">📌 ${escHtml(category)}</span>`;
  }).join('');

  return `
    <div class="model-card${model.is_favorite ? ' is-favorite' : ''}${model.is_hidden ? ' is-hidden' : ''}" data-id="${escHtml(model.id)}">
      <div class="card-header">
        <span class="card-price-badge ${colorClass}"></span>
        <div class="card-header-main">
          <div class="card-header-row">
            <div class="card-title">
              ${renderModelNameWithCopy(model)}
            </div>
            <div class="card-actions">${renderCardActions(model)}</div>
          </div>
          <div class="card-meta-badges">
            <span class="card-family">${escHtml(model.family)}</span>
            ${availabilityBadge}
            ${inferenceSpeedBadge}
            ${renderChatRatingBadge(model)}
          </div>
        </div>
      </div>
      ${model.description ? `<div class="card-recommendation">${escHtml(model.description)}</div>` : ''}
      <div class="card-specs">
        <div class="spec-item">
          <div class="spec-label">Контекст</div>
          <div class="spec-value">${escHtml(model.context || '—')}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Вывод (max)</div>
          <div class="spec-value">${escHtml(model.output_max || '—')}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Промпт / 1M</div>
          <div class="spec-value ${isFree || promptVal === '—' ? 'free' : 'price'}">${escHtml(String(promptVal))}${promptVal !== '—' && !isFree ? ' ₽' : ''}</div>
        </div>
        <div class="spec-item">
          <div class="spec-label">Ответ / 1M</div>
          <div class="spec-value ${isFree || answerVal === '—' ? 'free' : 'price'}">${escHtml(String(answerVal))}${answerVal !== '—' && !isFree ? ' ₽' : ''}</div>
        </div>
      </div>
      <div class="card-cats">${catBadges}</div>
    </div>`;
}

function renderPagination(total) {
  const container = document.getElementById('pagination');
  if (!container) return;

  const totalPages = Math.ceil(total / state.perPage);
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<button class="page-btn" data-page="${state.page - 1}"${state.page === 1 ? ' disabled' : ''}>‹</button>`;

  const range = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || (i >= state.page - 2 && i <= state.page + 2)) {
      range.push(i);
    } else if (range[range.length - 1] !== '…') {
      range.push('…');
    }
  }

  range.forEach((page) => {
    if (page === '…') {
      html += '<span class="page-info">…</span>';
    } else {
      html += `<button class="page-btn${page === state.page ? ' active' : ''}" data-page="${page}">${page}</button>`;
    }
  });

  html += `<button class="page-btn" data-page="${state.page + 1}"${state.page === totalPages ? ' disabled' : ''}>›</button>`;
  container.innerHTML = html;

  container.querySelectorAll('.page-btn[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const page = Number(button.dataset.page);
      goPage(page, total);
    });
  });
}

function goPage(page, total) {
  const totalPages = Math.ceil(total / state.perPage);
  if (page < 1 || page > totalPages) return;
  state.page = page;
  applyFilters();
  document.querySelector('.main')?.scrollTo(0, 0);
  window.scrollTo(0, 0);
}

function openModal(model) {
  const isFree = model.price_category === '🆓 Бесплатные';
  const promptVal = model.prompt_price === '—' || !model.prompt_price ? '—' : model.prompt_price;
  const answerVal = model.answer_price === '—' || !model.answer_price ? '—' : model.answer_price;

  document.getElementById('mName').textContent = model.name;
  document.getElementById('mDeveloper').textContent = `🏢 ${model.family}`;

  const badges = [
    `<span class="modal-badge type">${escHtml(model.modality)}</span>`,
    `<span class="modal-badge">${escHtml(PRICE_LABELS[model.price_category] || model.price_category)}</span>`,
  ];
  if (model.release_date) badges.push(`<span class="modal-badge">Релиз: ${escHtml(model.release_date)}</span>`);
  if (model.supports_vision) badges.push('<span class="modal-badge">Vision</span>');
  if (model.supports_function_calling) badges.push('<span class="modal-badge">Function calling</span>');
  if (model.supports_json_mode) badges.push('<span class="modal-badge">JSON mode</span>');
  if (model.supports_streaming) badges.push('<span class="modal-badge">Streaming</span>');
  if (model.supports_web_search) badges.push('<span class="modal-badge">Поиск в интернете</span>');
  if (model.is_favorite) badges.push('<span class="modal-badge favorite-badge">⭐ Избранное</span>');
  document.getElementById('mBadges').innerHTML = badges.join('');

  const descEl = document.getElementById('mDescription');
  if (descEl) {
    const description = model.description || 'Описание недоступно.';
    descEl.innerHTML = typeof formatMarkdownContent === 'function'
      ? formatMarkdownContent(description)
      : escHtml(description).replace(/\n/g, '<br>');
  }

  const updatedEl = document.getElementById('mUpdated');
  if (updatedEl) {
    updatedEl.textContent = getModelLastUpdateText(model);
    updatedEl.classList.toggle('muted', !model.info_updated_at && !model.updated_at);
  }

  document.getElementById('mSpecs').innerHTML = [
    ['Контекст', model.context || '—', ''],
    ['Макс. вывод', model.output_max || '—', ''],
    ['Промпт / 1M', promptVal !== '—' && !isFree ? `${promptVal} ₽` : promptVal, isFree || promptVal === '—' ? 'free' : 'price'],
    ['Ответ / 1M', answerVal !== '—' && !isFree ? `${answerVal} ₽` : answerVal, isFree || answerVal === '—' ? 'free' : 'price'],
  ].map(([label, value, cls]) => `
    <div class="modal-spec">
      <div class="modal-spec-label">${label}</div>
      <div class="modal-spec-value ${cls}">${escHtml(String(value))}</div>
    </div>`).join('');

  const strengths = model.pros || [];
  document.getElementById('mStrengths').innerHTML = strengths.map((item) => `<li>${escHtml(item)}</li>`).join('');
  document.getElementById('mStrengthsSection').style.display = strengths.length ? '' : 'none';

  const bestFor = model.use_cases || [];
  document.getElementById('mBestFor').innerHTML = bestFor.map((item) => `<li>${escHtml(item)}</li>`).join('');
  document.getElementById('mBestForSection').style.display = bestFor.length ? '' : 'none';

  const limits = model.cons || [];
  document.getElementById('mLimits').innerHTML = limits.map((item) => `<li>${escHtml(item)}</li>`).join('');
  document.getElementById('mLimitsSection').style.display = limits.length ? '' : 'none';

  const catsHtml = (model.use_cases || []).map((item) => `<span class="modal-cat-badge">📌 ${escHtml(item)}</span>`).join('');
  document.getElementById('mCats').innerHTML = catsHtml;
  document.getElementById('mCatsSection').style.display = catsHtml ? '' : 'none';

  const detailLink = document.getElementById('mDetailLink');
  const chatLink = document.getElementById('mChatLink');
  const editLink = document.getElementById('mEditLink');
  const AA = window.AdminAccess;
  if (detailLink) detailLink.href = `/models/${model.id}`;
  if (chatLink) {
    chatLink.href = AA
      ? AA.protectedHref(`/models/${model.id}/chat?from=catalog`)
      : `/models/${model.id}/chat?from=catalog`;
  }
  if (editLink) {
    editLink.href = AA
      ? AA.protectedHref(`/models/${model.id}/edit`)
      : `/models/${model.id}/edit`;
  }

  const hiddenBtn = document.getElementById('mHiddenBtn');
  if (hiddenBtn) {
    hiddenBtn.dataset.id = model.id;
    updateModalHiddenBtn(model.is_hidden);
  }

  const favoriteBtn = document.getElementById('mFavoriteBtn');
  if (favoriteBtn) {
    favoriteBtn.dataset.id = model.id;
    updateModalFavoriteBtn(model.is_favorite);
  }

  const compareBtn = document.getElementById('mCompareBtn');
  if (compareBtn) {
    compareBtn.dataset.id = model.id;
    updateCompareButtonState(compareBtn, window.CompareBuffer?.has(model.id) ?? false);
  }

  const copyNameBtn = document.getElementById('mCopyNameBtn');
  if (copyNameBtn) {
    copyNameBtn.dataset.copyText = model.name || '';
    copyNameBtn.hidden = !model.name;
    window.CopyModelName?.bind(copyNameBtn);
  }

  document.getElementById('modalOverlay')?.classList.add('open');
  document.getElementById('modalBox').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay')?.classList.remove('open');
  document.body.style.overflow = '';
}

function handleOverlayClick(event) {
  if (event.target === document.getElementById('modalOverlay')) closeModal();
}

function updateFavoriteButtonState(button, isFavorite) {
  if (!button) return;
  button.classList.toggle('active', Boolean(isFavorite));
  button.textContent = '★';
  const title = isFavorite ? 'Убрать из избранного' : 'Добавить в избранное';
  button.title = title;
  button.setAttribute('aria-label', title);
}

function updateHiddenButtonState(button, isHidden) {
  if (!button) return;
  button.innerHTML = isHidden ? CARD_EYE_OFF_ICON : CARD_EYE_ICON;
  const title = isHidden ? 'Показать в каталоге' : 'Скрыть модель';
  button.title = title;
  button.setAttribute('aria-label', title);
}

function initDetailHeroActions() {
  const favoriteBtn = document.getElementById('detailFavoriteBtn');
  const hiddenBtn = document.getElementById('detailHiddenBtn');
  const compareBtn = document.getElementById('detailCompareBtn');

  if (window.AdminAccess?.needsLogin()) {
    const guestHiddenBtn = document.querySelector('.detail-hero-actions a.card-hidden-btn');
    if (guestHiddenBtn) {
      updateHiddenButtonState(guestHiddenBtn, Boolean(window.DETAIL_PAGE?.isHidden));
    }
    if (compareBtn) {
      compareBtn.addEventListener('click', (event) => {
        event.stopPropagation();
        if (!window.CompareBuffer || !compareBtn.dataset.id) return;
        window.CompareBuffer.toggle(compareBtn.dataset.id);
        updateCompareButtonState(compareBtn, window.CompareBuffer.has(compareBtn.dataset.id));
      });
      if (window.CompareBuffer) {
        updateCompareButtonState(compareBtn, window.CompareBuffer.has(compareBtn.dataset.id));
      }
    }
    return;
  }

  if (!favoriteBtn && !hiddenBtn && !compareBtn) return;

  const modelId = favoriteBtn?.dataset.id || hiddenBtn?.dataset.id || compareBtn?.dataset.id;
  const model = catalogModels.find((item) => item.id === modelId);
  if (!model) return;

  if (favoriteBtn) {
    updateFavoriteButtonState(favoriteBtn, model.is_favorite);
    favoriteBtn.addEventListener('click', () => toggleFavorite(model.id));
  }

  if (hiddenBtn) {
    updateHiddenButtonState(hiddenBtn, model.is_hidden);
    hiddenBtn.addEventListener('click', () => toggleHidden(model.id));
  }

  if (compareBtn) {
    compareBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (!window.CompareBuffer || !compareBtn.dataset.id) return;
      window.CompareBuffer.toggle(compareBtn.dataset.id);
      updateCompareButtonState(compareBtn, window.CompareBuffer.has(compareBtn.dataset.id));
    });
    if (window.CompareBuffer) {
      updateCompareButtonState(compareBtn, window.CompareBuffer.has(compareBtn.dataset.id));
    }
  }
}

function updateModalFavoriteBtn(isFavorite) {
  updateFavoriteButtonState(document.getElementById('mFavoriteBtn'), isFavorite);
  updateFavoriteButtonState(document.getElementById('detailFavoriteBtn'), isFavorite);
  updateFavoriteButtonState(document.getElementById('chatFavoriteBtn'), isFavorite);
  updateFavoriteButtonState(document.getElementById('assistantFavoriteBtn'), isFavorite);
}

function updateModalHiddenBtn(isHidden) {
  updateHiddenButtonState(document.getElementById('mHiddenBtn'), isHidden);
  updateHiddenButtonState(document.getElementById('detailHiddenBtn'), isHidden);
  updateHiddenButtonState(document.getElementById('chatHiddenBtn'), isHidden);
  updateHiddenButtonState(document.getElementById('assistantHiddenBtn'), isHidden);
}

async function toggleFavorite(id) {
  const model = catalogModels.find((item) => item.id === id);
  if (!model) return;
  try {
    const updated = await patchModelFields(id, { is_favorite: !model.is_favorite });
    syncModelInCatalog(updated);
    renderFavoriteFilter();
    applyFilters();
    const favoriteBtn = document.getElementById('mFavoriteBtn');
    if (!favoriteBtn || favoriteBtn.dataset.id === String(id)) {
      updateModalFavoriteBtn(updated.is_favorite);
    }
  } catch {
    alert('Не удалось обновить избранное');
  }
}

async function toggleHidden(id) {
  const model = catalogModels.find((item) => item.id === id);
  if (!model) return;
  if (!model.is_hidden && !confirm(`Скрыть модель «${model.name}» из каталога?`)) return;
  try {
    const updated = await patchModelFields(id, { is_hidden: !model.is_hidden });
    syncModelInCatalog(updated);
    renderHiddenFilter();
    applyFilters();
    const hiddenBtn = document.getElementById('mHiddenBtn');
    if (!hiddenBtn || hiddenBtn.dataset.id === String(id)) {
      updateModalHiddenBtn(updated.is_hidden);
    }
  } catch {
    alert('Не удалось обновить признак «Скрытая»');
  }
}

function getVisibleCardIds() {
  return [...document.querySelectorAll('#cardsGrid .card-compare-btn[data-id]')]
    .map((button) => button.dataset.id)
    .filter(Boolean);
}

function getFilteredModelIds() {
  return lastFilteredModelIds;
}

function getSelectedModelIds() {
  return window.CompareBuffer ? window.CompareBuffer.getIds() : [];
}

function updateListSelectAllCheckbox() {
  const button = document.getElementById('listSelectAllCheckbox');
  if (!button) return;

  const icon = button.querySelector('.compare-btn-icon');
  const visibleIds = getVisibleCardIds();
  if (visibleIds.length === 0) {
    button.disabled = true;
    button.classList.remove('active', 'is-indeterminate');
    button.setAttribute('aria-checked', 'false');
    if (icon) icon.innerHTML = COMPARE_CHECK_OFF_ICON;
    return;
  }

  button.disabled = false;
  const selectedSet = new Set(getSelectedModelIds());
  const selectedVisibleCount = visibleIds.filter((id) => selectedSet.has(id)).length;
  const allSelected = selectedVisibleCount === visibleIds.length;
  const indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;

  button.classList.toggle('active', allSelected);
  button.classList.toggle('is-indeterminate', indeterminate);
  button.setAttribute('aria-checked', allSelected ? 'true' : indeterminate ? 'mixed' : 'false');
  if (icon) icon.innerHTML = getListSelectAllIcon(allSelected, indeterminate);
}

function selectAllVisibleCardsOnPage() {
  if (!window.CompareBuffer) return;
  const ids = new Set(window.CompareBuffer.getIds());
  getVisibleCardIds().forEach((id) => ids.add(id));
  window.CompareBuffer.setIds([...ids]);
  updateBulkMenuButtonState();
}

function selectAllVisibleCards() {
  if (!window.CompareBuffer) return;
  const existingCount = window.CompareBuffer.getIds().length;
  if (existingCount > 0) {
    const shouldClear = confirm(
      `Список выбранных моделей уже содержит ${existingCount} карточек. Очистить этот список перед отметкой новых карточек?`
    );
    if (shouldClear) window.CompareBuffer.setIds([]);
  }
  selectAllVisibleCardsOnPage();
}

function selectAllFilteredModelsOnList() {
  if (!window.CompareBuffer) return;
  const ids = new Set(window.CompareBuffer.getIds());
  getFilteredModelIds().forEach((id) => ids.add(id));
  window.CompareBuffer.setIds([...ids]);
  updateBulkMenuButtonState();
}

function selectAllFilteredModels() {
  if (!window.CompareBuffer) return;
  const filteredIds = getFilteredModelIds();
  if (filteredIds.length === 0) return;
  const existingCount = window.CompareBuffer.getIds().length;
  if (existingCount > 0) {
    const shouldClear = confirm(
      `Список выбранных моделей уже содержит ${existingCount} карточек. Очистить этот список перед отметкой новых карточек?`
    );
    if (shouldClear) window.CompareBuffer.setIds([]);
  }
  selectAllFilteredModelsOnList();
}

function deselectAllVisibleCards() {
  if (!window.CompareBuffer) return;
  const visible = new Set(getVisibleCardIds());
  window.CompareBuffer.setIds(window.CompareBuffer.getIds().filter((id) => !visible.has(id)));
  updateBulkMenuButtonState();
  updateListSelectAllCheckbox();
}

function updateBulkMenuButtonState() {
  const button = document.getElementById('bulkSelectionMenuBtn');
  if (!button) return;
  const visibleCount = getVisibleCardIds().length;
  const count = getSelectedModelIds().length;
  button.disabled = visibleCount === 0;
  button.title = count > 0
    ? `Действия с выбранными (${count})`
    : 'Действия с карточками';
}

function initToolbarBulkMenu() {
  const button = document.getElementById('bulkSelectionMenuBtn');
  const menu = document.getElementById('bulkSelectionMenu');
  if (!button || !menu) return;

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (button.disabled) return;
    toggleBulkSelectionMenu(button);
  });

  menu.addEventListener('click', (event) => {
    const item = event.target.closest('[data-action]');
    if (!item) return;

    const action = item.dataset.action;
    if (BULK_ADMIN_ACTIONS.has(action) && window.AdminAccess?.needsLogin()) {
      closeBulkSelectionMenu();
      if (!window.AdminAccess.guardAction(event, '/admin')) return;
    }

    if (item.disabled) return;
    event.stopPropagation();
    void handleBulkSelectionAction(action);
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('#bulkSelectionMenuBtn') || event.target.closest('#bulkSelectionMenu')) return;
    closeBulkSelectionMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeBulkSelectionMenu();
  });

  window.addEventListener('resize', closeBulkSelectionMenu);
  window.addEventListener('scroll', closeBulkSelectionMenu, true);
}

function positionBulkSelectionMenu(menu, anchorRect) {
  const MARGIN = 8;
  const GAP = 6;

  menu.style.maxHeight = '';
  menu.style.overflowY = '';
  menu.style.visibility = 'hidden';
  menu.style.top = '0';
  menu.style.left = '0';

  requestAnimationFrame(() => {
    const menuRect = menu.getBoundingClientRect();
    let left = anchorRect.right - menuRect.width;

    if (left < MARGIN) left = MARGIN;
    if (left + menuRect.width > window.innerWidth - MARGIN) {
      left = window.innerWidth - menuRect.width - MARGIN;
    }

    const spaceBelow = window.innerHeight - anchorRect.bottom - GAP - MARGIN;
    const spaceAbove = anchorRect.top - GAP - MARGIN;
    let top = anchorRect.bottom + GAP;

    if (menuRect.height <= spaceBelow) {
      // Места достаточно под кнопкой.
    } else if (menuRect.height <= spaceAbove) {
      top = anchorRect.top - menuRect.height - GAP;
    } else if (spaceBelow >= spaceAbove) {
      menu.style.maxHeight = `${Math.max(spaceBelow, 120)}px`;
      menu.style.overflowY = 'auto';
    } else {
      top = Math.max(MARGIN, anchorRect.top - GAP - spaceAbove);
      menu.style.maxHeight = `${Math.max(spaceAbove, 120)}px`;
      menu.style.overflowY = 'auto';
    }

    menu.style.top = `${top}px`;
    menu.style.left = `${left}px`;
    menu.style.visibility = '';
  });
}

function toggleBulkSelectionMenu(button) {
  const menu = document.getElementById('bulkSelectionMenu');
  if (!menu) return;

  if (bulkSelectionMenuOpen) {
    closeBulkSelectionMenu();
    return;
  }

  const ids = getSelectedModelIds();

  updateBulkSelectionMenuState(ids);
  menu.hidden = false;
  bulkSelectionMenuOpen = true;
  button.classList.add('is-open');
  button.setAttribute('aria-expanded', 'true');

  positionBulkSelectionMenu(menu, button.getBoundingClientRect());
}

function closeBulkSelectionMenu() {
  const menu = document.getElementById('bulkSelectionMenu');
  const button = document.getElementById('bulkSelectionMenuBtn');
  if (menu) {
    menu.hidden = true;
    menu.style.maxHeight = '';
    menu.style.overflowY = '';
    menu.style.top = '';
    menu.style.left = '';
    menu.style.visibility = '';
  }
  if (button) {
    button.classList.remove('is-open');
    button.setAttribute('aria-expanded', 'false');
  }
  bulkSelectionMenuOpen = false;
}

function updateBulkSelectionMenuState(ids) {
  const menu = document.getElementById('bulkSelectionMenu');
  if (!menu) return;

  const visibleIds = getVisibleCardIds();
  const filteredIds = getFilteredModelIds();
  const selectedSet = new Set(ids);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedSet.has(id));
  const hasSelection = ids.length > 0;

  const selectAll = menu.querySelector('[data-action="select-all"]');
  const selectAllFiltered = menu.querySelector('[data-action="select-all-filtered"]');
  const clearCompare = menu.querySelector('[data-action="clear-compare"]');
  const update = menu.querySelector('[data-action="update"]');
  const remove = menu.querySelector('[data-action="delete"]');

  if (selectAll) selectAll.disabled = visibleIds.length === 0 || allVisibleSelected;
  if (selectAllFiltered) selectAllFiltered.disabled = filteredIds.length === 0 || allFilteredSelected;
  if (clearCompare) clearCompare.disabled = !window.CompareBuffer || window.CompareBuffer.getIds().length === 0;
  if (update) update.disabled = !hasSelection;
  if (remove) remove.disabled = !hasSelection;

  const selected = catalogModels.filter((model) => ids.includes(model.id));
  const allFavorite = selected.length > 0 && selected.every((model) => model.is_favorite);
  const noneFavorite = !hasSelection || selected.every((model) => !model.is_favorite);
  const allHidden = selected.length > 0 && selected.every((model) => model.is_hidden);
  const noneHidden = !hasSelection || selected.every((model) => !model.is_hidden);

  const favoriteAdd = menu.querySelector('[data-action="favorite-add"]');
  const favoriteRemove = menu.querySelector('[data-action="favorite-remove"]');
  const hiddenSet = menu.querySelector('[data-action="hidden-set"]');
  const hiddenUnset = menu.querySelector('[data-action="hidden-unset"]');

  if (favoriteAdd) favoriteAdd.disabled = !hasSelection || allFavorite;
  if (favoriteRemove) favoriteRemove.disabled = noneFavorite;
  if (hiddenSet) hiddenSet.disabled = !hasSelection || allHidden;
  if (hiddenUnset) hiddenUnset.disabled = noneHidden;
}

async function handleBulkSelectionAction(action) {
  closeBulkSelectionMenu();

  if (action === 'select-all') {
    selectAllVisibleCards();
    return;
  }
  if (action === 'select-all-filtered') {
    selectAllFilteredModels();
    return;
  }
  if (action === 'clear-compare') {
    if (window.CompareBuffer) window.CompareBuffer.setIds([]);
    return;
  }

  const ids = getSelectedModelIds();
  if (!ids.length) {
    alert('Выберите хотя бы одну модель');
    return;
  }

  switch (action) {
    case 'favorite-add':
      await bulkPatchModels(ids, { is_favorite: true });
      break;
    case 'favorite-remove':
      await bulkPatchModels(ids, { is_favorite: false });
      break;
    case 'hidden-set':
      if (!confirm(`Скрыть ${ids.length} моделей из каталога?`)) return;
      await bulkPatchModels(ids, { is_hidden: true });
      break;
    case 'hidden-unset':
      await bulkPatchModels(ids, { is_hidden: false });
      break;
    case 'update':
      closeBulkSelectionMenu();
      if (typeof window.openBulkSyncModal === 'function') {
        window.openBulkSyncModal(ids);
      } else {
        await bulkSyncModels(ids, { fields: FALLBACK_SYNC_FIELDS });
      }
      break;
    case 'availability-catalog':
      closeBulkSelectionMenu();
      if (typeof window.openBulkAvailabilityModal === 'function') {
        window.openBulkAvailabilityModal(ids, 'catalog');
      } else {
        await bulkAvailabilityCheck(ids, 'catalog');
      }
      break;
    case 'availability-inference':
      closeBulkSelectionMenu();
      if (typeof window.openBulkAvailabilityModal === 'function') {
        window.openBulkAvailabilityModal(ids, 'inference');
      } else {
        await bulkAvailabilityCheck(ids, 'inference');
      }
      break;
    case 'evaluate-benchmark':
      closeBulkSelectionMenu();
      if (typeof window.openBulkEvaluationModal === 'function') {
        window.openBulkEvaluationModal(ids);
      } else {
        await bulkEvaluationCheck(ids);
      }
      break;
    case 'delete':
      await bulkDeleteModels(ids);
      break;
    default:
      break;
  }
}

async function patchModelFields(id, fields) {
  const response = await fetch(`/api/models/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
  if (!response.ok) throw new Error('update failed');
  const payload = await response.json();
  return payload.data;
}

function syncModelInCatalog(updated) {
  const merged = updated?.chat_rating_avg != null
    ? { ...updated, ...formatChatRatingFields(updated.chat_rating_avg, updated.chat_rating_count) }
    : updated;
  const catalogIndex = catalogModels.findIndex((item) => item.id === merged.id);
  if (catalogIndex >= 0) {
    catalogModels[catalogIndex] = enrichModel({ ...catalogModels[catalogIndex], ...merged });
  }

  const sourceIndex = window.MODELS_DATA.findIndex((item) => item.id === merged.id);
  if (sourceIndex >= 0) {
    window.MODELS_DATA[sourceIndex] = { ...window.MODELS_DATA[sourceIndex], ...merged };
  }
}

window.syncModelInCatalog = syncModelInCatalog;

async function bulkPatchModels(ids, fields) {
  let failed = 0;
  for (const id of ids) {
    try {
      const updated = await patchModelFields(id, fields);
      syncModelInCatalog(updated);
    } catch {
      failed += 1;
    }
  }

  renderFavoriteFilter();
  renderHiddenFilter();
  applyFilters();

  if (failed > 0) {
    alert(`Не удалось обновить ${failed} из ${ids.length} моделей`);
  }
}

async function bulkDeleteModels(ids) {
  if (!confirm(`Удалить ${ids.length} моделей из каталога?`)) return;

  let failed = 0;
  for (const id of ids) {
    try {
      const response = await fetch(`/api/models/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('delete failed');
      catalogModels = catalogModels.filter((item) => item.id !== id);
      window.MODELS_DATA = window.MODELS_DATA.filter((item) => item.id !== id);
    } catch {
      failed += 1;
    }
  }

  if (window.CompareBuffer) {
    const deleted = new Set(ids);
    window.CompareBuffer.setIds(window.CompareBuffer.getIds().filter((id) => !deleted.has(id)));
  }

  renderFavoriteFilter();
  renderHiddenFilter();
  renderAvailabilityFilters();
  renderPriceFilters();
  renderFamilyFilters();
  renderModalityFilters();
  renderCapabilityFilters();
  renderYearFilters();
  renderCatFilters();
  applyFilters();

  if (failed > 0) {
    alert(`Не удалось удалить ${failed} из ${ids.length} моделей`);
  }
}

async function bulkSyncModels(ids, options = {}) {
  const fields = options.fields?.length ? options.fields : FALLBACK_SYNC_FIELDS;
  const onlyEmpty = options.onlyEmpty ?? false;
  const onProgress = options.onProgress;

  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    onProgress?.({
      id,
      current: index + 1,
      total: ids.length,
      updated,
      skipped,
      failed,
    });

    try {
      const response = await fetch(`/api/models/${id}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields, onlyEmpty }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        failed += 1;
        onProgress?.({
          id,
          current: index + 1,
          total: ids.length,
          updated,
          skipped,
          failed,
          status: 'error',
        });
        continue;
      }

      let status = payload?.data?.status;
      if (status === 'updated') {
        updated += 1;
        const modelResponse = await fetch(`/api/models/${id}`);
        if (modelResponse.ok) {
          const modelPayload = await modelResponse.json();
          syncModelInCatalog(modelPayload.data);
        }
      } else if (status === 'error') {
        failed += 1;
        status = 'error';
      } else {
        skipped += 1;
        status = status || 'skipped';
      }

      onProgress?.({
        id,
        current: index + 1,
        total: ids.length,
        updated,
        skipped,
        failed,
        status,
      });
    } catch {
      failed += 1;
      onProgress?.({
        id,
        current: index + 1,
        total: ids.length,
        updated,
        skipped,
        failed,
        status: 'error',
      });
    }
  }

  renderFavoriteFilter();
  renderHiddenFilter();
  renderAvailabilityFilters();
  renderPriceFilters();
  renderFamilyFilters();
  renderModalityFilters();
  renderCapabilityFilters();
  renderYearFilters();
  renderCatFilters();
  applyFilters();

  const result = { updated, skipped, failed };
  onProgress?.({ done: true, ...result });

  if (!onProgress) {
    alert(`Обновление завершено. Обновлено: ${updated}, без изменений: ${skipped}, ошибок: ${failed}`);
  }

  return result;
}

async function bulkAvailabilityCheck(ids, mode, options = {}) {
  const onProgress = options.onProgress;
  let available = 0;
  let inference = 0;
  let unavailable = 0;
  let failed = 0;

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    onProgress?.({
      id,
      current: index + 1,
      total: ids.length,
      available,
      inference,
      unavailable,
      failed,
    });

    try {
      const response = await fetch(`/api/models/${id}/availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        failed += 1;
        onProgress?.({
          id,
          current: index + 1,
          total: ids.length,
          available,
          inference,
          unavailable,
          failed,
          status: 'error',
        });
        continue;
      }

      const status = payload?.data?.status;
      if (payload?.model) {
        syncModelInCatalog(payload.model);
      }

      if (status === 'available') available += 1;
      else if (status === 'inference') inference += 1;
      else if (status === 'unavailable') unavailable += 1;
      else failed += 1;

      onProgress?.({
        id,
        current: index + 1,
        total: ids.length,
        available,
        inference,
        unavailable,
        failed,
        status,
      });
    } catch {
      failed += 1;
      onProgress?.({
        id,
        current: index + 1,
        total: ids.length,
        available,
        inference,
        unavailable,
        failed,
        status: 'error',
      });
    }
  }

  renderAvailabilityFilters();
  renderFavoriteFilter();
  renderHiddenFilter();
  renderPriceFilters();
  renderFamilyFilters();
  renderModalityFilters();
  renderCapabilityFilters();
  renderYearFilters();
  renderCatFilters();
  applyFilters();

  const result = { available, inference, unavailable, failed };
  onProgress?.({ done: true, ...result });

  if (!onProgress) {
    alert(`Проверка завершена. Доступна: ${available}, инференс: ${inference}, недоступна: ${unavailable}, ошибок: ${failed}`);
  }

  return result;
}

window.runBulkAvailability = bulkAvailabilityCheck;

async function bulkEvaluationCheck(ids, options = {}) {
  const onProgress = options.onProgress;
  let success = 0;
  let parseErrors = 0;
  let failed = 0;

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    onProgress?.({
      id,
      current: index + 1,
      total: ids.length,
      success,
      parseErrors,
      failed,
    });

    try {
      const response = await fetch(`/api/models/${id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        failed += 1;
        onProgress?.({
          id,
          current: index + 1,
          total: ids.length,
          success,
          parseErrors,
          failed,
          status: 'error',
        });
        continue;
      }

      const status = payload?.data?.status;
      if (payload?.model) {
        syncModelInCatalog(payload.model);
      }

      if (status === 'success') success += 1;
      else if (status === 'parse_error') parseErrors += 1;
      else failed += 1;

      onProgress?.({
        id,
        current: index + 1,
        total: ids.length,
        success,
        parseErrors,
        failed,
        status,
      });
    } catch {
      failed += 1;
      onProgress?.({
        id,
        current: index + 1,
        total: ids.length,
        success,
        parseErrors,
        failed,
        status: 'error',
      });
    }
  }

  renderAvailabilityFilters();
  applyFilters();

  const result = { success, parseErrors, failed };
  onProgress?.({ done: true, ...result });

  if (!onProgress) {
    alert(`Автооценка завершена. Успешно: ${success}, ошибки парсинга: ${parseErrors}, ошибок: ${failed}`);
  }

  return result;
}

window.runBulkEvaluation = bulkEvaluationCheck;

window.runBulkSync = bulkSyncModels;
window.applyCatalogFilters = applyFilters;

document.addEventListener('DOMContentLoaded', initCatalog);
