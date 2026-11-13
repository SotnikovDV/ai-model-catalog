function showStatus(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.hidden = false;
  element.classList.remove('form-status--success', 'form-status--error');
  element.classList.add(isError ? 'form-status--error' : 'form-status--success');
}

async function deleteList(id, name) {
  if (!confirm(`Удалить список «${name}»?`)) return;

  const response = await (window.authFetch || fetch)(`/api/lists/${id}`, { method: 'DELETE' });
  if (response.status === 204) {
    const card = document.querySelector(`.provider-card[data-list-id="${id}"]`);
    card?.remove();

    const grid = document.getElementById('listsGrid');
    const remaining = grid?.querySelectorAll('.provider-card').length ?? 0;
    if (remaining === 0) {
      window.location.reload();
      return;
    }

    showStatus(document.getElementById('listsStatus'), 'Список удалён');
    return;
  }

  const payload = await response.json().catch(() => null);
  showStatus(document.getElementById('listsStatus'), payload?.error || 'Не удалось удалить список', true);
}

function initListsSearch() {
  const input = document.getElementById('listsSearch');
  const grid = document.getElementById('listsGrid');
  const searchEmpty = document.getElementById('listsSearchEmpty');
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

function initListsList() {
  document.querySelectorAll('[data-delete-list]').forEach((button) => {
    button.addEventListener('click', () => {
      void deleteList(button.dataset.deleteList, button.dataset.listName);
    });
  });
  initListsSearch();
}

function initListForm() {
  const form = document.getElementById('listForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = document.getElementById('listFormStatus');
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const formData = new FormData(form);
      const id = String(formData.get('id') ?? '').trim();
      const payload = {
        name: String(formData.get('name') ?? '').trim(),
        description: String(formData.get('description') ?? '').trim(),
      };

      const isEdit = Boolean(id);
      const url = isEdit ? `/api/lists/${id}` : '/api/lists';
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
          || 'Не удалось сохранить список';
        showStatus(status, message, true);
        return;
      }

      const savedId = result?.data?.id || id;
      window.location.href = `/admin/lists/${savedId}/edit`;
    } catch {
      showStatus(status, 'Не удалось сохранить список', true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function initListItemsEditor() {
  const section = document.getElementById('listItemsSection');
  if (!section) return;
  const listId = section.dataset.listId;
  if (!listId) return;

  section.querySelectorAll('[data-save-comment]').forEach((button) => {
    button.addEventListener('click', async () => {
      const modelId = button.dataset.saveComment;
      const row = button.closest('.list-item-row');
      const textarea = row?.querySelector('.list-item-comment');
      const status = row?.querySelector('.list-item-status');
      if (!textarea) return;

      button.disabled = true;
      try {
        const response = await (window.authFetch || fetch)(`/api/lists/${listId}/items/${modelId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: textarea.value }),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          showStatus(status, payload?.error || 'Не удалось сохранить комментарий', true);
          return;
        }
        showStatus(status, 'Комментарий сохранён');
      } catch {
        showStatus(status, 'Не удалось сохранить комментарий', true);
      } finally {
        button.disabled = false;
      }
    });
  });

  section.querySelectorAll('[data-remove-item]').forEach((button) => {
    button.addEventListener('click', async () => {
      const modelId = button.dataset.removeItem;
      const name = button.dataset.modelName || modelId;
      if (!confirm(`Убрать «${name}» из списка?`)) return;

      button.disabled = true;
      try {
        const response = await (window.authFetch || fetch)(`/api/lists/${listId}/items/${modelId}`, {
          method: 'DELETE',
        });
        if (response.status === 204) {
          button.closest('.list-item-row')?.remove();
          const table = document.getElementById('listItemsTable');
          if (table && !table.querySelector('.list-item-row')) {
            window.location.reload();
          }
          return;
        }
        const payload = await response.json().catch(() => null);
        alert(payload?.error || 'Не удалось удалить модель из списка');
      } catch {
        alert('Не удалось удалить модель из списка');
      } finally {
        button.disabled = false;
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initListsList();
  initListForm();
  initListItemsEditor();
});
