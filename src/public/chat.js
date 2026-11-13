(function initModelChat() {
  const messages = [];
  let isSending = false;
  let waitingTimerId = null;
  let waitingStartedAt = 0;
  let availabilityUpgradePromptDismissed = false;
  let availabilityRevokePromptDismissed = false;
  let pendingAvailabilityResponseMs = null;
  let pendingChatErrorMessage = null;

  const chatCommon = window.ChatCommon || {};
  const buildMessageHtml = chatCommon.buildMessageHtml
    || ((message) => String(message.content ?? ''));
  const buildMessageRatingHtml = chatCommon.buildMessageRatingHtml || (() => '');
  const attachMessageActions = chatCommon.attachMessageActions || (() => {});
  const attachMessageRating = chatCommon.attachMessageRating || (() => {});
  const updateFavoriteButtonState = chatCommon.updateFavoriteButtonState || (() => {});
  const updateHiddenButtonState = chatCommon.updateHiddenButtonState || (() => {});
  const createMessageEditController = chatCommon.createMessageEditController
    || (() => ({
      begin: () => {},
      cancel: () => false,
      commit: () => {},
      hasPending: () => false,
    }));
  const composeMessageWithAttachments = chatCommon.composeMessageWithAttachments
    || ((text) => String(text ?? '').trim());
  const messageContentForApi = chatCommon.messageContentForApi
    || ((message) => composeMessageWithAttachments(message?.content, message?.attachments || []));
  const mountAttachmentUi = chatCommon.mountAttachmentUi || (() => ({
    getAttachments: () => [],
    clear: () => {},
    setAttachments: () => {},
    setError: () => {},
    setDisabled: () => {},
  }));

  const messageEdit = createMessageEditController('chatEditCancelBtn');
  let attachmentUi = null;

  function getChatModel() {
    return window.CHAT_MODEL || null;
  }

  function getModelTags(model) {
    if (!model) return [];
    if (Array.isArray(model.tags)) return model.tags;
    return [];
  }

  function modelSupportsReasoningToggle(model) {
    if (!model) return false;
    const tags = getModelTags(model).map((tag) => String(tag).toLowerCase());
    if (tags.includes('include_reasoning') || tags.includes('reasoning') || tags.includes('reasoning_effort')) {
      return true;
    }
    return /thinking|reason/i.test(String(model.name || ''));
  }

  function reasoningStorageKey(modelId) {
    return `chat_reasoning_${modelId}`;
  }

  function getIncludeReasoning() {
    const model = getChatModel();
    if (!modelSupportsReasoningToggle(model)) return undefined;
    const toggle = document.getElementById('chatReasoningToggle');
    if (toggle) return Boolean(toggle.checked);
    return true;
  }

  function initReasoningToggle() {
    const model = getChatModel();
    const wrap = document.getElementById('chatReasoningToggleWrap');
    const toggle = document.getElementById('chatReasoningToggle');
    if (!wrap || !toggle || !model) return;

    const supported = modelSupportsReasoningToggle(model);
    wrap.hidden = !supported;
    if (!supported) return;

    try {
      const saved = localStorage.getItem(reasoningStorageKey(model.id));
      if (saved === '0') toggle.checked = false;
      else if (saved === '1') toggle.checked = true;
    } catch {
      /* ignore */
    }

    toggle.addEventListener('change', () => {
      try {
        localStorage.setItem(reasoningStorageKey(model.id), toggle.checked ? '1' : '0');
      } catch {
        /* ignore */
      }
    });
  }

  async function patchChatModel(fields) {
    const model = getChatModel();
    if (!model?.id) throw new Error('Модель чата не определена.');

    const response = await fetch(`/api/models/${model.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });

    if (!response.ok) throw new Error('Не удалось сохранить модель.');
    const payload = await response.json().catch(() => null);
    return payload?.data || null;
  }

  function syncChatModel(updated) {
    if (!updated || !window.CHAT_MODEL) return;

    window.CHAT_MODEL.isFavorite = Boolean(updated.is_favorite);
    window.CHAT_MODEL.isHidden = Boolean(updated.is_hidden);
    window.CHAT_MODEL.inputPricePerMTok = updated.input_price_per_mtok ?? window.CHAT_MODEL.inputPricePerMTok;
    window.CHAT_MODEL.outputPricePerMTok = updated.output_price_per_mtok ?? window.CHAT_MODEL.outputPricePerMTok;
    window.CHAT_MODEL.availabilityStatus = updated.availability_status ?? null;
    window.CHAT_MODEL.availabilityResponseMs = updated.availability_response_ms ?? null;

    if (Array.isArray(window.MODELS_DATA)) {
      const index = window.MODELS_DATA.findIndex((item) => item.id === updated.id);
      if (index >= 0) {
        window.MODELS_DATA[index] = {
          ...window.MODELS_DATA[index],
          ...updated,
          availability_status: updated.availability_status ?? null,
          availability_response_ms: updated.availability_response_ms ?? null,
          availability_checked_at: updated.availability_checked_at ?? null,
          availability_error: updated.availability_error ?? null,
        };
      }
    }
  }

  function shouldOfferAvailabilityUpdate() {
    const model = getChatModel();
    if (!model || availabilityUpgradePromptDismissed) return false;

    const status = model.availabilityStatus ?? null;
    const responseMs = model.availabilityResponseMs;

    if (status === 'inference' && responseMs != null) return false;
    if (status === 'unavailable') return true;
    if (!status) return true;
    if (responseMs == null) return true;

    return false;
  }

  function modelHasAvailabilityMarksToRevoke() {
    const model = getChatModel();
    if (!model) return false;
    const status = model.availabilityStatus ?? null;
    return status === 'inference' || status === 'available';
  }

  function shouldOfferAvailabilityRevoke() {
    const model = getChatModel();
    if (!model || availabilityRevokePromptDismissed) return false;
    return modelHasAvailabilityMarksToRevoke();
  }

  function hideAvailabilityUpgradePrompt() {
    const promptEl = document.getElementById('chatAvailabilityPrompt');
    if (promptEl) promptEl.hidden = true;
    pendingAvailabilityResponseMs = null;
  }

  function hideAvailabilityRevokePrompt() {
    const promptEl = document.getElementById('chatAvailabilityRevokePrompt');
    if (promptEl) promptEl.hidden = true;
    pendingChatErrorMessage = null;
  }

  function hideAllAvailabilityPrompts() {
    hideAvailabilityUpgradePrompt();
    hideAvailabilityRevokePrompt();
  }

  function showAvailabilityUpgradePrompt() {
    hideAvailabilityRevokePrompt();
    const promptEl = document.getElementById('chatAvailabilityPrompt');
    if (!promptEl) return;
    promptEl.hidden = false;
  }

  function showAvailabilityRevokePrompt() {
    hideAvailabilityUpgradePrompt();
    const model = getChatModel();
    const status = model?.availabilityStatus ?? null;
    const inferenceBtn = document.getElementById('chatAvailabilityRevokeInferenceBtn');
    const availableBtn = document.getElementById('chatAvailabilityRevokeAvailableBtn');
    const textEl = document.getElementById('chatAvailabilityRevokePromptText');

    if (inferenceBtn) {
      inferenceBtn.hidden = status !== 'inference';
    }
    if (availableBtn) {
      availableBtn.hidden = status !== 'inference' && status !== 'available';
    }
    if (textEl) {
      if (status === 'inference') {
        textEl.textContent = 'Запрос в чате не выполнен. Снять отметку «Инференс»? При необходимости можно также отметить модель как «Недоступна».';
      } else if (status === 'available') {
        textEl.textContent = 'Запрос в чате не выполнен. Отметить модель как «Недоступна»?';
      }
    }

    const promptEl = document.getElementById('chatAvailabilityRevokePrompt');
    if (!promptEl) return;
    promptEl.hidden = false;
  }

  function maybeOfferAvailabilityUpdate(responseMs) {
    if (!shouldOfferAvailabilityUpdate()) return;
    pendingAvailabilityResponseMs = Math.max(0, Math.round(responseMs));
    showAvailabilityUpgradePrompt();
  }

  function maybeOfferAvailabilityRevoke(errorMessage) {
    if (!shouldOfferAvailabilityRevoke()) return;
    pendingChatErrorMessage = String(errorMessage || '').trim() || null;
    showAvailabilityRevokePrompt();
  }

  async function applyAvailabilityFromChat() {
    const model = getChatModel();
    if (!model?.id) return;

    const applyBtn = document.getElementById('chatAvailabilityApplyBtn');
    const dismissBtn = document.getElementById('chatAvailabilityDismissBtn');
    if (applyBtn) applyBtn.disabled = true;
    if (dismissBtn) dismissBtn.disabled = true;

    try {
      const checkedAt = new Date().toISOString();
      const responseMs = pendingAvailabilityResponseMs ?? model.availabilityResponseMs ?? null;
      const updated = await patchChatModel({
        availability_status: 'inference',
        availability_checked_at: checkedAt,
        availability_response_ms: responseMs,
        availability_error: null,
      });
      syncChatModel(updated);
      hideAvailabilityUpgradePrompt();
      availabilityUpgradePromptDismissed = true;
    } catch {
      setError('Не удалось обновить отметки доступности.');
    } finally {
      if (applyBtn) applyBtn.disabled = false;
      if (dismissBtn) dismissBtn.disabled = false;
    }
  }

  async function revokeInferenceFromChat() {
    const model = getChatModel();
    if (!model?.id) return;

    const inferenceBtn = document.getElementById('chatAvailabilityRevokeInferenceBtn');
    const availableBtn = document.getElementById('chatAvailabilityRevokeAvailableBtn');
    const dismissBtn = document.getElementById('chatAvailabilityRevokeDismissBtn');
    if (inferenceBtn) inferenceBtn.disabled = true;
    if (availableBtn) availableBtn.disabled = true;
    if (dismissBtn) dismissBtn.disabled = true;

    try {
      const checkedAt = new Date().toISOString();
      const updated = await patchChatModel({
        availability_status: 'available',
        availability_checked_at: checkedAt,
        availability_response_ms: null,
        availability_error: null,
      });
      syncChatModel(updated);
      hideAvailabilityRevokePrompt();
      availabilityRevokePromptDismissed = true;
    } catch {
      setError('Не удалось снять отметку «Инференс».');
    } finally {
      if (inferenceBtn) inferenceBtn.disabled = false;
      if (availableBtn) availableBtn.disabled = false;
      if (dismissBtn) dismissBtn.disabled = false;
    }
  }

  async function revokeAvailabilityFromChat() {
    const model = getChatModel();
    if (!model?.id) return;

    const inferenceBtn = document.getElementById('chatAvailabilityRevokeInferenceBtn');
    const availableBtn = document.getElementById('chatAvailabilityRevokeAvailableBtn');
    const dismissBtn = document.getElementById('chatAvailabilityRevokeDismissBtn');
    if (inferenceBtn) inferenceBtn.disabled = true;
    if (availableBtn) availableBtn.disabled = true;
    if (dismissBtn) dismissBtn.disabled = true;

    try {
      const checkedAt = new Date().toISOString();
      const errorMessage = pendingChatErrorMessage || 'Ошибка при запросе в чате';
      const updated = await patchChatModel({
        availability_status: 'unavailable',
        availability_checked_at: checkedAt,
        availability_response_ms: null,
        availability_error: errorMessage,
      });
      syncChatModel(updated);
      hideAvailabilityRevokePrompt();
      availabilityRevokePromptDismissed = true;
    } catch {
      setError('Не удалось отметить модель как «Недоступна».');
    } finally {
      if (inferenceBtn) inferenceBtn.disabled = false;
      if (availableBtn) availableBtn.disabled = false;
      if (dismissBtn) dismissBtn.disabled = false;
    }
  }

  function dismissAvailabilityUpgradePrompt() {
    availabilityUpgradePromptDismissed = true;
    hideAvailabilityUpgradePrompt();
  }

  function dismissAvailabilityRevokePrompt() {
    availabilityRevokePromptDismissed = true;
    hideAvailabilityRevokePrompt();
  }

  function updateHeaderButtons() {
    const model = getChatModel();
    updateHiddenButtonState(document.getElementById('chatHiddenBtn'), model?.isHidden);
    updateFavoriteButtonState(document.getElementById('chatFavoriteBtn'), model?.isFavorite);
  }

  async function toggleFavorite() {
    const model = getChatModel();
    if (!model) return;

    try {
      const updated = await patchChatModel({ is_favorite: !model.isFavorite });
      syncChatModel(updated);
      updateHeaderButtons();
    } catch {
      setError('Не удалось обновить избранное.');
    }
  }

  async function toggleHidden() {
    const model = getChatModel();
    if (!model) return;
    if (!model.isHidden && !window.confirm(`Скрыть модель «${model.name}» из каталога?`)) return;

    try {
      const updated = await patchChatModel({ is_hidden: !model.isHidden });
      syncChatModel(updated);
      updateHeaderButtons();
    } catch {
      setError('Не удалось обновить признак «Скрытая».');
    }
  }

  function setError(message) {
    const errorEl = document.getElementById('chatError');
    if (!errorEl) return;
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = '';
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  }

  function truncateMessagesFrom(message) {
    const index = messages.indexOf(message);
    if (index < 0) return -1;
    messages.splice(index);
    setError('');
    return index;
  }

  function editUserMessage(message) {
    if (isSending) return;
    messageEdit.begin({
      messages: messages.map((item) => ({ ...item })),
    });
    const index = truncateMessagesFrom(message);
    if (index < 0) {
      messageEdit.commit();
      return;
    }
    renderMessages();
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.value = String(message.content ?? '');
    attachmentUi?.setAttachments(message.attachments || []);
    input.focus();
    const length = input.value.length;
    input.setSelectionRange(length, length);
  }

  function cancelEditUserMessage() {
    if (isSending) return;
    const restored = messageEdit.cancel((snapshot) => {
      messages.length = 0;
      messages.push(...snapshot.messages.map((item) => ({ ...item })));
    });
    if (!restored) return;
    setError('');
    attachmentUi?.clear();
    renderMessages();
    const input = document.getElementById('chatInput');
    if (input) input.value = '';
  }

  function repeatUserMessage(message) {
    if (isSending) return;
    messageEdit.commit();
    const content = String(message.content ?? '').trim();
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    if (!content && attachments.length === 0) return;
    const index = truncateMessagesFrom(message);
    if (index < 0) return;
    renderMessages();
    void sendMessage(content, attachments);
  }

  function getUserMessageActionOptions() {
    return {
      filePrefix: getChatModel()?.name || 'model-chat',
      onEdit: editUserMessage,
      onRepeat: repeatUserMessage,
    };
  }

  function renderMessages() {
    const container = document.getElementById('chatMessages');
    const emptyEl = document.getElementById('chatEmpty');
    if (!container) return;

    if (!messages.length) {
      if (emptyEl) emptyEl.hidden = false;
      container.querySelectorAll('.chat-message').forEach((el) => el.remove());
      return;
    }

    if (emptyEl) emptyEl.hidden = true;

    const existing = container.querySelectorAll('.chat-message');
    existing.forEach((el) => el.remove());

    messages.forEach((message) => {
      const div = document.createElement('div');
      div.className = `chat-message chat-message--${message.role}`;
      const ratingHtml = message.role === 'assistant' ? buildMessageRatingHtml(message) : '';
      div.innerHTML = buildMessageHtml(message) + ratingHtml;
      const modelName = getChatModel()?.name || 'model-chat';
      attachMessageActions(div, message, {
        ...getUserMessageActionOptions(),
        filePrefix: modelName,
      });
      if (message.role === 'assistant') {
        attachMessageRating(div, message, { modelId: getChatModel()?.id });
      }
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }

  function formatWaitingElapsed(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    if (totalSec < 60) return `${totalSec} с`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  function stopWaitingTimer() {
    if (waitingTimerId != null) {
      window.clearInterval(waitingTimerId);
      waitingTimerId = null;
    }
    waitingStartedAt = 0;
  }

  function updateWaitingElapsed() {
    const elapsedEl = document.getElementById('chatWaitingElapsed');
    if (!elapsedEl || !waitingStartedAt) return;
    elapsedEl.textContent = formatWaitingElapsed(performance.now() - waitingStartedAt);
  }

  function setLoading(loading) {
    const container = document.getElementById('chatMessages');
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    const clearBtn = document.getElementById('chatClearBtn');
    const reasoningToggle = document.getElementById('chatReasoningToggle');

    if (sendBtn) sendBtn.disabled = loading;
    if (input) input.disabled = loading;
    if (clearBtn) clearBtn.disabled = loading;
    if (reasoningToggle) reasoningToggle.disabled = loading;
    const testMenuBtn = document.getElementById('chatTestMenuBtn');
    if (testMenuBtn) testMenuBtn.disabled = loading;
    attachmentUi?.setDisabled(loading);
    if (loading) closeTestMenu();

    const existing = container?.querySelector('.chat-message--loading');
    if (existing) existing.remove();
    stopWaitingTimer();

    if (loading && container) {
      waitingStartedAt = performance.now();
      const div = document.createElement('div');
      div.className = 'chat-message chat-message--assistant chat-message--loading';
      div.innerHTML = `
      <div class="chat-message-role">Ассистент</div>
      <div class="chat-waiting" aria-live="polite">
        <span class="chat-waiting-spinner" aria-hidden="true"></span>
        <span class="chat-waiting-label">Ожидание ответа…</span>
        <span class="chat-waiting-elapsed" id="chatWaitingElapsed">0 с</span>
      </div>
      <div class="chat-reasoning-line chat-reasoning-line--pending" id="chatWaitingReasoning" hidden>
        <span class="chat-reasoning-label">Рассуждение</span>
        <span class="chat-reasoning-text" id="chatWaitingReasoningText"></span>
      </div>
    `;
      container.appendChild(div);
      container.scrollTop = container.scrollHeight;
      waitingTimerId = window.setInterval(updateWaitingElapsed, 250);
    }
  }

  /**
   * Однострочный превью reasoning во время ожидания (на будущее для стрима).
   * Сейчас чат без SSE — строка появляется после ответа в пузыре.
   */
  function setWaitingReasoningPreview(text) {
    const line = document.getElementById('chatWaitingReasoning');
    const textEl = document.getElementById('chatWaitingReasoningText');
    if (!line || !textEl) return;
    const plain = String(text || '').replace(/\s+/g, ' ').trim();
    if (!plain) {
      line.hidden = true;
      textEl.textContent = '';
      textEl.removeAttribute('title');
      return;
    }
    line.hidden = false;
    textEl.textContent = plain;
    textEl.title = plain;
  }

  async function sendMessage(text, presetAttachments) {
    const model = getChatModel();
    if (!model?.name) {
      setError('Модель чата не определена.');
      return;
    }

    const displayText = String(text ?? '').trim();
    const attachments = Array.isArray(presetAttachments)
      ? presetAttachments
      : (attachmentUi?.getAttachments() || []);
    const apiContent = composeMessageWithAttachments(displayText, attachments);
    if (!apiContent || isSending) return;

    messageEdit.commit();

    isSending = true;
    setError('');

    const userMessage = { role: 'user', content: displayText };
    if (attachments.length) {
      userMessage.attachments = attachments.map((item) => ({
        name: item.name,
        text: item.text,
      }));
    }
    messages.push(userMessage);
    attachmentUi?.clear();
    renderMessages();
    setLoading(true);

    const input = document.getElementById('chatInput');
    if (input) input.value = '';

    try {
      const startedAt = performance.now();
      const body = {
        messages: messages.map((message) => ({
          role: message.role,
          content: messageContentForApi(message),
        })),
      };
      const includeReasoning = getIncludeReasoning();
      if (includeReasoning !== undefined) {
        body.includeReasoning = includeReasoning;
      }

      const response = await fetch(`/api/models/${model.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.error
          || (Array.isArray(payload?.issues) ? payload.issues.map((i) => i.message).join('\n') : null)
          || 'Не удалось получить ответ от модели';
        setError(message);
        maybeOfferAvailabilityRevoke(message);
        return;
      }

      const reply = payload?.data?.content;
      if (!reply) {
        const message = 'Модель вернула пустой ответ.';
        setError(message);
        maybeOfferAvailabilityRevoke(message);
        return;
      }

      const reasoning = typeof payload?.data?.reasoning === 'string'
        ? payload.data.reasoning.trim()
        : '';

      if (reasoning) setWaitingReasoningPreview(reasoning);

      const elapsedMs = performance.now() - startedAt;
      messages.push({
        role: 'assistant',
        content: reply,
        reasoning: reasoning || null,
        responseId: crypto.randomUUID(),
        rating: null,
        usage: payload?.data?.usage,
        elapsedMs,
      });
      renderMessages();
      maybeOfferAvailabilityUpdate(elapsedMs);
    } catch {
      const message = 'Сетевая ошибка при отправке сообщения.';
      setError(message);
      maybeOfferAvailabilityRevoke(message);
    } finally {
      isSending = false;
      setLoading(false);
    }
  }

  const CHAT_TEST_PROMPTS = {
    logic: `Ответь кратко.
У Петра 5 книг. Он дал другу 2 книги, а потом купил ещё 3.
Сколько книг у Петра сейчас? Объясни в 1–2 предложениях.`,
    facts: `Ответь одним словом.
Столица Швейцарии? Не путай с крупнейшим городом.`,
    json: `Верни строго один JSON-объект без пояснений.
Формат:
{"sum": 12+7, "product": 6*5, "text": "model"}
Никаких лишних ключей, комментариев и текста.`,
    'anti-hallucination': `Ответь кратко.
Кто сейчас президент Марса? Если вопрос некорректен — объясни это в одном предложении.`,
    inference: `Ответь одним предложением.
В 2020 году Иван работал программистом. В 2022 году он стал тимлидом.
Сейчас 2026 год. Кем Иван работает сейчас, если нет информации, что он сменил профессию?`,
  };

  function closeTestMenu() {
    const wrap = document.querySelector('.chat-test-menu-wrap');
    const menu = document.getElementById('chatTestMenu');
    const button = document.getElementById('chatTestMenuBtn');
    if (menu) menu.hidden = true;
    if (button) button.setAttribute('aria-expanded', 'false');
    wrap?.classList.remove('is-open');
  }

  function openTestMenu() {
    const wrap = document.querySelector('.chat-test-menu-wrap');
    const menu = document.getElementById('chatTestMenu');
    const button = document.getElementById('chatTestMenuBtn');
    if (!menu || !button) return;
    menu.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    wrap?.classList.add('is-open');
  }

  function toggleTestMenu() {
    const menu = document.getElementById('chatTestMenu');
    if (!menu) return;
    if (menu.hidden) openTestMenu();
    else closeTestMenu();
  }

  function applyTestPrompt(testId) {
    const prompt = CHAT_TEST_PROMPTS[testId];
    const input = document.getElementById('chatInput');
    if (!prompt || !input || input.disabled) return;
    input.value = prompt;
    input.focus();
    input.setSelectionRange(prompt.length, prompt.length);
    closeTestMenu();
  }

  function initTestMenu() {
    const button = document.getElementById('chatTestMenuBtn');
    const menu = document.getElementById('chatTestMenu');
    if (!button || !menu) return;

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (button.disabled) return;
      toggleTestMenu();
    });

    menu.querySelectorAll('[data-test-id]').forEach((item) => {
      item.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        applyTestPrompt(item.dataset.testId);
      });
    });

    document.addEventListener('click', (event) => {
      if (event.target.closest('.chat-test-menu-wrap')) return;
      closeTestMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeTestMenu();
    });
  }

  function clearChat() {
    if (isSending) return;
    messageEdit.commit();
    messages.length = 0;
    setError('');
    attachmentUi?.clear();
    closeTestMenu();
    renderMessages();
  }

  function initChat() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const clearBtn = document.getElementById('chatClearBtn');
    const cancelEditBtn = document.getElementById('chatEditCancelBtn');
    const hiddenBtn = document.getElementById('chatHiddenBtn');
    const favoriteBtn = document.getElementById('chatFavoriteBtn');
    const actionsLeft = form?.querySelector('.chat-form-actions-left');

    if (!form || !getChatModel()) return;

    attachmentUi = mountAttachmentUi({
      form,
      actionsLeftEl: actionsLeft,
      onError: setError,
    });

    initReasoningToggle();
    initTestMenu();
    initAvailabilityPrompt();

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      closeTestMenu();
      void sendMessage(input?.value || '');
    });

    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        closeTestMenu();
        void sendMessage(input.value || '');
      }
    });

    clearBtn?.addEventListener('click', clearChat);
    cancelEditBtn?.addEventListener('click', cancelEditUserMessage);
    hiddenBtn?.addEventListener('click', () => {
      void toggleHidden();
    });
    favoriteBtn?.addEventListener('click', () => {
      void toggleFavorite();
    });
    updateHeaderButtons();
    renderMessages();
  }

  function initAvailabilityPrompt() {
    const applyBtn = document.getElementById('chatAvailabilityApplyBtn');
    const dismissBtn = document.getElementById('chatAvailabilityDismissBtn');
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        void applyAvailabilityFromChat();
      });
    }
    if (dismissBtn) {
      dismissBtn.addEventListener('click', dismissAvailabilityUpgradePrompt);
    }

    const revokeInferenceBtn = document.getElementById('chatAvailabilityRevokeInferenceBtn');
    const revokeAvailableBtn = document.getElementById('chatAvailabilityRevokeAvailableBtn');
    const revokeDismissBtn = document.getElementById('chatAvailabilityRevokeDismissBtn');
    if (revokeInferenceBtn) {
      revokeInferenceBtn.addEventListener('click', () => {
        void revokeInferenceFromChat();
      });
    }
    if (revokeAvailableBtn) {
      revokeAvailableBtn.addEventListener('click', () => {
        void revokeAvailabilityFromChat();
      });
    }
    if (revokeDismissBtn) {
      revokeDismissBtn.addEventListener('click', dismissAvailabilityRevokePrompt);
    }
  }

  document.addEventListener('DOMContentLoaded', initChat);
})();
