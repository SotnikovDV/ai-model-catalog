(function initHelp() {
  const OVERLAY_ID = 'helpOverlay';
  let currentContext = null;
  let loadingContext = null;

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.className = 'modal-overlay help-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'helpModalTitle');
    overlay.innerHTML = `
      <div class="modal help-modal">
        <div class="modal-header help-modal-header">
          <div class="modal-header-top">
            <div class="modal-header-main">
              <h2 class="modal-title" id="helpModalTitle">Справка</h2>
              <p class="help-modal-desc muted" id="helpModalDesc" hidden></p>
            </div>
            <button type="button" class="modal-close" id="helpModalClose" aria-label="Закрыть">&times;</button>
          </div>
        </div>
        <div class="modal-body help-modal-body">
          <div class="help-modal-content markdown-body" id="helpModalContent"></div>
          <p class="help-modal-error form-status error" id="helpModalError" hidden></p>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close();
    });
    overlay.querySelector('#helpModalClose')?.addEventListener('click', close);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && overlay.classList.contains('open')) {
        close();
      }
    });

    return overlay;
  }

  function setOpen(isOpen) {
    const overlay = ensureOverlay();
    overlay.classList.toggle('open', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
  }

  function renderMarkdown(markdown) {
    if (typeof window.formatMarkdownContent === 'function') {
      return window.formatMarkdownContent(markdown);
    }
    return String(markdown ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
  }

  function setError(message) {
    const errorEl = document.getElementById('helpModalError');
    const contentEl = document.getElementById('helpModalContent');
    if (!errorEl) return;
    errorEl.hidden = !message;
    errorEl.textContent = message || '';
    if (message && contentEl) {
      contentEl.innerHTML = '';
    }
  }

  function setLoading() {
    const titleEl = document.getElementById('helpModalTitle');
    const descEl = document.getElementById('helpModalDesc');
    const contentEl = document.getElementById('helpModalContent');
    if (titleEl) titleEl.textContent = 'Справка';
    if (descEl) {
      descEl.hidden = true;
      descEl.textContent = '';
    }
    const errorEl = document.getElementById('helpModalError');
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    if (contentEl) {
      contentEl.innerHTML = '<p class="muted">Загрузка…</p>';
    }
  }

  async function open(context) {
    const ctx = String(context || '').trim();
    if (!ctx) return;

    currentContext = ctx;
    loadingContext = ctx;
    ensureOverlay();
    setLoading();
    setOpen(true);

    try {
      const response = await fetch(`/api/help/${encodeURIComponent(ctx)}`);
      const payload = await response.json().catch(() => null);
      if (loadingContext !== ctx) return;

      if (!response.ok) {
        setError(payload?.error || 'Не удалось загрузить справку');
        return;
      }

      const data = payload?.data;
      const titleEl = document.getElementById('helpModalTitle');
      const descEl = document.getElementById('helpModalDesc');
      const contentEl = document.getElementById('helpModalContent');
      const errorEl = document.getElementById('helpModalError');

      if (titleEl) titleEl.textContent = data?.title || 'Справка';
      if (descEl) {
        if (data?.description) {
          descEl.hidden = false;
          descEl.textContent = data.description;
        } else {
          descEl.hidden = true;
          descEl.textContent = '';
        }
      }
      if (errorEl) {
        errorEl.hidden = true;
        errorEl.textContent = '';
      }
      if (contentEl) {
        contentEl.innerHTML = renderMarkdown(data?.markdown || '');
      }
    } catch {
      if (loadingContext !== ctx) return;
      setError('Сетевая ошибка при загрузке справки');
    } finally {
      if (loadingContext === ctx) loadingContext = null;
    }
  }

  function close() {
    setOpen(false);
    loadingContext = null;
  }

  function setContext(context) {
    currentContext = String(context || '').trim() || null;
    document.querySelectorAll('[data-help-context][data-help-bind="context"]').forEach((el) => {
      if (currentContext) el.setAttribute('data-help-context', currentContext);
    });
  }

  function getContext() {
    return currentContext;
  }

  function bindTriggers(root = document) {
    root.querySelectorAll('[data-help-context]').forEach((el) => {
      if (el.dataset.helpBound === '1') return;
      el.dataset.helpBound = '1';
      el.addEventListener('click', (event) => {
        event.preventDefault();
        const context = el.getAttribute('data-help-context');
        if (context) void open(context);
      });
    });
  }

  window.Help = {
    open,
    close,
    setContext,
    getContext,
    bindTriggers,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bindTriggers());
  } else {
    bindTriggers();
  }
})();
