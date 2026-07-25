(function initModelChat() {
  const messages = [];
  let isSending = false;
  let waitingTimerId = null;
  let waitingStartedAt = 0;

  const chatCommon = window.ChatCommon || {};
  const buildMessageHtml = chatCommon.buildMessageHtml
    || ((message) => String(message.content ?? ''));
  const buildMessageRatingHtml = chatCommon.buildMessageRatingHtml || (() => '');
  const attachMessageActions = chatCommon.attachMessageActions || (() => {});
  const attachMessageRating = chatCommon.attachMessageRating || (() => {});
  const updateFavoriteButtonState = chatCommon.updateFavoriteButtonState || (() => {});
  const updateHiddenButtonState = chatCommon.updateHiddenButtonState || (() => {});

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

    if (Array.isArray(window.MODELS_DATA)) {
      const index = window.MODELS_DATA.findIndex((item) => item.id === updated.id);
      if (index >= 0) {
        window.MODELS_DATA[index] = { ...window.MODELS_DATA[index], ...updated };
      }
    }
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
      attachMessageActions(div, message, { filePrefix: modelName });
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

  async function sendMessage(text) {
    const model = getChatModel();
    if (!model?.name) {
      setError('Модель чата не определена.');
      return;
    }

    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    isSending = true;
    setError('');

    messages.push({ role: 'user', content: trimmed });
    renderMessages();
    setLoading(true);

    const input = document.getElementById('chatInput');
    if (input) input.value = '';

    try {
      const startedAt = performance.now();
      const body = { messages };
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
        return;
      }

      const reply = payload?.data?.content;
      if (!reply) {
        setError('Модель вернула пустой ответ.');
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
    } catch {
      setError('Сетевая ошибка при отправке сообщения.');
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
    messages.length = 0;
    setError('');
    closeTestMenu();
    renderMessages();
  }

  function initChat() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const clearBtn = document.getElementById('chatClearBtn');
    const hiddenBtn = document.getElementById('chatHiddenBtn');
    const favoriteBtn = document.getElementById('chatFavoriteBtn');

    if (!form || !getChatModel()) return;

    initReasoningToggle();
    initTestMenu();

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
    hiddenBtn?.addEventListener('click', () => {
      void toggleHidden();
    });
    favoriteBtn?.addEventListener('click', () => {
      void toggleFavorite();
    });
    updateHeaderButtons();
    renderMessages();
  }

  document.addEventListener('DOMContentLoaded', initChat);
})();
