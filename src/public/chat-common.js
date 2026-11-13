(function initChatCommon() {
  const CARD_EYE_ICON = '<svg class="card-hidden-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  const CARD_EYE_OFF_ICON = '<svg class="card-hidden-btn-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
  const CHAT_COPY_ICON = '<svg class="chat-message-action-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
  const CHAT_EDIT_ICON = '<svg class="chat-message-action-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
  const CHAT_REPEAT_ICON = '<svg class="chat-message-action-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
  const CHAT_SAVE_MD_ICON = '<svg class="chat-message-action-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/></svg>';
  const CHAT_COMMENT_ICON = '<svg class="chat-message-action-icon" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

  function escHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatMessageContent(content, role) {
    if ((role === 'assistant' || role === 'user') && typeof window.formatMarkdownContent === 'function') {
      return window.formatMarkdownContent(content);
    }
    if (typeof window.formatPlainContent === 'function') {
      return window.formatPlainContent(content);
    }
    return escHtml(content).replace(/\n/g, '<br>');
  }

  function getChatPricing(message) {
    if (message?.pricing) return message.pricing;
    return window.CHAT_MODEL || window.ASSISTANT_META || null;
  }

  function formatNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('ru-RU') : '—';
  }

  function formatDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return `${Math.round(ms)} мс`;
    return `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2)} с`;
  }

  function formatMoney(value) {
    if (!Number.isFinite(value)) return '—';
    return `${value.toLocaleString('ru-RU', {
      minimumFractionDigits: value < 1 ? 4 : 2,
      maximumFractionDigits: value < 1 ? 4 : 2,
    })} ₽`;
  }

  function calculateUsageCost(usage, message) {
    const pricing = getChatPricing(message);
    if (!usage || !pricing) return null;

    const inputRate = Number(pricing.inputPricePerMTok);
    const outputRate = Number(pricing.outputPricePerMTok);
    const promptTokens = Number(usage.promptTokens);
    const completionTokens = Number(usage.completionTokens);

    if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) return null;

    const promptCost = Number.isFinite(promptTokens) ? (promptTokens / 1_000_000) * inputRate : 0;
    const completionCost = Number.isFinite(completionTokens) ? (completionTokens / 1_000_000) * outputRate : 0;
    return promptCost + completionCost;
  }

  function buildMessageStats(message) {
    if (message.role !== 'assistant') return '';

    const stats = [];
    if (message.elapsedMs != null) {
      stats.push(`<span>Время: <strong>${escHtml(formatDuration(message.elapsedMs))}</strong></span>`);
    }
    if (message.usage?.totalTokens != null) {
      stats.push(`<span>Токены: <strong>${escHtml(formatNumber(message.usage.totalTokens))}</strong></span>`);
    }

    const cost = calculateUsageCost(message.usage, message);
    if (cost != null) {
      stats.push(`<span>Стоимость: <strong>${escHtml(formatMoney(cost))}</strong></span>`);
    }

    if (!stats.length) return '';
    return `<div class="chat-message-stats">${stats.join('')}</div>`;
  }

  function buildCopySaveActions() {
    const copyBtn = `<button type="button" class="chat-message-action-btn" data-action="copy" title="Копировать" aria-label="Копировать">${CHAT_COPY_ICON}</button>`;
    const saveBtn = `<button type="button" class="chat-message-action-btn" data-action="save-md" title="Сохранить в MD" aria-label="Сохранить в MD">${CHAT_SAVE_MD_ICON}</button>`;
    return `<div class="chat-message-actions">${copyBtn}${saveBtn}</div>`;
  }

  function buildUserMessageActions() {
    const editBtn = `<button type="button" class="chat-message-action-btn" data-action="edit" title="Редактировать запрос" aria-label="Редактировать запрос">${CHAT_EDIT_ICON}</button>`;
    const repeatBtn = `<button type="button" class="chat-message-action-btn" data-action="repeat" title="Повторить запрос" aria-label="Повторить запрос">${CHAT_REPEAT_ICON}</button>`;
    const copyBtn = `<button type="button" class="chat-message-action-btn" data-action="copy" title="Копировать запрос" aria-label="Копировать запрос">${CHAT_COPY_ICON}</button>`;
    return `<div class="chat-message-actions">${editBtn}${repeatBtn}${copyBtn}</div>`;
  }

  function buildMessageActions(message) {
    if (message.role === 'assistant') {
      return buildCopySaveActions();
    }
    return buildUserMessageActions();
  }

  function buildMessageReasoningHtml(message) {
    const reasoning = typeof message.reasoning === 'string' ? message.reasoning.trim() : '';
    if (!reasoning) return '';
    const plain = reasoning.replace(/\s+/g, ' ');
    return `<div class="chat-reasoning-line" title="${escHtml(plain)}"><span class="chat-reasoning-label">Рассуждение</span><span class="chat-reasoning-text">${escHtml(plain)}</span></div>`;
  }

  function getMessageAttachments(message) {
    return Array.isArray(message?.attachments) ? message.attachments : [];
  }

  function buildMessageAttachmentsHtml(message) {
    const attachments = getMessageAttachments(message);
    if (!attachments.length) return '';
    const chips = attachments
      .map((item) => {
        const name = String(item?.name || 'файл').trim() || 'файл';
        return `<span class="chat-attachment-chip chat-attachment-chip--static" title="${escHtml(name)}"><span class="chat-attachment-chip-name">${escHtml(name)}</span></span>`;
      })
      .join('');
    return `<div class="chat-message-attachments" aria-label="Прикреплённые файлы">${chips}</div>`;
  }

  function buildMessageHtml(message) {
    const roleLabel = message.role === 'user' ? 'Вы' : 'Ассистент';
    const text = String(message.content ?? '').trim();
    const contentHtml = text
      ? `<div class="chat-message-content chat-message-content--markdown">${formatMessageContent(message.content, message.role)}</div>`
      : '';
    return `
      <div class="chat-message-header">
        <div class="chat-message-role">${roleLabel}</div>
        ${buildMessageActions(message)}
      </div>
      ${buildMessageReasoningHtml(message)}
      ${contentHtml}
      ${buildMessageAttachmentsHtml(message)}
      ${buildMessageStats(message)}
    `;
  }

  function buildMessageRatingHtml(message) {
    if (message.role !== 'assistant' || !message.responseId) return '';

    const activeScore = Number(message.rating?.score) || 0;
    const stars = [1, 2, 3, 4, 5].map((score) => {
      const isActive = score <= activeScore;
      const glyph = isActive ? '★' : '☆';
      const activeClass = isActive ? ' is-active' : '';
      return `<button type="button" class="chat-rating-star${activeClass}" data-score="${score}" aria-label="Оценка ${score} из 5" title="Оценка ${score} из 5">${glyph}</button>`;
    }).join('');

    const comment = escHtml(message.rating?.comment ?? '');

    return `
      <div class="chat-message-rating" data-rating-root>
        <div class="chat-message-rating-row">
          <div class="chat-rating-stars" role="group" aria-label="Оценка ответа">${stars}</div>
          <button type="button" class="chat-message-action-btn chat-rating-comment-btn" data-action="toggle-comment" title="Комментарий" aria-label="Комментарий">${CHAT_COMMENT_ICON}</button>
        </div>
        <div class="chat-rating-comment" hidden>
          <textarea class="chat-rating-comment-input" rows="3" maxlength="5000" placeholder="Комментарий к ответу…" aria-label="Комментарий к ответу">${comment}</textarea>
          <button type="button" class="btn btn-secondary chat-rating-comment-save" data-action="save-comment">Сохранить</button>
        </div>
        <div class="chat-rating-feedback" hidden role="status"></div>
        <div class="chat-rating-error" hidden role="alert"></div>
      </div>
    `;
  }

  function updateRatingStars(ratingEl, score) {
    const stars = ratingEl.querySelectorAll('.chat-rating-star');
    stars.forEach((star) => {
      const starScore = Number(star.dataset.score);
      const isActive = starScore <= score;
      star.classList.toggle('is-active', isActive);
      star.textContent = isActive ? '★' : '☆';
    });
  }

  function setRatingFeedback(ratingEl, message, isError = false) {
    const feedbackEl = ratingEl.querySelector('.chat-rating-feedback');
    const errorEl = ratingEl.querySelector('.chat-rating-error');
    if (!feedbackEl || !errorEl) return;

    if (isError) {
      feedbackEl.hidden = true;
      errorEl.hidden = false;
      errorEl.textContent = message;
      return;
    }

    errorEl.hidden = true;
    if (!message) {
      feedbackEl.hidden = true;
      feedbackEl.textContent = '';
      return;
    }

    feedbackEl.hidden = false;
    feedbackEl.textContent = message;
  }

  async function saveMessageRating(modelId, message, score, comment, ratingEl) {
    if (!modelId || !message.responseId) {
      setRatingFeedback(ratingEl, 'Не удалось сохранить оценку.', true);
      return false;
    }

    setRatingFeedback(ratingEl, '');

    try {
      const response = await fetch(`/api/models/${modelId}/ratings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          responseId: message.responseId,
          responseContent: String(message.content ?? ''),
          score,
          comment: comment ?? '',
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const errorMessage = payload?.error
          || (Array.isArray(payload?.issues) ? payload.issues.map((issue) => issue.message).join(', ') : null)
          || 'Не удалось сохранить оценку';
        setRatingFeedback(ratingEl, errorMessage, true);
        return false;
      }

      const data = payload?.data;
      if (!data) {
        setRatingFeedback(ratingEl, 'Не удалось сохранить оценку.', true);
        return false;
      }

      message.rating = {
        id: data.id,
        score: data.score,
        comment: data.comment ?? '',
      };
      updateRatingStars(ratingEl, data.score);
      setRatingFeedback(ratingEl, 'Оценка сохранена');
      return true;
    } catch {
      setRatingFeedback(ratingEl, 'Сетевая ошибка при сохранении оценки.', true);
      return false;
    }
  }

  function attachMessageRating(messageEl, message, options = {}) {
    if (message.role !== 'assistant' || !message.responseId) return;

    const ratingEl = messageEl.querySelector('[data-rating-root]');
    if (!ratingEl) return;

    const modelId = options.modelId;
    let pendingScore = Number(message.rating?.score) || 0;
    let isSaving = false;

    ratingEl.addEventListener('click', async (event) => {
      const starBtn = event.target.closest('.chat-rating-star');
      if (starBtn) {
        if (isSaving) return;
        const score = Number(starBtn.dataset.score);
        if (!Number.isFinite(score) || score < 1 || score > 5) return;

        const commentInput = ratingEl.querySelector('.chat-rating-comment-input');
        const comment = commentInput?.value?.trim() ?? message.rating?.comment ?? '';

        isSaving = true;
        updateRatingStars(ratingEl, score);
        const saved = await saveMessageRating(modelId, message, score, comment, ratingEl);
        if (saved) {
          pendingScore = score;
        } else if (pendingScore > 0) {
          updateRatingStars(ratingEl, pendingScore);
        } else {
          updateRatingStars(ratingEl, 0);
        }
        isSaving = false;
        return;
      }

      const toggleBtn = event.target.closest('[data-action="toggle-comment"]');
      if (toggleBtn) {
        const commentSection = ratingEl.querySelector('.chat-rating-comment');
        if (!commentSection) return;
        const willOpen = commentSection.hidden;
        commentSection.hidden = !willOpen;
        toggleBtn.classList.toggle('chat-rating-comment-btn--open', willOpen);
        if (willOpen) {
          const commentInput = ratingEl.querySelector('.chat-rating-comment-input');
          commentInput?.focus();
        }
        return;
      }

      const saveBtn = event.target.closest('[data-action="save-comment"]');
      if (saveBtn) {
        if (isSaving) return;

        const score = Number(message.rating?.score) || pendingScore;
        if (!score || score < 1 || score > 5) {
          setRatingFeedback(ratingEl, 'Сначала выберите оценку звёздами.', true);
          return;
        }

        const commentInput = ratingEl.querySelector('.chat-rating-comment-input');
        const comment = commentInput?.value?.trim() ?? '';

        isSaving = true;
        const saved = await saveMessageRating(modelId, message, score, comment, ratingEl);
        if (saved) {
          pendingScore = score;
          showActionFeedback(saveBtn, 'Сохранено');
        }
        isSaving = false;
      }
    });
  }

  function sanitizeFilenamePart(value) {
    return String(value ?? 'chat')
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
      .replace(/\s+/g, '-')
      .slice(0, 60) || 'chat';
  }

  function buildExportFilename(prefix) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    return `${sanitizeFilenamePart(prefix)}-${stamp}.md`;
  }

  async function copyToClipboard(text) {
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

  function downloadMarkdown(content, filename) {
    const blob = new Blob([String(content ?? '')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function showActionFeedback(button, label) {
    if (!button) return;
    const originalTitle = button.title;
    const originalAria = button.getAttribute('aria-label');
    button.title = label;
    button.setAttribute('aria-label', label);
    button.disabled = true;
    button.classList.add('chat-message-action-btn--done');
    window.setTimeout(() => {
      button.title = originalTitle;
      button.setAttribute('aria-label', originalAria);
      button.disabled = false;
      button.classList.remove('chat-message-action-btn--done');
    }, 1500);
  }

  function attachContentActions(containerEl, getText, options = {}) {
    const actionsEl = containerEl.querySelector('.chat-message-actions');
    if (!actionsEl) return;

    actionsEl.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button) return;

      const text = typeof getText === 'function' ? getText() : String(getText ?? '');
      if (!text) return;

      if (button.dataset.action === 'copy') {
        const copied = await copyToClipboard(text);
        if (copied) showActionFeedback(button, 'Скопировано');
        return;
      }

      if (button.dataset.action === 'save-md') {
        const prefix = options.filePrefix || 'chat-response';
        downloadMarkdown(text, buildExportFilename(prefix));
        showActionFeedback(button, 'Сохранено');
      }
    });
  }

  function attachUserMessageActions(messageEl, message, options = {}) {
    const actionsEl = messageEl.querySelector('.chat-message-actions');
    if (!actionsEl) return;

    actionsEl.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-action]');
      if (!button || button.disabled) return;

      const action = button.dataset.action;
      const text = String(message.content ?? '');

      if (action === 'copy') {
        if (!text) return;
        const copied = await copyToClipboard(text);
        if (copied) showActionFeedback(button, 'Скопировано');
        return;
      }

      if (action === 'edit' && typeof options.onEdit === 'function') {
        options.onEdit(message);
        return;
      }

      if (action === 'repeat' && typeof options.onRepeat === 'function') {
        options.onRepeat(message);
      }
    });
  }

  function attachMessageActions(messageEl, message, options = {}) {
    if (message.role === 'user') {
      attachUserMessageActions(messageEl, message, options);
      return;
    }
    attachContentActions(messageEl, () => String(message.content ?? ''), options);
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

  function createMessageEditController(cancelButtonId) {
    let snapshot = null;

    function setCancelVisible(visible) {
      if (!cancelButtonId) return;
      const btn = document.getElementById(cancelButtonId);
      if (btn) btn.hidden = !visible;
    }

    return {
      begin(data) {
        if (snapshot) return;
        snapshot = data;
        setCancelVisible(true);
      },
      cancel(onRestore) {
        if (!snapshot) return false;
        const data = snapshot;
        snapshot = null;
        setCancelVisible(false);
        if (typeof onRestore === 'function') onRestore(data);
        return true;
      },
      commit() {
        snapshot = null;
        setCancelVisible(false);
      },
      hasPending() {
        return snapshot !== null;
      },
    };
  }

  const ATTACH_MAX_FILES = 3;
  const ATTACH_MAX_BYTES = 200 * 1024;
  const ATTACH_ALLOWED_EXT = new Set(['.txt', '.md', '.json']);
  const ATTACH_ALLOWED_MIME = new Set([
    'text/plain',
    'text/markdown',
    'application/json',
    'application/octet-stream',
    '',
  ]);

  function getFileExtension(name) {
    const base = String(name || '').trim();
    const dot = base.lastIndexOf('.');
    if (dot < 0) return '';
    return base.slice(dot).toLowerCase();
  }

  function isAllowedAttachmentFile(file) {
    if (!file || typeof file.name !== 'string') return false;
    const ext = getFileExtension(file.name);
    if (!ATTACH_ALLOWED_EXT.has(ext)) return false;
    const mime = String(file.type || '').toLowerCase();
    if (mime && !ATTACH_ALLOWED_MIME.has(mime) && !mime.startsWith('text/')) {
      return false;
    }
    return true;
  }

  async function readTextAttachments(fileList) {
    const files = Array.from(fileList || []).filter(Boolean);
    if (files.length === 0) {
      return { attachments: [], error: null };
    }
    if (files.length > ATTACH_MAX_FILES) {
      return {
        attachments: [],
        error: `Можно прикрепить не более ${ATTACH_MAX_FILES} файлов за раз.`,
      };
    }

    const attachments = [];
    for (const file of files) {
      if (!isAllowedAttachmentFile(file)) {
        return {
          attachments: [],
          error: `Файл «${file.name}» не поддерживается. Допустимы: .txt, .md, .json.`,
        };
      }
      if (file.size > ATTACH_MAX_BYTES) {
        return {
          attachments: [],
          error: `Файл «${file.name}» слишком большой (макс. 200 КБ).`,
        };
      }
      if (file.size === 0) {
        return {
          attachments: [],
          error: `Файл «${file.name}» пустой.`,
        };
      }

      let text;
      try {
        text = await file.text();
      } catch {
        return {
          attachments: [],
          error: `Не удалось прочитать файл «${file.name}».`,
        };
      }

      const normalized = String(text ?? '').replace(/^\uFEFF/, '');
      if (!normalized.trim()) {
        return {
          attachments: [],
          error: `Файл «${file.name}» пустой.`,
        };
      }

      attachments.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: file.name,
        text: normalized,
      });
    }

    return { attachments, error: null };
  }

  function formatAttachmentsBlock(attachments) {
    if (!Array.isArray(attachments) || attachments.length === 0) return '';
    return attachments
      .map((item) => `--- файл: ${item.name} ---\n${item.text}`)
      .join('\n\n');
  }

  function composeMessageWithAttachments(userText, attachments) {
    const text = String(userText ?? '').trim();
    const block = formatAttachmentsBlock(attachments);
    if (text && block) return `${text}\n\n${block}`;
    if (block) return block;
    return text;
  }

  function messageContentForApi(message) {
    return composeMessageWithAttachments(
      message?.content,
      getMessageAttachments(message),
    );
  }

  function mountAttachmentUi(options = {}) {
    const form = options.form;
    const actionsLeftEl = options.actionsLeftEl;
    const onError = typeof options.onError === 'function' ? options.onError : null;
    if (!form || !actionsLeftEl) {
      return {
        getAttachments() {
          return [];
        },
        clear() {},
        setAttachments() {},
        setError() {},
        setDisabled() {},
      };
    }

    let attachments = [];

    const chips = document.createElement('div');
    chips.className = 'chat-attachments';
    chips.hidden = true;
    chips.setAttribute('aria-live', 'polite');

    const actions = form.querySelector('.chat-form-actions');
    if (actions) {
      form.insertBefore(chips, actions);
    } else {
      form.appendChild(chips);
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.className = 'chat-attach-input';
    fileInput.accept = '.txt,.md,.json,text/plain,text/markdown,application/json';
    fileInput.multiple = true;
    fileInput.hidden = true;
    fileInput.setAttribute('aria-hidden', 'true');
    fileInput.tabIndex = -1;

    const attachBtn = document.createElement('button');
    attachBtn.type = 'button';
    attachBtn.className = 'btn btn-secondary btn-sm chat-attach-btn';
    attachBtn.textContent = 'Файл';
    attachBtn.title = 'Прикрепить текстовый файл (.txt, .md, .json)';
    attachBtn.setAttribute('aria-label', 'Прикрепить текстовый файл');

    actionsLeftEl.prepend(attachBtn);
    actionsLeftEl.appendChild(fileInput);

    function setError(message) {
      if (onError) onError(message);
    }

    function renderChips() {
      chips.innerHTML = '';
      if (attachments.length === 0) {
        chips.hidden = true;
        return;
      }
      chips.hidden = false;
      attachments.forEach((item) => {
        const chip = document.createElement('span');
        chip.className = 'chat-attachment-chip';
        chip.dataset.id = item.id;

        const label = document.createElement('span');
        label.className = 'chat-attachment-chip-name';
        label.textContent = item.name;
        label.title = item.name;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'chat-attachment-chip-remove';
        removeBtn.setAttribute('aria-label', `Удалить файл ${item.name}`);
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
          attachments = attachments.filter((entry) => entry.id !== item.id);
          renderChips();
        });

        chip.appendChild(label);
        chip.appendChild(removeBtn);
        chips.appendChild(chip);
      });
    }

    function clear() {
      attachments = [];
      fileInput.value = '';
      renderChips();
    }

    function setAttachments(items) {
      attachments = (Array.isArray(items) ? items : [])
        .filter((item) => item && item.name && item.text)
        .slice(0, ATTACH_MAX_FILES)
        .map((item) => ({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          name: String(item.name),
          text: String(item.text),
        }));
      fileInput.value = '';
      renderChips();
    }

    attachBtn.addEventListener('click', () => {
      if (attachBtn.disabled) return;
      fileInput.click();
    });

    fileInput.addEventListener('change', () => {
      void (async () => {
        const selected = Array.from(fileInput.files || []);
        fileInput.value = '';
        if (selected.length === 0) return;

        const remaining = ATTACH_MAX_FILES - attachments.length;
        if (remaining <= 0) {
          setError(`Можно прикрепить не более ${ATTACH_MAX_FILES} файлов.`);
          return;
        }
        if (selected.length > remaining) {
          setError(`Можно прикрепить ещё ${remaining} файл(ов) (макс. ${ATTACH_MAX_FILES}).`);
          return;
        }

        const result = await readTextAttachments(selected);
        if (result.error) {
          setError(result.error);
          return;
        }

        setError('');
        attachments = attachments.concat(result.attachments);
        renderChips();
      })();
    });

    return {
      getAttachments() {
        return attachments.map((item) => ({ name: item.name, text: item.text }));
      },
      clear,
      setAttachments,
      setError,
      setDisabled(disabled) {
        attachBtn.disabled = Boolean(disabled);
        fileInput.disabled = Boolean(disabled);
      },
    };
  }

  window.ChatCommon = {
    escHtml,
    formatMessageContent,
    buildMessageStats,
    buildMessageHtml,
    buildMessageRatingHtml,
    buildCopySaveActions,
    buildUserMessageActions,
    attachContentActions,
    attachUserMessageActions,
    attachMessageActions,
    attachMessageRating,
    updateFavoriteButtonState,
    updateHiddenButtonState,
    createMessageEditController,
    ATTACH_MAX_FILES,
    ATTACH_MAX_BYTES,
    readTextAttachments,
    formatAttachmentsBlock,
    composeMessageWithAttachments,
    messageContentForApi,
    getMessageAttachments,
    downloadMarkdown,
    buildExportFilename,
    mountAttachmentUi,
  };
})();
