(function initModelModal() {
  const PRICE_LABELS = {
    '🆓 Бесплатные': '🆓 Бесплатные',
    '💚 Бюджетные (до ~200 руб./1М)': '💚 Бюджетные',
    '🟡 Оптимальные (200–1500 руб./1М)': '🟡 Оптимальные',
    '🔴 Премиум (1500–5000 руб./1М)': '🔴 Премиум',
    '⛔ Топ-флагманы (>5000 руб./1М)': '⛔ Топ-флагманы',
  };

  const CARD_EYE_ICON = '<svg class="card-hidden-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const CARD_EYE_OFF_ICON = '<svg class="card-hidden-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const COMPARE_CHECK_OFF_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/></svg>';
  const COMPARE_CHECK_ON_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><path d="M7.5 12.2l3 3 6-6.4"/></svg>';

  let currentModel = null;
  let initialized = false;
  let bindDefaultActions = false;

  function escHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getPriceCategory(input, output) {
    if (input === 0 && output === 0) return '🆓 Бесплатные';
    const price = Math.max(Number(input) || 0, Number(output) || 0);
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
    if (value == null || value === '') return '—';
    return String(value);
  }

  function formatDate(iso) {
    if (!iso) return null;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString('ru-RU');
  }

  function enrichModel(model) {
    if (!model) return null;
    if (model.prompt_price != null && model.context != null && model.price_category) {
      return model;
    }
    return {
      ...model,
      price_category: model.price_category
        || getPriceCategory(model.input_price_per_mtok, model.output_price_per_mtok),
      context: model.context || formatTokens(model.context_window),
      output_max: model.output_max || formatTokens(model.max_output_tokens),
      prompt_price: model.prompt_price ?? formatPrice(model.input_price_per_mtok),
      answer_price: model.answer_price ?? formatPrice(model.output_price_per_mtok),
    };
  }

  function updateFavoriteBtn(isFavorite) {
    const button = document.getElementById('mFavoriteBtn');
    if (!button) return;
    button.classList.toggle('active', Boolean(isFavorite));
    button.textContent = '★';
    const title = isFavorite ? 'Убрать из избранного' : 'Добавить в избранное';
    button.title = title;
    button.setAttribute('aria-label', title);
  }

  function updateHiddenBtn(isHidden) {
    const button = document.getElementById('mHiddenBtn');
    if (!button) return;
    button.innerHTML = isHidden ? CARD_EYE_OFF_ICON : CARD_EYE_ICON;
    const title = isHidden ? 'Показать в каталоге' : 'Скрыть модель';
    button.title = title;
    button.setAttribute('aria-label', title);
  }

  function updateCompareBtn(inBuffer) {
    const button = document.getElementById('mCompareBtn');
    if (!button) return;
    const icon = button.querySelector('.compare-btn-icon');
    if (icon) icon.innerHTML = inBuffer ? COMPARE_CHECK_ON_ICON : COMPARE_CHECK_OFF_ICON;
    button.classList.toggle('active', Boolean(inBuffer));
    button.setAttribute('aria-pressed', inBuffer ? 'true' : 'false');
    const title = inBuffer ? 'Убрать из сравнения' : 'Добавить к сравнению';
    button.title = title;
    button.setAttribute('aria-label', title);
  }

  function close() {
    document.getElementById('modalOverlay')?.classList.remove('open');
    document.body.style.overflow = '';
  }

  function open(rawModel) {
    const model = enrichModel(rawModel);
    if (!model?.id) return;
    currentModel = model;

    const isFree = model.price_category === '🆓 Бесплатные';
    const promptVal = model.prompt_price === '—' || !model.prompt_price ? '—' : model.prompt_price;
    const answerVal = model.answer_price === '—' || !model.answer_price ? '—' : model.answer_price;

    const nameEl = document.getElementById('mName');
    if (nameEl) nameEl.textContent = model.name || '';

    const developerEl = document.getElementById('mDeveloper');
    if (developerEl) developerEl.textContent = `🏢 ${model.family || '—'}`;

    const badges = [
      `<span class="modal-badge type">${escHtml(model.modality || '—')}</span>`,
      `<span class="modal-badge">${escHtml(PRICE_LABELS[model.price_category] || model.price_category || '—')}</span>`,
    ];
    if (model.release_date) badges.push(`<span class="modal-badge">Релиз: ${escHtml(model.release_date)}</span>`);
    if (model.supports_vision) badges.push('<span class="modal-badge">Vision</span>');
    if (model.supports_function_calling) badges.push('<span class="modal-badge">Function calling</span>');
    if (model.supports_json_mode) badges.push('<span class="modal-badge">JSON mode</span>');
    if (model.supports_streaming) badges.push('<span class="modal-badge">Streaming</span>');
    if (model.supports_web_search) badges.push('<span class="modal-badge">Поиск в интернете</span>');
    if (model.is_favorite) badges.push('<span class="modal-badge favorite-badge">⭐ Избранное</span>');
    const badgesEl = document.getElementById('mBadges');
    if (badgesEl) badgesEl.innerHTML = badges.join('');

    const descEl = document.getElementById('mDescription');
    if (descEl) {
      const description = model.description || 'Описание недоступно.';
      descEl.innerHTML = typeof window.formatMarkdownContent === 'function'
        ? window.formatMarkdownContent(description)
        : escHtml(description).replace(/\n/g, '<br>');
    }

    const createdEl = document.getElementById('mCreated');
    if (createdEl) {
      const formatted = formatDate(model.created_at);
      createdEl.textContent = formatted ? `В каталоге с: ${formatted}` : 'Дата добавления не указана';
      createdEl.classList.toggle('muted', !model.created_at);
    }

    const updatedEl = document.getElementById('mUpdated');
    if (updatedEl) {
      const sourceDate = model.info_updated_at || model.updated_at;
      const formatted = formatDate(sourceDate);
      updatedEl.textContent = formatted ? `Актуализация: ${formatted}` : 'Актуализация не указана';
      updatedEl.classList.toggle('muted', !sourceDate);
    }

    const specsEl = document.getElementById('mSpecs');
    if (specsEl) {
      specsEl.innerHTML = [
        ['Контекст', model.context || '—', ''],
        ['Макс. вывод', model.output_max || '—', ''],
        ['Промпт / 1M', promptVal !== '—' && !isFree ? `${promptVal} ₽` : promptVal, isFree || promptVal === '—' ? 'free' : 'price'],
        ['Ответ / 1M', answerVal !== '—' && !isFree ? `${answerVal} ₽` : answerVal, isFree || answerVal === '—' ? 'free' : 'price'],
      ].map(([label, value, cls]) => `
        <div class="modal-spec">
          <div class="modal-spec-label">${label}</div>
          <div class="modal-spec-value ${cls}">${escHtml(String(value))}</div>
        </div>`).join('');
    }

    const strengths = model.pros || [];
    const strengthsEl = document.getElementById('mStrengths');
    const strengthsSection = document.getElementById('mStrengthsSection');
    if (strengthsEl) strengthsEl.innerHTML = strengths.map((item) => `<li>${escHtml(item)}</li>`).join('');
    if (strengthsSection) strengthsSection.style.display = strengths.length ? '' : 'none';

    const bestFor = model.use_cases || [];
    const bestForEl = document.getElementById('mBestFor');
    const bestForSection = document.getElementById('mBestForSection');
    if (bestForEl) bestForEl.innerHTML = bestFor.map((item) => `<li>${escHtml(item)}</li>`).join('');
    if (bestForSection) bestForSection.style.display = bestFor.length ? '' : 'none';

    const limits = model.cons || [];
    const limitsEl = document.getElementById('mLimits');
    const limitsSection = document.getElementById('mLimitsSection');
    if (limitsEl) limitsEl.innerHTML = limits.map((item) => `<li>${escHtml(item)}</li>`).join('');
    if (limitsSection) limitsSection.style.display = limits.length ? '' : 'none';

    const catsHtml = bestFor.map((item) => `<span class="modal-cat-badge">📌 ${escHtml(item)}</span>`).join('');
    const catsEl = document.getElementById('mCats');
    const catsSection = document.getElementById('mCatsSection');
    if (catsEl) catsEl.innerHTML = catsHtml;
    if (catsSection) catsSection.style.display = catsHtml ? '' : 'none';

    const AA = window.AdminAccess;
    const detailLink = document.getElementById('mDetailLink');
    const chatLink = document.getElementById('mChatLink');
    const editLink = document.getElementById('mEditLink');
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
      updateHiddenBtn(model.is_hidden);
    }

    const favoriteBtn = document.getElementById('mFavoriteBtn');
    if (favoriteBtn) {
      favoriteBtn.dataset.id = model.id;
      updateFavoriteBtn(model.is_favorite);
    }

    const listBtn = document.getElementById('mListBtn');
    if (listBtn) {
      listBtn.dataset.id = model.id;
    }

    const compareBtn = document.getElementById('mCompareBtn');
    if (compareBtn) {
      compareBtn.dataset.id = model.id;
      updateCompareBtn(window.CompareBuffer?.has(model.id) ?? false);
    }

    const copyNameBtn = document.getElementById('mCopyNameBtn');
    if (copyNameBtn) {
      copyNameBtn.dataset.copyText = model.name || '';
      copyNameBtn.hidden = !model.name;
      window.CopyModelName?.bind(copyNameBtn);
    }
    const describeNameBtn = document.getElementById('mDescribeNameBtn');
    if (describeNameBtn) {
      describeNameBtn.dataset.modelName = model.name || '';
      describeNameBtn.dataset.modelId = model.id || '';
      describeNameBtn.hidden = !model.name;
      window.CopyModelName?.bindDescribe?.(describeNameBtn);
    }

    document.getElementById('modalOverlay')?.classList.add('open');
    const box = document.getElementById('modalBox');
    if (box) box.scrollTop = 0;
    document.body.style.overflow = 'hidden';
  }

  async function openById(id) {
    if (!id) return;
    try {
      const response = await fetch(`/api/models/${encodeURIComponent(id)}`);
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        window.alert(payload?.error || 'Не удалось загрузить модель');
        return;
      }
      const model = payload?.data || payload;
      open(model);
    } catch {
      window.alert('Сетевая ошибка при загрузке модели');
    }
  }

  async function patchModel(id, fields) {
    const response = await fetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'Не удалось обновить модель');
    }
    return payload?.data || payload;
  }

  function bindNameClicks(root = document) {
    const scope = root || document;
    scope.querySelectorAll('[data-model-modal-id]').forEach((element) => {
      if (element.dataset.modelModalBound === '1') return;
      element.dataset.modelModalBound = '1';
      element.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const id = element.getAttribute('data-model-modal-id');
        void openById(id);
      });
    });
  }

  function init(options = {}) {
    if (initialized) return;
    initialized = true;
    bindDefaultActions = Boolean(options.bindDefaultActions);

    document.getElementById('modalClose')?.addEventListener('click', close);
    document.getElementById('modalOverlay')?.addEventListener('click', (event) => {
      if (event.target === document.getElementById('modalOverlay')) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.getElementById('modalOverlay')?.classList.contains('open')) {
        close();
      }
    });

    if (!bindDefaultActions) return;

    document.getElementById('mFavoriteBtn')?.addEventListener('click', async (event) => {
      const id = event.currentTarget.dataset.id;
      if (!id || !currentModel) return;
      if (!window.AdminAccess?.guardAction(event, `/models/${id}`)) return;
      try {
        const updated = await patchModel(id, { is_favorite: !currentModel.is_favorite });
        currentModel = enrichModel({ ...currentModel, ...updated });
        updateFavoriteBtn(currentModel.is_favorite);
      } catch {
        window.alert('Не удалось обновить избранное');
      }
    });

    document.getElementById('mListBtn')?.addEventListener('click', (event) => {
      const id = event.currentTarget.dataset.id;
      if (!id) return;
      event.stopPropagation();
      if (window.openAddToListModal) {
        void window.openAddToListModal([id]);
        return;
      }
      if (window.AdminAccess?.needsLogin()) {
        window.AdminAccess.guardAction(event, `/models/${id}`);
      }
    });

    document.getElementById('mHiddenBtn')?.addEventListener('click', async (event) => {
      const id = event.currentTarget.dataset.id;
      if (!id || !currentModel) return;
      if (!window.AdminAccess?.guardAction(event, `/models/${id}`)) return;
      try {
        const updated = await patchModel(id, { is_hidden: !currentModel.is_hidden });
        currentModel = enrichModel({ ...currentModel, ...updated });
        updateHiddenBtn(currentModel.is_hidden);
      } catch {
        window.alert('Не удалось обновить признак «Скрытая»');
      }
    });

    document.getElementById('mCompareBtn')?.addEventListener('click', (event) => {
      const id = event.currentTarget.dataset.id;
      if (!id || !window.CompareBuffer) return;
      window.CompareBuffer.toggle(id);
      updateCompareBtn(window.CompareBuffer.has(id));
    });

    if (window.CompareBuffer) {
      window.CompareBuffer.onChange(() => {
        const id = document.getElementById('mCompareBtn')?.dataset.id;
        if (id) updateCompareBtn(window.CompareBuffer.has(id));
      });
    }
  }

  window.ModelModal = {
    init,
    open,
    openById,
    close,
    bindNameClicks,
    enrichModel,
  };
})();
