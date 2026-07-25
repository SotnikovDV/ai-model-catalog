function adminFetch(url, options) {
  const fetchFn = window.authFetch || fetch;
  return fetchFn(url, options);
}

const COPY_NAME_BTN_ICON = '<svg class="rec-copy-name-icon" viewBox="0 0 24 24" width="12" height="12" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';

function escapeCopyNameAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

async function copyTextToClipboard(text) {
  const value = String(text ?? '');
  if (!value) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  }
}

function flashCopyNameButton(button, originalTitle = 'Копировать название') {
  button.title = 'Скопировано';
  button.setAttribute('aria-label', 'Скопировано');
  button.classList.add('rec-copy-name-btn--done');
  window.setTimeout(() => {
    button.title = originalTitle;
    button.setAttribute('aria-label', originalTitle);
    button.classList.remove('rec-copy-name-btn--done');
  }, 1500);
}

function bindCopyNameButton(button) {
  if (!button || button.dataset.copyBound === '1') return;
  button.dataset.copyBound = '1';
  const originalTitle = button.title || 'Копировать название';

  button.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const text = button.dataset.copyText || '';
    const copied = await copyTextToClipboard(text);
    if (!copied) return;
    flashCopyNameButton(button, originalTitle);
  });
}

function bindCopyNameButtons(root = document) {
  root.querySelectorAll('.rec-copy-name-btn').forEach((button) => bindCopyNameButton(button));
}

function buildCopyNameButtonHtml(copyText) {
  return `<button type="button" class="rec-copy-name-btn" data-copy-text="${escapeCopyNameAttr(copyText)}" title="Копировать название" aria-label="Копировать название">${COPY_NAME_BTN_ICON}</button>`;
}

window.CopyModelName = {
  ICON: COPY_NAME_BTN_ICON,
  copy: copyTextToClipboard,
  bind: bindCopyNameButton,
  bindAll: bindCopyNameButtons,
  buttonHtml: buildCopyNameButtonHtml,
};

document.addEventListener('DOMContentLoaded', () => {
  initCompareBufferNav();
  initThemeToggle();
  initMobileMenu();
  initMobileFilters();
  initAdminSidebar();
  initAdminActions();
  initSyncConfigForm();
  initAiConfigForm();
  initModelForm();
  initFieldHints();
  initAdminSync();
  initDetailSync();
  initDetailAvailability();
  initBulkSyncModal();
  initBulkAvailabilityModal();
  initBulkEvaluationModal();
  initAdminAvailability();
  initAdminEvaluation();
  initDetailEvaluation();
  initDetailDescriptionMarkdown();
  initComparePageBuffer();
  initCompareDiffToggle();
  bindCopyNameButtons();
});

function updateCompareNavLinks() {
  if (!window.CompareBuffer) return;
  const href = window.CompareBuffer.getUrl();
  const count = window.CompareBuffer.getIds().length;
  document.querySelectorAll('[data-nav-compare]').forEach((link) => {
    link.href = href;
    link.title = count > 0 ? `Сравнение (${count})` : 'Сравнение';
  });
}

function initCompareBufferNav() {
  if (!window.CompareBuffer) return;
  updateCompareNavLinks();
  window.CompareBuffer.onChange(updateCompareNavLinks);
}

function initComparePageBuffer() {
  if (!window.CompareBuffer) return;
  if (!document.querySelector('.compare-table')) return;

  const urlIds = new URLSearchParams(window.location.search).get('ids');
  if (urlIds) {
    window.CompareBuffer.syncFromUrl();
  } else {
    const bufferIds = window.CompareBuffer.getIds();
    if (bufferIds.length) {
      window.location.replace(window.CompareBuffer.getUrl());
      return;
    }
  }

  document.querySelectorAll('.compare-remove-btn').forEach((button) => {
    button.addEventListener('click', () => {
      window.CompareBuffer.remove(button.dataset.id);
      const remaining = window.CompareBuffer.getIds();
      window.location.href = remaining.length ? window.CompareBuffer.getUrl() : '/compare';
    });
  });

  document.getElementById('compareClearBtn')?.addEventListener('click', () => {
    window.CompareBuffer.setIds([]);
    clearCompareDiffOnlyState();
    window.location.href = '/compare';
  });

  initCompareFavoriteButtons();
}

function initCompareFavoriteButtons() {
  document.querySelectorAll('.compare-favorite-btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      if (!window.AdminAccess?.guardAction(event, '/admin')) return;

      const id = button.dataset.id;
      if (!id || button.disabled) return;

      const nextState = !button.classList.contains('active');
      button.disabled = true;
      try {
        const response = await fetch(`/api/models/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_favorite: nextState }),
        });
        if (!response.ok) throw new Error('update failed');

        button.classList.toggle('active', nextState);
        button.setAttribute('aria-pressed', nextState ? 'true' : 'false');
        const title = nextState ? 'Убрать из избранного' : 'Добавить в избранное';
        button.title = title;
        button.setAttribute('aria-label', title);
      } catch {
        alert('Не удалось обновить признак «Избранное»');
      } finally {
        button.disabled = false;
      }
    });
  });
}

function initThemeToggle() {
  const toggles = document.querySelectorAll('[data-theme-toggle]');
  if (!toggles.length) return;

  const applyTheme = (isLight) => {
    document.documentElement.classList.toggle('light', isLight);
    document.querySelectorAll('.theme-icon, .mobile-menu-theme-icon').forEach((icon) => {
      icon.textContent = isLight ? '☀️' : '🌙';
    });
    const mobileLabel = document.getElementById('mobileThemeLabel');
    if (mobileLabel) mobileLabel.textContent = isLight ? 'Светлая тема' : 'Тёмная тема';
  };

  try {
    applyTheme(localStorage.getItem('catalog_theme') !== 'dark');
  } catch {
    applyTheme(true);
  }

  toggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const isLight = !document.documentElement.classList.contains('light');
      document.documentElement.classList.toggle('light', isLight);
      try {
        localStorage.setItem('catalog_theme', isLight ? 'light' : 'dark');
      } catch {
        // ignore storage errors
      }
      applyTheme(isLight);
    });
  });
}

function initMobileMenu() {
  const menuBtn = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');
  const overlay = document.getElementById('mobileMenuOverlay');
  if (!menuBtn || !menu || !overlay) return;

  const setMenuOpen = (isOpen) => {
    menu.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('visible', isOpen);
    menuBtn.classList.toggle('is-open', isOpen);
    menuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    menu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    if (!isOpen && !document.getElementById('filterSidebar')?.classList.contains('is-open')) {
      document.body.style.overflow = '';
    }
    if (isOpen) document.body.style.overflow = 'hidden';
  };

  menuBtn.addEventListener('click', () => {
    setMenuOpen(!menu.classList.contains('is-open'));
  });

  overlay.addEventListener('click', () => setMenuOpen(false));

  menu.querySelectorAll('a.mobile-menu-item').forEach((link) => {
    link.addEventListener('click', () => setMenuOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && menu.classList.contains('is-open')) {
      setMenuOpen(false);
    }
  });

  window.closeMobileMenu = () => setMenuOpen(false);
}

function initMobileFilters() {
  const filterSidebar = document.getElementById('filterSidebar');
  const filterOverlay = document.getElementById('sidebarOverlay');
  const filterOpenBtn = document.getElementById('filterOpenBtn');
  const mobileFilterBtn = document.getElementById('mobileFilterBtn');
  const filterCloseBtn = document.getElementById('filterCloseBtn');

  if (!filterSidebar || !filterOverlay) return;

  const setOpen = (isOpen) => {
    filterSidebar.classList.toggle('is-open', isOpen);
    filterOverlay.classList.toggle('visible', isOpen);
    if (!isOpen && !document.getElementById('mobileMenu')?.classList.contains('is-open')) {
      document.body.style.overflow = '';
    }
    if (isOpen) document.body.style.overflow = 'hidden';
  };

  const openFilters = () => {
    if (typeof window.closeMobileMenu === 'function') {
      window.closeMobileMenu();
    }
    setOpen(true);
  };

  filterOpenBtn?.addEventListener('click', openFilters);
  mobileFilterBtn?.addEventListener('click', openFilters);
  filterCloseBtn?.addEventListener('click', () => setOpen(false));
  filterOverlay.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && filterSidebar.classList.contains('is-open')) {
      setOpen(false);
    }
  });
}

function initAdminSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('adminSidebarOverlay');
  const openBtn = document.getElementById('adminSidebarOpenBtn');
  const closeBtn = document.getElementById('adminSidebarCloseBtn');

  if (!sidebar || !overlay) return;

  const setOpen = (isOpen) => {
    sidebar.classList.toggle('is-open', isOpen);
    overlay.classList.toggle('visible', isOpen);
    if (!isOpen && !document.getElementById('mobileMenu')?.classList.contains('is-open')) {
      document.body.style.overflow = '';
    }
    if (isOpen) document.body.style.overflow = 'hidden';
  };

  const openSidebar = () => {
    if (typeof window.closeMobileMenu === 'function') {
      window.closeMobileMenu();
    }
    setOpen(true);
  };

  openBtn?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', () => setOpen(false));
  overlay.addEventListener('click', () => setOpen(false));

  sidebar.querySelectorAll('a.admin-nav-item').forEach((link) => {
    link.addEventListener('click', () => setOpen(false));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {
      setOpen(false);
    }
  });
}

function initModelForm() {
  const form = document.getElementById('modelForm');
  if (!form) return;

  initFormTabs(form);

  const checkboxFields = [
    'is_favorite',
    'is_hidden',
    'supports_vision',
    'supports_function_calling',
    'supports_json_mode',
    'supports_streaming',
    'supports_web_search',
  ];
  const jsonFields = ['use_cases', 'pros', 'cons', 'benchmarks', 'tags'];
  const ratingFields = [
    'reasoning',
    'task_quality',
    'latency',
    'generation_speed',
    'hallucinations',
    'instruction_following',
    'code_quality',
    'multilingual_quality',
    'robustness',
    'rag_compatibility',
  ];

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());

      for (const field of checkboxFields) {
        payload[field] = formData.get(field) === '1';
      }

      for (const field of ratingFields) {
        if (payload[field] !== undefined && payload[field] !== '') {
          payload[field] = Number(payload[field]);
        }
      }

      for (const field of ['context_window', 'max_output_tokens', 'input_price_per_mtok', 'output_price_per_mtok']) {
        if (payload[field] === '' || payload[field] === undefined) {
          payload[field] = 0;
        } else {
          payload[field] = Number(payload[field]);
        }
      }

      for (const field of jsonFields) {
        const raw = String(payload[field] ?? '').trim();
        if (!raw) {
          payload[field] = field === 'benchmarks' ? {} : [];
          continue;
        }
        try {
          payload[field] = JSON.parse(raw);
        } catch {
          alert(`Некорректный JSON в поле «${field}»`);
          return;
        }
      }

      if (!payload.release_date) {
        payload.release_date = null;
      }

      const id = String(payload.id ?? '').trim();
      delete payload.id;

      const isEdit = Boolean(id);
      const url = isEdit ? `/api/models/${id}` : '/api/models';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        const message = result?.error
          || (Array.isArray(result?.issues) ? result.issues.map((i) => i.message).join('\n') : null)
          || 'Не удалось сохранить модель';
        alert(message);
        return;
      }

      const modelId = result?.data?.id || id;
      window.location.href = modelId ? `/models/${modelId}` : '/';
    } catch {
      alert('Не удалось сохранить модель');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function initFormTabs(form) {
  const tabsRoot = form.querySelector('#modelFormTabs');
  if (!tabsRoot) return;

  const buttons = [...tabsRoot.querySelectorAll('.form-tab-btn')];
  const panels = [...tabsRoot.querySelectorAll('.form-tab-panel')];

  const activateTab = (tabId) => {
    buttons.forEach((button) => {
      const isActive = button.dataset.tab === tabId;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    panels.forEach((panel) => {
      const isActive = panel.dataset.tabPanel === tabId;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });
  };

  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      activateTab(button.dataset.tab);
    });
  });
}

function initSyncConfigForm() {
  const form = document.getElementById('syncConfigForm');
  if (!form) return;

  const statusEl = document.getElementById('syncConfigStatus');
  const rateEl = document.getElementById('usdToRubRate');

  const setStatus = (message, type = 'success') => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
  };

  const loadConfig = async () => {
    const response = await fetch('/api/models/sync/config');
    if (!response.ok) {
      setStatus('Не удалось загрузить настройки синхронизации', 'error');
      return;
    }
    const payload = await response.json();
    if (rateEl && payload.data?.usdToRubRate != null) {
      rateEl.value = String(payload.data.usdToRubRate);
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const usdToRubRate = Number(rateEl?.value);
      const response = await adminFetch('/api/models/sync/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdToRubRate }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error
          || (Array.isArray(result?.issues) ? result.issues.map((i) => i.message).join('\n') : null)
          || 'Не удалось сохранить курс';
        setStatus(message, 'error');
        return;
      }
      setStatus('Курс сохранён', 'success');
    } catch {
      setStatus('Не удалось сохранить курс', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  loadConfig();
}

function initAiConfigForm() {
  const form = document.getElementById('aiConfigForm');
  if (!form) return;

  const statusEl = document.getElementById('aiStatus');
  const apiKeyHintEl = document.getElementById('aiApiKeyHint');
  const enabledEl = document.getElementById('aiEnabled');
  const baseUrlEl = document.getElementById('aiBaseUrl');
  const modelSimpleEl = document.getElementById('aiModelSimple');
  const modelAnalyticsEl = document.getElementById('aiModelAnalytics');
  const apiKeyEl = document.getElementById('aiApiKey');
  const testSimpleBtn = document.getElementById('aiTestSimpleBtn');
  const testAnalyticsBtn = document.getElementById('aiTestAnalyticsBtn');

  const setStatus = (message, type = 'success') => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
  };

  const loadConfig = async () => {
    const response = await fetch('/api/ai/config');
    if (!response.ok) {
      setStatus('Не удалось загрузить настройки AI', 'error');
      return;
    }

    const payload = await response.json();
    const config = payload.data;
    if (!config) return;

    if (enabledEl) enabledEl.checked = Boolean(config.enabled);
    if (baseUrlEl) baseUrlEl.value = config.baseUrl || '';
    if (modelSimpleEl) modelSimpleEl.value = config.modelSimple || '';
    if (modelAnalyticsEl) modelAnalyticsEl.value = config.modelAnalytics || '';
    if (apiKeyHintEl) {
      apiKeyHintEl.textContent = config.apiKeySet
        ? `Ключ задан: ${config.apiKeyHint}`
        : 'Ключ не задан — укажите новый или задайте AI_API_KEY в .env';
    }
  };

  const saveConfig = async (event) => {
    event.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const payload = {
        enabled: enabledEl?.checked ?? false,
        baseUrl: baseUrlEl?.value?.trim(),
        modelSimple: modelSimpleEl?.value?.trim(),
        modelAnalytics: modelAnalyticsEl?.value?.trim(),
      };

      const apiKey = apiKeyEl?.value?.trim();
      if (apiKey) {
        payload.apiKey = apiKey;
      }

      const response = await adminFetch('/api/ai/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error
          || (Array.isArray(result?.issues) ? result.issues.map((i) => i.message).join('\n') : null)
          || 'Не удалось сохранить настройки';
        setStatus(message, 'error');
        return;
      }

      if (apiKeyEl) apiKeyEl.value = '';
      if (apiKeyHintEl && result?.data) {
        apiKeyHintEl.textContent = result.data.apiKeySet
          ? `Ключ задан: ${result.data.apiKeyHint}`
          : 'Ключ не задан — укажите новый или задайте AI_API_KEY в .env';
      }
      setStatus('Настройки AI сохранены', 'success');
    } catch {
      setStatus('Не удалось сохранить настройки', 'error');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  const testConnection = async (tier) => {
    const button = tier === 'analytics' ? testAnalyticsBtn : testSimpleBtn;
    if (button) button.disabled = true;

    try {
      const response = await adminFetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const result = await response.json().catch(() => null);

      if (!response.ok) {
        setStatus(result?.error || 'Тест подключения не удался', 'error');
        return;
      }

      const data = result?.data;
      setStatus(`Подключение успешно (${data?.model}): ${data?.reply}`, 'success');
    } catch {
      setStatus('Тест подключения не удался', 'error');
    } finally {
      if (button) button.disabled = false;
    }
  };

  form.addEventListener('submit', saveConfig);
  testSimpleBtn?.addEventListener('click', () => testConnection('simple'));
  testAnalyticsBtn?.addEventListener('click', () => testConnection('analytics'));
  loadConfig();
}

function initAdminActions() {
  const exportBtn = document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      const response = await fetch('/api/models/export');
      if (!response.ok) {
        alert('Не удалось экспортировать данные');
        return;
      }

      const payload = await response.json();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'models.json';
      link.click();
      URL.revokeObjectURL(url);
    });
  }

  const importBtn = document.getElementById('importBtn');
  const importFile = document.getElementById('importFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => {
      importFile.click();
    });

    importFile.addEventListener('change', async () => {
      const file = importFile.files?.[0];
      importFile.value = '';
      if (!file) return;

      let payload;
      try {
        const text = await file.text();
        payload = JSON.parse(text);
      } catch {
        alert('Не удалось прочитать JSON-файл');
        return;
      }

      const data = Array.isArray(payload) ? payload : payload?.data;
      if (!Array.isArray(data)) {
        alert('Ожидается JSON с массивом моделей в поле data или массив в корне файла');
        return;
      }

      if (!confirm(`Импортировать ${data.length} моделей из файла «${file.name}»?`)) {
        return;
      }

      const response = await adminFetch('/api/models/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => null);
        if (response.status === 413) {
          alert('Файл слишком большой для загрузки. Перезапустите сервер после обновления приложения.');
          return;
        }
        alert(error?.error || 'Не удалось импортировать данные');
        return;
      }

      const result = await response.json();
      alert(`Импорт завершён. Обработано моделей: ${result.meta?.imported ?? result.data.length}`);
      window.location.reload();
    });
  }

  const clearDbBtn = document.getElementById('clearDbBtn');
  if (clearDbBtn) {
    clearDbBtn.addEventListener('click', async () => {
      if (!confirm('Удалить все модели из базы данных? Это действие нельзя отменить.')) {
        return;
      }

      const response = await adminFetch('/api/models', { method: 'DELETE' });
      if (!response.ok) {
        alert('Не удалось очистить базу данных');
        return;
      }

      const payload = await response.json();
      alert(`База данных очищена. Удалено моделей: ${payload.data.deleted}`);
      window.location.reload();
    });
  }
}

const DEFAULT_SYNC_FIELDS = [
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

const DEFAULT_BULK_SYNC_GROUP_IDS = ['specs', 'pricing', 'capabilities', 'description'];
const ALL_SYNC_GROUP_IDS = [
  'specs',
  'pricing',
  'capabilities',
  'description',
  'ai_ratings',
  'ai_editorial',
  'benchmarks',
];

let syncFieldMetaCache = null;
const AI_SYNC_GROUP_IDS = new Set(['ai_ratings', 'ai_editorial', 'benchmarks']);

async function loadSyncFieldMeta() {
  if (syncFieldMetaCache) return syncFieldMetaCache;
  const response = await fetch('/api/models/sync/fields');
  if (!response.ok) throw new Error('Не удалось загрузить список полей');
  const payload = await response.json();
  syncFieldMetaCache = payload.data;
  return syncFieldMetaCache;
}

function renderFieldHintButton(label, description) {
  if (!description) return '';
  return `
    <span class="field-hint-wrap">
      <span class="field-label-row">
        <span class="field-label-text">${escapeHtml(label)}</span>
        <button type="button" class="field-hint-btn" aria-label="Подсказка: ${escapeHtml(label)}" aria-expanded="false" data-hint="${escapeHtml(description)}">i</button>
      </span>
      <span class="field-hint-popover" role="tooltip" hidden>${escapeHtml(description)}</span>
    </span>
  `;
}

function initFieldHints(root = document) {
  const wraps = root.querySelectorAll('.field-hint-wrap');
  wraps.forEach((wrap) => {
    if (wrap.dataset.hintsBound === '1') return;
    wrap.dataset.hintsBound = '1';

    const btn = wrap.querySelector('.field-hint-btn');
    const popover = wrap.querySelector('.field-hint-popover');
    if (!btn || !popover) return;

    const close = () => {
      popover.hidden = true;
      btn.classList.remove('is-open');
      btn.setAttribute('aria-expanded', 'false');
    };

    const toggle = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const willOpen = popover.hidden;
      root.querySelectorAll('.field-hint-popover').forEach((el) => { el.hidden = true; });
      root.querySelectorAll('.field-hint-btn.is-open').forEach((el) => {
        el.classList.remove('is-open');
        el.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        popover.hidden = false;
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    };

    btn.addEventListener('click', toggle);
    btn.addEventListener('blur', () => {
      setTimeout(() => {
        if (!wrap.contains(document.activeElement)) close();
      }, 120);
    });
  });

  if (!document.documentElement.dataset.fieldHintsGlobalBound) {
    document.addEventListener('click', (event) => {
      if (event.target.closest('.field-hint-wrap')) return;
      document.querySelectorAll('.field-hint-popover').forEach((el) => { el.hidden = true; });
      document.querySelectorAll('.field-hint-btn.is-open').forEach((el) => {
        el.classList.remove('is-open');
        el.setAttribute('aria-expanded', 'false');
      });
    });
    document.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      document.querySelectorAll('.field-hint-popover').forEach((el) => { el.hidden = true; });
      document.querySelectorAll('.field-hint-btn.is-open').forEach((el) => {
        el.classList.remove('is-open');
        el.setAttribute('aria-expanded', 'false');
      });
    });
    document.documentElement.dataset.fieldHintsGlobalBound = '1';
  }
}

function renderSyncFieldGroups(container, groups, selectedFields, fieldMeta = {}) {
  if (!container) return;
  const selected = new Set(selectedFields);
  const aiGroups = syncFieldMetaCache?.aiGroupIds
    ? new Set(syncFieldMetaCache.aiGroupIds)
    : AI_SYNC_GROUP_IDS;

  container.innerHTML = groups.map((group) => {
    const isAiGroup = aiGroups.has(group.id);
    return `
    <div class="sync-field-group${isAiGroup ? ' sync-field-group--ai' : ''}">
      <div class="sync-field-group-title">${escapeHtml(group.label)}</div>
      <div class="sync-field-list">
        ${group.fields.map((field) => {
          const meta = fieldMeta[field] || {};
          const label = meta.label || field;
          const description = meta.description || '';
          const requiresAi = Boolean(meta.requiresAi);
          return `
          <label class="sync-field-item${requiresAi ? ' sync-field-item--ai' : ''}">
            <input type="checkbox" name="syncField" value="${escapeHtml(field)}" ${selected.has(field) ? 'checked' : ''}>
            ${renderFieldHintButton(label, description)}
          </label>`;
        }).join('')}
      </div>
    </div>
  `;
  }).join('');

  initFieldHints(container);
}

function setSyncStatus(statusEl, message, type = 'success', logId) {
  if (!statusEl) return;
  statusEl.hidden = false;
  statusEl.className = `form-status ${type}`;
  if (logId) {
    statusEl.innerHTML = `${escapeHtml(message)} <a href="/admin/sync/logs/${escapeHtml(logId)}">Открыть журнал</a>`;
    return;
  }
  statusEl.textContent = message;
}

function collectSyncFields(root) {
  return [...root.querySelectorAll('input[name="syncField"]:checked')].map((el) => el.value);
}

function collectSyncFieldsFromGroups(root, groups) {
  const checked = new Set([...root.querySelectorAll('input[name="syncGroup"]:checked')].map((el) => el.value));
  return groups.flatMap((group) => (checked.has(group.id) ? group.fields : []));
}

function setSyncGroupChecks(root, groupIds) {
  const selected = new Set(groupIds);
  root?.querySelectorAll('input[name="syncGroup"]').forEach((el) => {
    el.checked = selected.has(el.value);
  });
}

function renderSyncGroupToggles(container, groups, selectedGroupIds) {
  if (!container) return;
  const selected = new Set(selectedGroupIds);

  container.innerHTML = groups.map((group) => {
    const isAiGroup = AI_SYNC_GROUP_IDS.has(group.id);
    return `
      <label class="sync-group-toggle${isAiGroup ? ' sync-group-toggle--ai' : ''}">
        <input type="checkbox" name="syncGroup" value="${escapeHtml(group.id)}" ${selected.has(group.id) ? 'checked' : ''}>
        <span class="sync-group-toggle-label">${escapeHtml(group.label)}</span>
        ${isAiGroup ? '<span class="sync-ai-badge">AI</span>' : ''}
      </label>
    `;
  }).join('');
}

function setSyncFieldChecks(root, checked) {
  root?.querySelectorAll('input[name="syncField"]').forEach((el) => {
    el.checked = checked;
  });
}

function initSyncFieldBulkActions(root, selectAllBtn, deselectAllBtn) {
  selectAllBtn?.addEventListener('click', () => setSyncFieldChecks(root, true));
  deselectAllBtn?.addEventListener('click', () => setSyncFieldChecks(root, false));
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatSyncValue(value) {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'да' : 'нет';
  if (Array.isArray(value)) return value.join(', ') || '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function renderSyncDiff(container, results) {
  if (!container) return;
  if (!results?.length) {
    container.innerHTML = '<p class="detail-empty">Изменений нет.</p>';
    return;
  }

  container.innerHTML = results.map((item) => {
    const diffRows = (item.diff ?? []).map((row) => `
      <div class="sync-diff-row">
        <div class="sync-diff-field">${escapeHtml(row.field)}</div>
        <div class="sync-diff-before">${escapeHtml(formatSyncValue(row.before))}</div>
        <div class="sync-diff-after">${escapeHtml(formatSyncValue(row.after))}</div>
      </div>
    `).join('');

    return `
      <div class="sync-report-item">
        <h3>${escapeHtml(item.name)}</h3>
        <div class="sync-report-status">${escapeHtml(item.status)}${item.message ? ` — ${escapeHtml(item.message)}` : ''}</div>
        ${diffRows || '<div class="sync-report-status">Без изменений полей</div>'}
      </div>
    `;
  }).join('');
}

const SYNC_PHASE_LABELS = {
  update: 'Обновление существующих моделей',
  import: 'Импорт новых моделей',
};

function createSyncProgressUI(root) {
  if (!root) {
    return {
      show() {},
      hide() {},
      setIndeterminate() {},
      update() {},
    };
  }

  const ui = {
    show(title) {
      root.hidden = false;
      root.innerHTML = `
        <div class="sync-progress-header">
          <span class="sync-progress-spinner" aria-hidden="true"></span>
          <span class="sync-progress-title">${escapeHtml(title)}</span>
        </div>
        <div class="sync-progress-bar-wrap">
          <div class="sync-progress-bar"></div>
        </div>
        <div class="sync-progress-meta">
          <span class="sync-progress-count">0 / 0</span>
          <span class="sync-progress-stats">обновлено 0 · добавлено 0 · пропущено 0 · ошибок 0</span>
        </div>
        <div class="sync-progress-current">Подготовка…</div>
      `;
    },
    hide() {
      root.hidden = true;
      root.innerHTML = '';
    },
    setIndeterminate(title, subtitle = 'Загрузка данных из источников…') {
      root.hidden = false;
      root.innerHTML = `
        <div class="sync-progress-header">
          <span class="sync-progress-spinner" aria-hidden="true"></span>
          <span class="sync-progress-title">${escapeHtml(title)}</span>
        </div>
        <div class="sync-progress-bar-wrap">
          <div class="sync-progress-bar is-indeterminate"></div>
        </div>
        <div class="sync-progress-meta">
          <span class="sync-progress-count">Выполняется</span>
        </div>
        <div class="sync-progress-current">${escapeHtml(subtitle)}</div>
      `;
    },
    update(event) {
      if (root.hidden) return;
      const titleEl = root.querySelector('.sync-progress-title');
      const barEl = root.querySelector('.sync-progress-bar');
      const countEl = root.querySelector('.sync-progress-count');
      const statsEl = root.querySelector('.sync-progress-stats');
      const currentEl = root.querySelector('.sync-progress-current');
      if (!titleEl || !barEl || !countEl || !statsEl || !currentEl) return;

      const phaseLabel = SYNC_PHASE_LABELS[event.phase] || 'Обновление каталога';
      titleEl.textContent = phaseLabel;

      const total = Number(event.total) || 0;
      const current = Number(event.current) || 0;
      const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

      barEl.classList.remove('is-indeterminate');
      barEl.style.width = `${percent}%`;
      countEl.textContent = total > 0 ? `${current} / ${total}` : 'Подготовка…';

      const summary = event.summary || {};
      statsEl.textContent = `обновлено ${summary.updated ?? 0} · добавлено ${summary.created ?? 0} · пропущено ${summary.skipped ?? 0} · ошибок ${summary.errors ?? 0}`;

      if (event.modelName) {
        const statusSuffix = event.status ? ` (${event.status})` : '';
        currentEl.textContent = `${event.modelName}${statusSuffix}`;
      } else if (event.type === 'start') {
        currentEl.textContent = total > 0 ? `Всего моделей: ${total}` : 'Подготовка…';
      }
    },
  };

  return ui;
}

function parseSseChunk(chunk) {
  let eventName = 'message';
  let data = '';
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  if (!data) return null;
  return { event: eventName, data: JSON.parse(data) };
}

async function consumeSsePost(url, payload, handlers) {
  const response = await adminFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok && (!response.body || !response.headers.get('content-type')?.includes('text/event-stream'))) {
    const errorPayload = await response.json().catch(() => null);
    handlers.onError?.(errorPayload);
    return null;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError?.({ error: 'Поток ответа недоступен' });
    return null;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const part = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const parsed = parseSseChunk(part);
      if (parsed) {
        if (parsed.event === 'progress') handlers.onProgress?.(parsed.data);
        if (parsed.event === 'done') donePayload = parsed.data;
        if (parsed.event === 'error') {
          handlers.onError?.(parsed.data);
          return null;
        }
      }
      boundary = buffer.indexOf('\n\n');
    }
  }

  return donePayload;
}

function initAdminSync() {
  const form = document.getElementById('adminSyncForm');
  if (!form) return;

  const fieldGroupsEl = document.getElementById('syncFieldGroups');
  const filterEl = document.getElementById('syncFilter');
  const providerField = document.getElementById('syncProviderField');
  const previewBtn = document.getElementById('syncPreviewBtn');
  const selectAllBtn = document.getElementById('syncSelectAllBtn');
  const deselectAllBtn = document.getElementById('syncDeselectAllBtn');
  const statusEl = document.getElementById('syncStatus');
  const progressEl = document.getElementById('syncProgress');
  const progressUi = createSyncProgressUI(progressEl);
  const reportCard = document.getElementById('syncReportCard');
  const reportSummary = document.getElementById('syncReportSummary');
  const reportDetails = document.getElementById('syncReportDetails');

  const setStatus = (message, type = 'success') => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
  };

  loadSyncFieldMeta()
    .then((meta) => renderSyncFieldGroups(fieldGroupsEl, meta.groups, DEFAULT_SYNC_FIELDS, meta.fieldMeta))
    .catch(() => setStatus('Не удалось загрузить поля синхронизации', 'error'));

  filterEl?.addEventListener('change', () => {
    if (!providerField) return;
    providerField.hidden = filterEl.value !== 'provider';
  });

  initSyncFieldBulkActions(form, selectAllBtn, deselectAllBtn);

  const runSync = async (dryRun) => {
    const fields = collectSyncFields(form);
    if (fields.length === 0) {
      setStatus('Выберите хотя бы одно поле', 'error');
      return;
    }

    const payload = {
      mode: form.mode?.value ?? 'update',
      fields,
      onlyEmpty: form.onlyEmpty?.checked ?? false,
      dryRun,
      filter: form.filter?.value ?? 'all',
      provider: form.provider?.value?.trim() || undefined,
    };

    const staleness = form.staleness?.value?.trim();
    if (staleness) payload.staleness = staleness;

    const family = form.family?.value?.trim();
    if (family) payload.family = family;

    if (payload.filter === 'provider' && !payload.provider) {
      setStatus('Укажите провайдера для фильтра', 'error');
      return;
    }

    const buttons = form.querySelectorAll('button');
    buttons.forEach((btn) => { btn.disabled = true; });
    if (statusEl) statusEl.hidden = true;

    try {
      progressUi.show(dryRun ? 'Формируем предпросмотр…' : 'Обновляем каталог…');
      const donePayload = await consumeSsePost('/api/models/sync/stream', payload, {
        onProgress: (event) => progressUi.update(event),
        onError: (errorPayload) => {
          progressUi.hide();
          setSyncStatus(statusEl, errorPayload?.error || 'Синхронизация не удалась', 'error', errorPayload?.logId);
        },
      });
      progressUi.hide();

      if (!donePayload) return;

      const result = donePayload;
      const data = result.data;
      const logId = result.logId;
      if (reportCard) reportCard.hidden = false;
      if (reportSummary) {
        reportSummary.innerHTML = `Обновлено: ${data.updated}, добавлено: ${data.created}, пропущено: ${data.skipped}, ошибок: ${data.errors}${logId ? ` · <a href="/admin/sync/logs/${escapeHtml(logId)}">журнал</a>` : ''}`;
      }
      renderSyncDiff(reportDetails, data.results.filter((item) => item.diff?.length || item.status === 'error'));

      if (dryRun) {
        setSyncStatus(statusEl, 'Предпросмотр готов', 'success', logId);
      } else if (data.errors > 0) {
        setSyncStatus(statusEl, 'Синхронизация завершена с ошибками', 'error', logId);
      } else {
        setSyncStatus(statusEl, 'Синхронизация завершена', 'success', logId);
      }
    } catch {
      progressUi.hide();
      setSyncStatus(statusEl, 'Синхронизация не удалась', 'error');
    } finally {
      buttons.forEach((btn) => { btn.disabled = false; });
    }
  };

  previewBtn?.addEventListener('click', () => runSync(true));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!confirm('Запустить обновление каталога с выбранными параметрами?')) return;
    runSync(false);
  });
}

const COMPARE_DIFF_ONLY_KEY = 'compare_diff_only';

function readCompareDiffOnlyState() {
  try {
    return sessionStorage.getItem(COMPARE_DIFF_ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

function saveCompareDiffOnlyState(onlyDiff) {
  try {
    if (onlyDiff) {
      sessionStorage.setItem(COMPARE_DIFF_ONLY_KEY, '1');
    } else {
      sessionStorage.removeItem(COMPARE_DIFF_ONLY_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function clearCompareDiffOnlyState() {
  try {
    sessionStorage.removeItem(COMPARE_DIFF_ONLY_KEY);
  } catch {
    // ignore storage errors
  }
}

function initCompareDiffToggle() {
  const table = document.querySelector('.compare-table');
  const toggleBtn = document.getElementById('compareDiffOnlyBtn');
  if (!table || !toggleBtn) return;

  const rows = [...table.querySelectorAll('tbody tr')];

  const normalizeCellValue = (cell) => cell.textContent.trim().replace(/\s+/g, ' ');

  const rowHasDifference = (row) => {
    const cells = [...row.querySelectorAll('td:not(.row-label)')];
    if (cells.length < 2) return true;
    const values = cells.map(normalizeCellValue);
    return new Set(values).size > 1;
  };

  const isGroupRow = (row) => row.classList.contains('compare-group-row');

  const getSectionEndIndex = (startIndex) => {
    for (let i = startIndex + 1; i < rows.length; i += 1) {
      if (isGroupRow(rows[i])) return i;
    }
    return rows.length;
  };

  const applyFilter = (onlyDiff) => {
    let visibleCount = 0;
    rows.forEach((row) => {
      if (isGroupRow(row)) return;
      const show = !onlyDiff || rowHasDifference(row);
      row.hidden = !show;
      if (show) visibleCount += 1;
    });

    rows.forEach((row, index) => {
      if (!isGroupRow(row)) return;
      const endIndex = getSectionEndIndex(index);
      const anyVisible = rows
        .slice(index + 1, endIndex)
        .some((sectionRow) => !sectionRow.hidden);
      row.hidden = onlyDiff && !anyVisible;
    });

    toggleBtn.classList.toggle('active', onlyDiff);
    toggleBtn.setAttribute('aria-pressed', onlyDiff ? 'true' : 'false');
    toggleBtn.textContent = onlyDiff ? 'Показать все' : 'Показать только различия';
    const emptyMsg = document.getElementById('compareEmptyDiff');
    if (emptyMsg) emptyMsg.hidden = !(onlyDiff && visibleCount === 0);
  };

  toggleBtn.addEventListener('click', () => {
    const onlyDiff = toggleBtn.getAttribute('aria-pressed') !== 'true';
    saveCompareDiffOnlyState(onlyDiff);
    applyFilter(onlyDiff);
  });

  if (readCompareDiffOnlyState()) {
    applyFilter(true);
  }
}

function initDetailDescriptionMarkdown() {
  const el = document.getElementById('detailDescription');
  if (!el || typeof formatMarkdownContent !== 'function') return;

  const text = window.DETAIL_DESCRIPTION;
  if (!text) return;

  el.innerHTML = formatMarkdownContent(text);
}

async function refreshDetailModelAfterSync(modelId) {
  try {
    const response = await fetch(`/api/models/${modelId}`);
    if (!response.ok) return;
    const payload = await response.json();
    const model = payload?.data;
    if (!model) return;

    if (Array.isArray(window.MODELS_DATA)) {
      const index = window.MODELS_DATA.findIndex((item) => item.id === model.id);
      if (index >= 0) {
        window.MODELS_DATA[index] = { ...window.MODELS_DATA[index], ...model };
      }
    }

    const updatedEl = document.querySelector('.detail-hero-updated');
    if (updatedEl) {
      const formatted = model.info_updated_formatted || model.updated_at_formatted;
      updatedEl.classList.toggle('muted', !formatted);
      updatedEl.textContent = formatted
        ? `Актуализация: ${formatted}`
        : 'Актуализация не указана';
    }

    if (model.description != null) {
      window.DETAIL_DESCRIPTION = model.description;
      const descEl = document.getElementById('detailDescription');
      if (descEl && typeof formatMarkdownContent === 'function') {
        descEl.innerHTML = formatMarkdownContent(model.description);
      }
    }
  } catch {
    // diff в модалке уже показывает изменения
  }
}

function initDetailSync() {
  const openBtn = document.getElementById('detailSyncBtn');
  if (!openBtn) return;

  const overlay = document.getElementById('detailSyncOverlay');
  const closeBtn = document.getElementById('detailSyncClose');
  const fieldGroupsEl = document.getElementById('detailSyncFieldGroups');
  const previewBtn = document.getElementById('detailSyncPreviewBtn');
  const applyBtn = document.getElementById('detailSyncApplyBtn');
  const cancelBtn = document.getElementById('detailSyncCancelBtn');
  const selectAllBtn = document.getElementById('detailSyncSelectAllBtn');
  const deselectAllBtn = document.getElementById('detailSyncDeselectAllBtn');
  const onlyEmptyEl = document.getElementById('detailSyncOnlyEmpty');
  const previewEl = document.getElementById('detailSyncPreview');
  const progressEl = document.getElementById('detailSyncProgress');
  const progressUi = createSyncProgressUI(progressEl);
  const statusEl = document.getElementById('detailSyncStatus');
  const modelId = openBtn.dataset.modelId;
  let isSyncRunning = false;
  let suppressOverlayClose = false;

  const resetCancelLabel = () => {
    if (cancelBtn) cancelBtn.textContent = 'Отмена';
  };

  const setCancelCloseLabel = () => {
    if (cancelBtn) cancelBtn.textContent = 'Закрыть';
  };

  const setOpen = (isOpen) => {
    overlay?.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  const closeModal = () => {
    if (isSyncRunning) return;
    setOpen(false);
    resetCancelLabel();
  };

  const setStatus = (message, type = 'success') => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
  };

  loadSyncFieldMeta()
    .then((meta) => renderSyncFieldGroups(fieldGroupsEl, meta.groups, DEFAULT_SYNC_FIELDS, meta.fieldMeta))
    .catch(() => setStatus('Не удалось загрузить поля', 'error'));

  openBtn.addEventListener('click', () => {
    if (previewEl) {
      previewEl.hidden = true;
      previewEl.innerHTML = '';
    }
    if (statusEl) statusEl.hidden = true;
    progressUi.hide();
    resetCancelLabel();
    setOpen(true);
  });

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay?.addEventListener('click', (event) => {
    if (event.target !== overlay) return;
    if (suppressOverlayClose) {
      suppressOverlayClose = false;
      return;
    }
    closeModal();
  });

  [previewBtn, applyBtn, cancelBtn].forEach((btn) => {
    btn?.addEventListener('pointerdown', () => {
      suppressOverlayClose = true;
    });
  });

  initSyncFieldBulkActions(overlay, selectAllBtn, deselectAllBtn);

  const runSingleSync = async (dryRun) => {
    const fields = collectSyncFields(overlay);
    if (fields.length === 0) {
      setStatus('Выберите хотя бы одно поле', 'error');
      return;
    }

    const buttons = [previewBtn, applyBtn, cancelBtn, closeBtn].filter(Boolean);
    isSyncRunning = true;
    buttons.forEach((btn) => { btn.disabled = true; });
    if (statusEl) statusEl.hidden = true;

    try {
      progressUi.setIndeterminate(
        dryRun ? 'Формируем предпросмотр…' : 'Обновляем модель…',
        'Загрузка данных из BotHub, OpenRouter и RouterAI',
      );
      const response = await fetch(`/api/models/${modelId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields,
          onlyEmpty: onlyEmptyEl?.checked ?? false,
          dryRun,
        }),
      });
      progressUi.hide();
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setSyncStatus(statusEl, result?.error || 'Синхронизация не удалась', 'error', result?.logId);
        return;
      }

      const data = result.data;
      const logId = result.logId;
      if (previewEl) {
        previewEl.hidden = false;
        renderSyncDiff(previewEl, [data]);
      }

      if (dryRun) {
        setSyncStatus(statusEl, 'Предпросмотр готов', 'success', logId);
        return;
      }

      if (data.status === 'updated') {
        setSyncStatus(statusEl, 'Модель обновлена', 'success', logId);
        void refreshDetailModelAfterSync(modelId);
        return;
      }

      setSyncStatus(
        statusEl,
        data.message || 'Изменений нет',
        data.status === 'error' ? 'error' : 'success',
        logId,
      );
    } catch {
      progressUi.hide();
      setSyncStatus(statusEl, 'Синхронизация не удалась', 'error');
    } finally {
      isSyncRunning = false;
      buttons.forEach((btn) => { btn.disabled = false; });
      if (!dryRun) {
        setCancelCloseLabel();
      }
    }
  };

  previewBtn?.addEventListener('click', () => runSingleSync(true));
  applyBtn?.addEventListener('click', () => runSingleSync(false));
}

function initBulkSyncModal() {
  const overlay = document.getElementById('bulkSyncOverlay');
  if (!overlay) return;

  const closeBtn = document.getElementById('bulkSyncClose');
  const cancelBtn = document.getElementById('bulkSyncCancelBtn');
  const applyBtn = document.getElementById('bulkSyncApplyBtn');
  const countEl = document.getElementById('bulkSyncCount');
  const fieldGroupsEl = document.getElementById('bulkSyncFieldGroups');
  const onlyEmptyEl = document.getElementById('bulkSyncOnlyEmpty');
  const progressEl = document.getElementById('bulkSyncProgress');
  const statusEl = document.getElementById('bulkSyncStatus');
  const presetCatalogBtn = document.getElementById('bulkSyncPresetCatalog');
  const presetWithAiBtn = document.getElementById('bulkSyncPresetWithAi');
  const presetAllBtn = document.getElementById('bulkSyncPresetAll');
  const progressUi = createSyncProgressUI(progressEl);

  let pendingIds = [];
  let syncGroups = [];
  let isRunning = false;
  let suppressOverlayClose = false;

  const setOpen = (isOpen) => {
    overlay.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  const resetStatus = () => {
    if (statusEl) statusEl.hidden = true;
    progressUi.hide();
  };

  const setModalBusy = (busy) => {
    isRunning = busy;
    [applyBtn, cancelBtn, closeBtn, presetCatalogBtn, presetWithAiBtn, presetAllBtn].forEach((btn) => {
      if (btn) btn.disabled = busy;
    });
    overlay.querySelectorAll('input[name="syncGroup"], #bulkSyncOnlyEmpty').forEach((el) => {
      el.disabled = busy;
    });
  };

  loadSyncFieldMeta()
    .then((meta) => {
      syncGroups = meta.groups;
      renderSyncGroupToggles(fieldGroupsEl, syncGroups, DEFAULT_BULK_SYNC_GROUP_IDS);
    })
    .catch(() => {
      setSyncStatus(statusEl, 'Не удалось загрузить группы полей', 'error');
    });

  presetCatalogBtn?.addEventListener('click', () => setSyncGroupChecks(overlay, DEFAULT_BULK_SYNC_GROUP_IDS));
  presetWithAiBtn?.addEventListener('click', () => setSyncGroupChecks(overlay, ALL_SYNC_GROUP_IDS));
  presetAllBtn?.addEventListener('click', () => setSyncGroupChecks(overlay, []));

  const closeModal = () => {
    if (isRunning) return;
    setOpen(false);
    pendingIds = [];
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => {
    if (event.target !== overlay) return;
    if (suppressOverlayClose) {
      suppressOverlayClose = false;
      return;
    }
    closeModal();
  });
  applyBtn?.addEventListener('pointerdown', () => {
    suppressOverlayClose = true;
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('open')) closeModal();
  });

  applyBtn?.addEventListener('click', async () => {
    if (!pendingIds.length || isRunning) return;

    const fields = collectSyncFieldsFromGroups(overlay, syncGroups);
    if (fields.length === 0) {
      setSyncStatus(statusEl, 'Выберите хотя бы одну группу полей', 'error');
      return;
    }

    if (typeof window.runBulkSync !== 'function') {
      setSyncStatus(statusEl, 'Обновление недоступно', 'error');
      return;
    }

    resetStatus();
    setModalBusy(true);
    progressUi.show('Обновление моделей…');

    try {
      await window.runBulkSync(pendingIds, {
        fields,
        onlyEmpty: onlyEmptyEl?.checked ?? false,
        onProgress: (event) => {
          if (event.done) {
            progressUi.hide();
            setSyncStatus(
              statusEl,
              `Готово: обновлено ${event.updated}, без изменений ${event.skipped}, ошибок ${event.failed}`,
              event.failed > 0 ? 'error' : 'success',
            );
            return;
          }

          const model = window.MODELS_DATA?.find((item) => item.id === event.id);
          const modelName = model ? `${model.family}/${model.name}` : event.id;
          progressUi.update({
            type: 'progress',
            phase: 'update',
            current: event.current,
            total: event.total,
            modelName,
            status: event.status,
            summary: {
              updated: event.updated,
              created: 0,
              skipped: event.skipped,
              errors: event.failed,
            },
          });
        },
      });

    } catch {
      progressUi.hide();
      setSyncStatus(statusEl, 'Обновление не удалось', 'error');
    } finally {
      setModalBusy(false);
    }
  });

  window.openBulkSyncModal = (ids) => {
    if (!ids?.length) return;
    pendingIds = [...ids];
    if (countEl) {
      const suffix = pendingIds.length === 1 ? 'модель' : pendingIds.length < 5 ? 'модели' : 'моделей';
      countEl.textContent = `Выбрано: ${pendingIds.length} ${suffix}`;
    }
    resetStatus();
    if (syncGroups.length > 0) {
      renderSyncGroupToggles(fieldGroupsEl, syncGroups, DEFAULT_BULK_SYNC_GROUP_IDS);
    }
    if (onlyEmptyEl) onlyEmptyEl.checked = false;
    setOpen(true);
  };
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
  return 'Не проверялась';
}

function formatAvailabilityCheckedText(model) {
  if (!model.availability_checked_at) return 'Доступность не проверялась';
  const formatted = new Date(model.availability_checked_at).toLocaleDateString('ru-RU');
  let text = `Доступность: ${formatted}`;
  if (model.availability_response_ms != null) {
    text += ` · ${model.availability_response_ms} мс`;
  }
  return text;
}

function formatInferenceSpeedBadge(ms) {
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

function updateDetailInferenceSpeedBadge(model) {
  const badgeEl = document.getElementById('detailInferenceSpeedBadge');
  if (!badgeEl) return;
  const badge = formatInferenceSpeedBadge(model.availability_response_ms);
  if (!badge) {
    badgeEl.hidden = true;
    badgeEl.textContent = '';
    badgeEl.removeAttribute('title');
    return;
  }
  badgeEl.hidden = false;
  badgeEl.textContent = badge.label;
  badgeEl.title = badge.title;
}

function updateDetailAvailabilityDisplay(model) {
  const badgeEl = document.getElementById('detailAvailabilityBadge');
  if (badgeEl) {
    badgeEl.textContent = getAvailabilityBadgeLabel(model.availability_status);
    badgeEl.className = `availability-badge ${getAvailabilityBadgeClass(model.availability_status)}`;
  }
  updateDetailInferenceSpeedBadge(model);
  const el = document.getElementById('detailAvailabilityStatus');
  if (!el) return;
  el.classList.remove('is-error');
  el.classList.toggle('muted', !model.availability_checked_at);
  el.textContent = formatAvailabilityCheckedText(model);
}

function flashDetailAvailabilityUpdated() {
  [
    document.getElementById('detailAvailabilityBadge'),
    document.getElementById('detailInferenceSpeedBadge'),
    document.getElementById('detailAvailabilityStatus'),
  ]
    .forEach((el) => {
      if (!el) return;
      el.classList.remove('availability-updated');
      void el.offsetWidth;
      el.classList.add('availability-updated');
      el.addEventListener('animationend', () => {
        el.classList.remove('availability-updated');
      }, { once: true });
    });
}

function setDetailAvailabilityChecking(activeBtn, mode, isChecking) {
  const badgeEl = document.getElementById('detailAvailabilityBadge');
  const statusEl = document.getElementById('detailAvailabilityStatus');
  const buttons = [
    document.getElementById('detailAvailCatalogBtn'),
    document.getElementById('detailAvailInferenceBtn'),
  ].filter(Boolean);

  buttons.forEach((btn) => {
    const isActive = isChecking && btn === activeBtn;
    btn.disabled = isChecking;
    btn.classList.toggle('is-checking', isActive);
    btn.setAttribute('aria-busy', isActive ? 'true' : 'false');
  });

  badgeEl?.classList.toggle('is-checking', isChecking);

  if (!statusEl) return;

  if (isChecking) {
    if (!statusEl.dataset.prevText) {
      statusEl.dataset.prevText = statusEl.textContent;
    }
    statusEl.classList.remove('muted', 'is-error', 'availability-updated');
    statusEl.classList.add('is-checking');
    statusEl.textContent = mode === 'inference'
      ? 'Проверка inference…'
      : 'Быстрая проверка доступности…';
    return;
  }

  statusEl.classList.remove('is-checking');
  if (statusEl.dataset.prevText) {
    delete statusEl.dataset.prevText;
  }
}

function showDetailAvailabilityError(message) {
  const statusEl = document.getElementById('detailAvailabilityStatus');
  if (!statusEl) return;
  statusEl.classList.remove('muted', 'is-checking', 'availability-updated');
  statusEl.classList.add('is-error');
  statusEl.textContent = message;
}

async function runDetailAvailability(modelId, mode, activeBtn) {
  setDetailAvailabilityChecking(activeBtn, mode, true);
  try {
    const response = await fetch(`/api/models/${modelId}/availability`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      showDetailAvailabilityError(payload?.error || 'Проверка не удалась');
      return;
    }
    if (payload?.model) {
      updateDetailAvailabilityDisplay(payload.model);
      flashDetailAvailabilityUpdated();
    }
  } catch {
    showDetailAvailabilityError('Проверка не удалась');
  } finally {
    setDetailAvailabilityChecking(activeBtn, mode, false);
  }
}

function initDetailAvailability() {
  const catalogBtn = document.getElementById('detailAvailCatalogBtn');
  const inferenceBtn = document.getElementById('detailAvailInferenceBtn');
  if (!catalogBtn && !inferenceBtn) return;

  const modelId = catalogBtn?.dataset.modelId || inferenceBtn?.dataset.modelId;
  if (!modelId) return;

  catalogBtn?.addEventListener('click', () => runDetailAvailability(modelId, 'catalog', catalogBtn));
  inferenceBtn?.addEventListener('click', () => runDetailAvailability(modelId, 'inference', inferenceBtn));
}

function initBulkAvailabilityModal() {
  const overlay = document.getElementById('bulkAvailabilityOverlay');
  if (!overlay) return;

  const closeBtn = document.getElementById('bulkAvailabilityClose');
  const cancelBtn = document.getElementById('bulkAvailabilityCancelBtn');
  const applyBtn = document.getElementById('bulkAvailabilityApplyBtn');
  const countEl = document.getElementById('bulkAvailabilityCount');
  const introEl = document.getElementById('bulkAvailabilityIntro');
  const progressEl = document.getElementById('bulkAvailabilityProgress');
  const statusEl = document.getElementById('bulkAvailabilityStatus');

  let pendingIds = [];
  let pendingMode = 'catalog';
  let isRunning = false;

  const resetCancelLabel = () => {
    if (cancelBtn) cancelBtn.textContent = 'Отмена';
  };

  const setCancelCloseLabel = () => {
    if (cancelBtn) cancelBtn.textContent = 'Закрыть';
  };

  const setOpen = (isOpen) => {
    overlay.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  const setStatus = (message, type = 'success') => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
  };

  const updateProgress = (event) => {
    if (!progressEl) return;
    if (event.done) {
      progressEl.hidden = false;
      progressEl.innerHTML = `
        <div class="sync-progress-current">
          Готово. Доступна: ${event.available}, инференс: ${event.inference}, недоступна: ${event.unavailable}, ошибок: ${event.failed}
        </div>
      `;
      return;
    }

    const percent = event.total ? Math.round((event.current / event.total) * 100) : 0;
    progressEl.hidden = false;
    progressEl.innerHTML = `
      <div class="sync-progress-bar-wrap">
        <div class="sync-progress-bar" style="width:${percent}%"></div>
      </div>
      <div class="sync-progress-meta">
        <span class="sync-progress-count">${event.current} / ${event.total}</span>
        <span class="sync-progress-stats">доступна ${event.available} · инференс ${event.inference} · недоступна ${event.unavailable} · ошибок ${event.failed}</span>
      </div>
    `;
  };

  const closeModal = () => {
    if (isRunning) return;
    setOpen(false);
    pendingIds = [];
    resetCancelLabel();
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && !isRunning) closeModal();
  });

  applyBtn?.addEventListener('click', async () => {
    if (!pendingIds.length || isRunning) return;
    if (typeof window.runBulkAvailability !== 'function') {
      setStatus('Проверка недоступна', 'error');
      return;
    }

    if (statusEl) statusEl.hidden = true;
    isRunning = true;
    resetCancelLabel();
    [applyBtn, cancelBtn, closeBtn].forEach((btn) => { if (btn) btn.disabled = true; });

    try {
      const result = await window.runBulkAvailability(pendingIds, pendingMode, {
        onProgress: updateProgress,
      });
      setStatus(
        `Проверка завершена. Доступна: ${result.available}, инференс: ${result.inference}, недоступна: ${result.unavailable}, ошибок: ${result.failed}`,
        result.failed > 0 ? 'error' : 'success',
      );
    } catch {
      setStatus('Проверка не удалась', 'error');
    } finally {
      isRunning = false;
      setCancelCloseLabel();
      [applyBtn, cancelBtn, closeBtn].forEach((btn) => { if (btn) btn.disabled = false; });
    }
  });

  window.openBulkAvailabilityModal = (ids, mode) => {
    if (!ids?.length) return;
    pendingIds = [...ids];
    pendingMode = mode === 'inference' ? 'inference' : 'catalog';
    if (countEl) {
      const suffix = pendingIds.length === 1 ? 'модель' : pendingIds.length < 5 ? 'модели' : 'моделей';
      countEl.textContent = `Выбрано: ${pendingIds.length} ${suffix}`;
    }
    if (introEl) {
      introEl.textContent = pendingMode === 'inference'
        ? 'Минимальный chat-запрос к провайдеру (~10–30 токенов на модель).'
        : 'Проверка наличия модели в каталоге провайдера без расхода токенов.';
    }
    if (statusEl) statusEl.hidden = true;
    if (progressEl) {
      progressEl.hidden = true;
      progressEl.innerHTML = '';
    }
    resetCancelLabel();
    setOpen(true);
  };
}

function initAdminAvailability() {
  const form = document.getElementById('adminAvailabilityForm');
  if (!form) return;

  const filterEl = document.getElementById('availFilter');
  const providerField = document.getElementById('availProviderField');
  const statusEl = document.getElementById('availStatus');
  const progressEl = document.getElementById('availProgress');
  const reportCard = document.getElementById('availReportCard');
  const reportSummary = document.getElementById('availReportSummary');
  const progressUi = createSyncProgressUI(progressEl);

  const setStatus = (message, type = 'success') => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
  };

  filterEl?.addEventListener('change', () => {
    if (!providerField) return;
    providerField.hidden = filterEl.value !== 'provider';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!confirm('Запустить проверку доступности с выбранными параметрами?')) return;

    const payload = {
      mode: form.mode?.value ?? 'catalog',
      filter: form.filter?.value ?? 'all',
      provider: form.provider?.value?.trim() || undefined,
    };

    const staleness = form.staleness?.value?.trim();
    if (staleness) payload.staleness = staleness;

    const family = form.family?.value?.trim();
    if (family) payload.family = family;

    if (payload.filter === 'provider' && !payload.provider) {
      setStatus('Укажите провайдера для фильтра', 'error');
      return;
    }

    const buttons = form.querySelectorAll('button');
    buttons.forEach((btn) => { btn.disabled = true; });
    if (statusEl) statusEl.hidden = true;

    try {
      progressUi.show('Проверяем доступность…');
      const donePayload = await consumeSsePost('/api/models/availability/stream', payload, {
        onProgress: (event) => {
          if (event.type === 'progress' && event.summary) {
            progressUi.update({
              current: event.current,
              total: event.total,
              modelName: event.modelName,
              summary: {
                updated: event.summary.available + event.summary.inference,
                created: 0,
                skipped: event.summary.unavailable,
                errors: event.summary.errors,
              },
            });
          }
        },
        onError: (errorPayload) => {
          progressUi.hide();
          setStatus(errorPayload?.error || 'Проверка не удалась', 'error');
        },
      });
      progressUi.hide();

      if (!donePayload) return;

      const data = donePayload.data;
      if (reportCard) reportCard.hidden = false;
      if (reportSummary) {
        reportSummary.textContent = `Доступна: ${data.available}, инференс: ${data.inference}, недоступна: ${data.unavailable}, ошибок: ${data.errors}`;
      }

      if (data.errors > 0) {
        setStatus('Проверка завершена с ошибками', 'error');
      } else {
        setStatus('Проверка завершена', 'success');
      }
    } catch {
      progressUi.hide();
      setStatus('Проверка не удалась', 'error');
    } finally {
      buttons.forEach((btn) => { btn.disabled = false; });
    }
  });
}

function formatChatRatingBadgeForClient(avg, count) {
  if (avg == null || !count) return { label: null, title: null };
  const formatted = Number(avg).toFixed(1).replace(/\.0$/, '');
  const countLabel = count === 1 ? '1 оценка' : count < 5 ? `${count} оценки` : `${count} оценок`;
  return {
    label: `★ ${formatted}`,
    title: `Средняя оценка ответов в чате: ${formatted}/5 (${countLabel})`,
  };
}

function updateDetailChatRatingBadge(model) {
  const badgeEl = document.getElementById('detailChatRatingBadge');
  if (!badgeEl) return;
  const badge = formatChatRatingBadgeForClient(model.chat_rating_avg, model.chat_rating_count);
  if (!badge.label) {
    badgeEl.hidden = true;
    badgeEl.textContent = '';
    badgeEl.removeAttribute('title');
    return;
  }
  badgeEl.hidden = false;
  badgeEl.textContent = badge.label;
  badgeEl.title = badge.title;
}

function updateDetailAutoEvalDisplay(rating) {
  const statusEl = document.getElementById('detailAutoEvalStatus');
  const commentEl = document.getElementById('detailAutoEvalComment');
  if (!statusEl) return;

  if (!rating) {
    statusEl.classList.add('muted');
    statusEl.textContent = 'Автооценка не выполнялась';
    if (commentEl) {
      commentEl.hidden = true;
      commentEl.textContent = '';
    }
    return;
  }

  statusEl.classList.remove('muted', 'is-error');
  const formatted = new Date(rating.ratedAt).toLocaleDateString('ru-RU');
  statusEl.textContent = `Автооценка: ${formatted} · ${rating.score}/5`;

  if (commentEl) {
    if (rating.comment) {
      commentEl.hidden = false;
      commentEl.textContent = rating.comment;
    } else {
      commentEl.hidden = true;
      commentEl.textContent = '';
    }
  }
}

function flashDetailEvalUpdated() {
  [
    document.getElementById('detailAutoEvalStatus'),
    document.getElementById('detailAutoEvalComment'),
    document.getElementById('detailChatRatingBadge'),
  ].forEach((el) => {
    if (!el) return;
    el.classList.remove('availability-updated');
    void el.offsetWidth;
    el.classList.add('availability-updated');
    el.addEventListener('animationend', () => {
      el.classList.remove('availability-updated');
    }, { once: true });
  });
}

function setDetailEvaluationChecking(activeBtn, isChecking) {
  const buttons = [
    document.getElementById('detailEvalBtn'),
    document.getElementById('detailAvailCatalogBtn'),
    document.getElementById('detailAvailInferenceBtn'),
  ].filter(Boolean);

  buttons.forEach((btn) => {
    const isActive = isChecking && btn === activeBtn;
    btn.disabled = isChecking;
    btn.classList.toggle('is-checking', isActive);
    btn.setAttribute('aria-busy', isActive ? 'true' : 'false');
  });
}

function showDetailEvaluationError(message) {
  const statusEl = document.getElementById('detailAutoEvalStatus');
  if (!statusEl) return;
  statusEl.classList.remove('muted', 'availability-updated');
  statusEl.classList.add('is-error');
  statusEl.textContent = message;
}

async function runModelEvaluation(modelId, activeBtn, options = {}) {
  setDetailEvaluationChecking(activeBtn, true);
  try {
    const response = await fetch(`/api/models/${modelId}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message = payload?.error || 'Автооценка не удалась';
      if (options.onError) options.onError(message);
      else showDetailEvaluationError(message);
      return null;
    }

    if (payload?.model) {
      updateDetailAvailabilityDisplay(payload.model);
      updateDetailChatRatingBadge(payload.model);
      if (typeof window.syncModelInCatalog === 'function') {
        window.syncModelInCatalog(payload.model);
      }
      if (typeof window.applyCatalogFilters === 'function') {
        window.applyCatalogFilters();
      }
    }
    if (payload?.rating) {
      updateDetailAutoEvalDisplay(payload.rating);
    }
    flashDetailEvalUpdated();
    options.onSuccess?.(payload);
    return payload;
  } catch {
    const message = 'Автооценка не удалась';
    if (options.onError) options.onError(message);
    else showDetailEvaluationError(message);
    return null;
  } finally {
    setDetailEvaluationChecking(activeBtn, false);
  }
}

function initBulkEvaluationModal() {
  const overlay = document.getElementById('bulkEvaluationOverlay');
  if (!overlay) return;

  const closeBtn = document.getElementById('bulkEvaluationClose');
  const cancelBtn = document.getElementById('bulkEvaluationCancelBtn');
  const applyBtn = document.getElementById('bulkEvaluationApplyBtn');
  const countEl = document.getElementById('bulkEvaluationCount');
  const progressEl = document.getElementById('bulkEvaluationProgress');
  const statusEl = document.getElementById('bulkEvaluationStatus');

  let pendingIds = [];
  let isRunning = false;

  const resetCancelLabel = () => {
    if (cancelBtn) cancelBtn.textContent = 'Отмена';
  };

  const setCancelCloseLabel = () => {
    if (cancelBtn) cancelBtn.textContent = 'Закрыть';
  };

  const setOpen = (isOpen) => {
    overlay.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  const setStatus = (message, type = 'success') => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
  };

  const updateProgress = (event) => {
    if (!progressEl) return;
    if (event.done) {
      progressEl.hidden = false;
      progressEl.innerHTML = `
        <div class="sync-progress-current">
          Готово. Успешно: ${event.success}, ошибки парсинга: ${event.parseErrors}, ошибок: ${event.failed}
        </div>
      `;
      return;
    }

    const percent = event.total ? Math.round((event.current / event.total) * 100) : 0;
    progressEl.hidden = false;
    progressEl.innerHTML = `
      <div class="sync-progress-bar-wrap">
        <div class="sync-progress-bar" style="width:${percent}%"></div>
      </div>
      <div class="sync-progress-meta">
        <span class="sync-progress-count">${event.current} / ${event.total}</span>
        <span class="sync-progress-stats">успешно ${event.success} · парсинг ${event.parseErrors} · ошибок ${event.failed}</span>
      </div>
    `;
  };

  const closeModal = () => {
    if (isRunning) return;
    setOpen(false);
    pendingIds = [];
    resetCancelLabel();
  };

  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay && !isRunning) closeModal();
  });

  applyBtn?.addEventListener('click', async () => {
    if (!pendingIds.length || isRunning) return;
    if (typeof window.runBulkEvaluation !== 'function') {
      setStatus('Автооценка недоступна', 'error');
      return;
    }

    if (statusEl) statusEl.hidden = true;
    isRunning = true;
    resetCancelLabel();
    [applyBtn, cancelBtn, closeBtn].forEach((btn) => { if (btn) btn.disabled = true; });

    try {
      const result = await window.runBulkEvaluation(pendingIds, {
        onProgress: updateProgress,
      });
      setStatus(
        `Автооценка завершена. Успешно: ${result.success}, ошибки парсинга: ${result.parseErrors}, ошибок: ${result.failed}`,
        result.failed > 0 ? 'error' : 'success',
      );
    } catch {
      setStatus('Автооценка не удалась', 'error');
    } finally {
      isRunning = false;
      setCancelCloseLabel();
      [applyBtn, cancelBtn, closeBtn].forEach((btn) => { if (btn) btn.disabled = false; });
    }
  });

  window.openBulkEvaluationModal = (ids) => {
    if (!ids?.length) return;
    pendingIds = [...ids];
    if (countEl) {
      const suffix = pendingIds.length === 1 ? 'модель' : pendingIds.length < 5 ? 'модели' : 'моделей';
      countEl.textContent = `Выбрано: ${pendingIds.length} ${suffix}`;
    }
    if (statusEl) statusEl.hidden = true;
    if (progressEl) {
      progressEl.hidden = true;
      progressEl.innerHTML = '';
    }
    resetCancelLabel();
    setOpen(true);
  };
}

function initDetailEvaluation() {
  const evalBtn = document.getElementById('detailEvalBtn');
  if (!evalBtn) return;
  const modelId = evalBtn.dataset.modelId;
  if (!modelId) return;
  evalBtn.addEventListener('click', () => runModelEvaluation(modelId, evalBtn));
}

function initAdminEvaluation() {
  const form = document.getElementById('adminEvaluationForm');
  if (!form) return;

  const filterEl = document.getElementById('evalFilter');
  const providerField = document.getElementById('evalProviderField');
  const statusEl = document.getElementById('evalStatus');
  const progressEl = document.getElementById('evalProgress');
  const reportCard = document.getElementById('evalReportCard');
  const reportSummary = document.getElementById('evalReportSummary');
  const progressUi = createSyncProgressUI(progressEl);

  const setStatus = (message, type = 'success') => {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.className = `form-status ${type}`;
  };

  filterEl?.addEventListener('change', () => {
    if (!providerField) return;
    providerField.hidden = filterEl.value !== 'provider';
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!confirm('Запустить автооценку с выбранными параметрами? Это расходует токены провайдера.')) return;

    const payload = {
      filter: form.filter?.value ?? 'all',
      provider: form.provider?.value?.trim() || undefined,
      inferenceOnly: Boolean(form.inferenceOnly?.checked),
    };

    const staleness = form.staleness?.value?.trim();
    if (staleness) payload.staleness = staleness;

    const family = form.family?.value?.trim();
    if (family) payload.family = family;

    if (payload.filter === 'provider' && !payload.provider) {
      setStatus('Укажите провайдера для фильтра', 'error');
      return;
    }

    const buttons = form.querySelectorAll('button');
    buttons.forEach((btn) => { btn.disabled = true; });
    if (statusEl) statusEl.hidden = true;

    try {
      progressUi.show('Выполняем автооценку…');
      const donePayload = await consumeSsePost('/api/models/evaluation/stream', payload, {
        onProgress: (event) => {
          if (event.type === 'progress' && event.summary) {
            progressUi.update({
              current: event.current,
              total: event.total,
              modelName: event.modelName,
              summary: {
                updated: event.summary.success,
                created: 0,
                skipped: event.summary.parseErrors,
                errors: event.summary.errors,
              },
            });
          }
        },
        onError: (errorPayload) => {
          progressUi.hide();
          setStatus(errorPayload?.error || 'Автооценка не удалась', 'error');
        },
      });
      progressUi.hide();

      if (!donePayload) return;

      const data = donePayload.data;
      if (reportCard) reportCard.hidden = false;
      if (reportSummary) {
        reportSummary.textContent = `Успешно: ${data.success}, ошибки парсинга: ${data.parseErrors}, ошибок: ${data.errors}`;
      }

      if (data.errors > 0) {
        setStatus('Автооценка завершена с ошибками', 'error');
      } else {
        setStatus('Автооценка завершена', 'success');
      }
    } catch {
      progressUi.hide();
      setStatus('Автооценка не удалась', 'error');
    } finally {
      buttons.forEach((btn) => { btn.disabled = false; });
    }
  });
}
