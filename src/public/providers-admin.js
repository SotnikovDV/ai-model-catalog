function showStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  element.classList.remove('form-status--success', 'form-status--error');
  element.classList.add(isError ? 'form-status--error' : 'form-status--success');
}

function transliterateToSlug(value) {
  const map = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i',
    й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't',
    у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
    э: 'e', ю: 'yu', я: 'ya',
  };

  return value
    .trim()
    .toLowerCase()
    .split('')
    .map((char) => map[char] ?? char)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

async function deleteProvider(id, name) {
  if (!confirm(`Удалить провайдера «${name}»?`)) return;

  const response = await (window.authFetch || fetch)(`/api/providers/${id}`, { method: 'DELETE' });
  if (response.status === 204) {
    const card = document.querySelector(`.provider-card[data-provider-id="${id}"]`);
    card?.remove();

    const grid = document.getElementById('providersGrid');
    const remaining = grid?.querySelectorAll('.provider-card').length ?? 0;
    if (remaining === 0) {
      window.location.reload();
      return;
    }

    const status = document.getElementById('providersStatus');
    showStatus(status, 'Провайдер удалён');
    return;
  }

  const payload = await response.json().catch(() => null);
  const status = document.getElementById('providersStatus');
  showStatus(status, payload?.error || 'Не удалось удалить провайдера', true);
}

function initProvidersSearch() {
  const input = document.getElementById('providersSearch');
  const grid = document.getElementById('providersGrid');
  const searchEmpty = document.getElementById('providersSearchEmpty');
  if (!input || !grid) return;

  const cards = [...grid.querySelectorAll('.provider-card')];

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;

    for (const card of cards) {
      const haystack = card.dataset.searchText ?? '';
      const match = !query || haystack.includes(query);
      card.hidden = !match;
      if (match) visible += 1;
    }

    if (searchEmpty) {
      searchEmpty.hidden = visible > 0 || !query;
    }
  });
}

function initProvidersList() {
  document.querySelectorAll('[data-delete-provider]').forEach((button) => {
    button.addEventListener('click', () => {
      deleteProvider(button.dataset.deleteProvider, button.dataset.providerName);
    });
  });

  initProvidersSearch();
}

function initCatalogSourcePicker() {
  const form = document.getElementById('providerForm');
  const modelsUrlInput = document.getElementById('modelsUrl');
  const baseUrlInput = document.getElementById('baseUrl');
  if (!form) return;

  const parseHints = (input) => {
    if (!input) return {};
    try {
      return JSON.parse(input.dataset.urlHints || '{}');
    } catch {
      return {};
    }
  };

  const modelsUrlHints = parseHints(modelsUrlInput);
  const baseUrlHints = parseHints(baseUrlInput);

  const updatePlaceholders = () => {
    const selected = form.querySelector('input[name="catalog_source"]:checked');
    const source = selected?.value || 'custom';
    if (modelsUrlInput) {
      modelsUrlInput.placeholder = modelsUrlHints[source] || modelsUrlHints.custom || 'https://...';
    }
    if (baseUrlInput) {
      baseUrlInput.placeholder = baseUrlHints[source] || baseUrlHints.custom || 'https://...';
    }
  };

  form.querySelectorAll('input[name="catalog_source"]').forEach((radio) => {
    radio.addEventListener('change', updatePlaceholders);
  });

  updatePlaceholders();
}

function initAutoSlug() {
  const form = document.getElementById('providerForm');
  const nameInput = document.getElementById('providerName');
  const slugInput = document.getElementById('providerSlug');
  if (!form || !nameInput || !slugInput) return;

  const isEdit = Boolean(form.querySelector('input[name="id"]')?.value);
  if (isEdit) return;

  let slugTouched = false;

  slugInput.addEventListener('input', () => {
    slugTouched = true;
  });

  nameInput.addEventListener('input', () => {
    if (slugTouched) return;
    slugInput.value = transliterateToSlug(nameInput.value);
  });
}

function initProviderForm() {
  const form = document.getElementById('providerForm');
  if (!form) return;

  initCatalogSourcePicker();
  initAutoSlug();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('providerFormStatus');
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      payload.enabled = formData.get('enabled') === '1';

      const id = String(payload.id ?? '').trim();
      delete payload.id;

      if (!payload.api_key) {
        delete payload.api_key;
      }

      const isEdit = Boolean(id);
      const url = isEdit ? `/api/providers/${id}` : '/api/providers';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await (window.authFetch || fetch)(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error
          || (Array.isArray(result?.issues) ? result.issues.map((i) => i.message).join('\n') : null)
          || 'Не удалось сохранить провайдера';
        showStatus(status, message, true);
        return;
      }

      window.location.href = '/admin/providers';
    } catch {
      showStatus(status, 'Не удалось сохранить провайдера', true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initProvidersList();
  initProviderForm();
});
