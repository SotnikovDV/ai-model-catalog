(function initAddToListModule() {
  const LIST_ICON = '<svg class="card-action-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01"/></svg>';

  let modelIds = [];
  let bound = false;

  function escHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function showStatus(message, isError = false) {
    const status = document.getElementById('addToListStatus');
    if (!status) return;
    status.textContent = message;
    status.hidden = false;
    status.classList.remove('form-status--success', 'form-status--error');
    status.classList.add(isError ? 'form-status--error' : 'form-status--success');
  }

  function close() {
    const overlay = document.getElementById('addToListOverlay');
    if (overlay) overlay.classList.remove('open');
    modelIds = [];
  }

  async function open(idsInput, options = {}) {
    const ids = [...new Set((idsInput || []).filter(Boolean))];
    if (!ids.length) {
      alert('Выберите хотя бы одну модель');
      return;
    }

    const defaultComment = typeof options === 'string'
      ? options
      : String(options?.comment ?? '');

    if (window.AdminAccess?.needsLogin()) {
      const next = window.location.pathname + window.location.search || '/';
      window.location.href = window.AdminAccess.protectedHref(next) || '/login';
      return;
    }

    modelIds = ids;
    const overlay = document.getElementById('addToListOverlay');
    const select = document.getElementById('addToListSelect');
    const comment = document.getElementById('addToListComment');
    const countEl = document.getElementById('addToListCount');
    const status = document.getElementById('addToListStatus');
    if (!overlay || !select) {
      alert('Модалка добавления в список недоступна на этой странице');
      return;
    }

    if (countEl) {
      const n = ids.length;
      const suffix = n === 1 ? 'модель' : n < 5 ? 'модели' : 'моделей';
      countEl.textContent = `Выбрано: ${n} ${suffix}`;
    }
    if (comment) comment.value = defaultComment.slice(0, 5000);
    if (status) {
      status.hidden = true;
      status.textContent = '';
    }

    select.innerHTML = '<option value="">Загрузка…</option>';
    select.disabled = true;
    overlay.classList.add('open');

    try {
      const response = await fetch('/api/lists');
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        select.innerHTML = '<option value="">Не удалось загрузить списки</option>';
        showStatus(payload?.error || 'Не удалось загрузить списки', true);
        return;
      }

      const lists = Array.isArray(payload.data) ? payload.data : [];
      if (!lists.length) {
        select.innerHTML = '<option value="">Списков пока нет</option>';
        showStatus('Сначала создайте список в админке', true);
        return;
      }

      select.innerHTML = lists
        .map((list) => `<option value="${escHtml(list.id)}">${escHtml(list.name)} (${list.itemCount})</option>`)
        .join('');
      select.disabled = false;
    } catch {
      select.innerHTML = '<option value="">Не удалось загрузить списки</option>';
      showStatus('Не удалось загрузить списки', true);
    }
  }

  async function submit() {
    const select = document.getElementById('addToListSelect');
    const commentEl = document.getElementById('addToListComment');
    const applyBtn = document.getElementById('addToListApplyBtn');
    const listId = select?.value;
    if (!listId) {
      showStatus('Выберите список', true);
      return;
    }
    if (!modelIds.length) {
      showStatus('Нет моделей для добавления', true);
      return;
    }

    const comment = commentEl?.value?.trim() || '';
    if (applyBtn) applyBtn.disabled = true;

    try {
      const response = await (window.authFetch || fetch)(`/api/lists/${encodeURIComponent(listId)}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: modelIds.map((modelId) => ({ modelId, comment })),
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        showStatus(payload?.error || 'Не удалось добавить в список', true);
        return;
      }

      const added = payload?.data?.added ?? 0;
      const skipped = payload?.data?.skipped ?? 0;
      showStatus(
        skipped > 0
          ? `Добавлено: ${added}, уже были в списке: ${skipped}`
          : `Добавлено моделей: ${added}`,
      );
      window.setTimeout(() => close(), 700);
    } catch {
      showStatus('Не удалось добавить в список', true);
    } finally {
      if (applyBtn) applyBtn.disabled = false;
    }
  }

  function bindUi() {
    if (bound) return;
    const overlay = document.getElementById('addToListOverlay');
    if (!overlay) return;
    bound = true;

    document.getElementById('addToListClose')?.addEventListener('click', close);
    document.getElementById('addToListCancelBtn')?.addEventListener('click', close);
    document.getElementById('addToListApplyBtn')?.addEventListener('click', () => {
      void submit();
    });
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  function handleClick(event) {
    const button = event.target.closest(
      'button.card-list-btn, button.compare-list-btn, a.card-list-btn, button#mListBtn, button#detailListBtn, button#chatListBtn',
    );
    if (!button) return;
    if (button.tagName === 'A') return;

    event.preventDefault();
    event.stopPropagation();
    const id = button.dataset.id;
    if (!id) return;

    const recItem = button.closest('.rec-item');
    const rationale = recItem?.querySelector('.rec-rationale')?.textContent?.trim() || '';
    void open([id], { comment: rationale });
  }

  function init() {
    bindUi();
    if (!document.body.dataset.addToListClickBound) {
      document.body.dataset.addToListClickBound = '1';
      document.addEventListener('click', handleClick);
    }
  }

  window.AddToList = {
    open,
    close,
    init,
    LIST_ICON,
  };
  window.openAddToListModal = open;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
