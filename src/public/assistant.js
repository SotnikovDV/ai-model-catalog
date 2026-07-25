const messages = [];

let isSending = false;

let lastResult = null;

let lastToken = null;

let currentChatId = null;

let chatList = [];



const chatCommon = window.ChatCommon || {};

const escHtml = chatCommon.escHtml || ((value) => String(value ?? ''));

const buildMessageHtml = chatCommon.buildMessageHtml

  || ((message) => String(message.content ?? ''));

const attachMessageActions = chatCommon.attachMessageActions || (() => {});

const attachContentActions = chatCommon.attachContentActions || (() => {});

const buildCopySaveActions = chatCommon.buildCopySaveActions || (() => '');



function formatPreviewTokens(value) {

  if (!value) return null;

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



function formatPreviewRequestCost(input = 0, output = 0) {

  const inPrice = Number(input) || 0;

  const outPrice = Number(output) || 0;

  const total = inPrice + outPrice;

  if (total === 0) return '0 ₽';

  return `${total.toLocaleString('ru-RU', {

    minimumFractionDigits: total < 1 ? 2 : 0,

    maximumFractionDigits: total < 1 ? 4 : 2,

  })} ₽`;

}



const PREVIEW_LATENCY_LABELS = {

  1: 'очень медленно',

  2: 'медленно',

  3: 'средне',

  4: 'быстро',

  5: 'мгновенно',

};



function formatPreviewLatency(value) {

  const rating = Math.round(Number(value));

  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;

  return {

    label: `⚡ ${rating}/5`,

    title: `Задержка: ${rating}/5 (${PREVIEW_LATENCY_LABELS[rating]})`,

  };

}



function formatPreviewChatRating(model) {

  if (model.chat_rating_label) {

    return {

      label: model.chat_rating_label,

      title: model.chat_rating_title || '',

    };

  }

  const avg = model.chat_rating_avg;

  const count = model.chat_rating_count;

  if (avg == null || !count) return null;

  const formatted = Number(avg).toFixed(1).replace(/\.0$/, '');

  const countLabel = count === 1 ? '1 оценка' : count < 5 ? `${count} оценки` : `${count} оценок`;

  return {

    label: `★ ${formatted}`,

    title: `Средняя оценка ответов в чате: ${formatted}/5 (${countLabel})`,

  };

}



function buildPreviewMetaBadges(model) {

  if (!model) return '';

  const badges = [];

  if (model.modality) badges.push(model.modality);

  const ctx = formatPreviewTokens(model.context_window);

  if (ctx) badges.push(`${ctx} ctx`);

  const latencyBadge = formatPreviewLatency(model.latency);

  if (latencyBadge) badges.push(latencyBadge);

  const chatRatingBadge = formatPreviewChatRating(model);

  if (chatRatingBadge) badges.push({ ...chatRatingBadge, className: 'chat-rating-badge' });

  const costLabel = formatPreviewRequestCost(model.input_price_per_mtok, model.output_price_per_mtok);

  badges.push({

    label: costLabel,

    title: 'Стоимость 1M входящих + 1M исходящих токенов',

  });

  if (model.supports_web_search) {
    badges.push({
      label: '🌐 Поиск',
      title: 'Встроенный поиск в интернете',
    });
  }

  return badges

    .map((badge) => {

      if (typeof badge === 'string') {

        return `<span class="assistant-preview-meta-badge">${escHtml(badge)}</span>`;

      }

      const titleAttr = badge.title ? ` title="${escHtml(badge.title)}"` : '';

      const className = badge.className ? ` ${badge.className}` : '';

      return `<span class="assistant-preview-meta-badge${className}"${titleAttr}>${escHtml(badge.label)}</span>`;

    })

    .join('');

}



function buildPreviewItemHtml(item) {

  const model = item.model || {};

  const modelId = item.modelId || model.id;

  const name = model.name || item.modelId || '—';

  const safeName = escHtml(name);

  const nameHtml = modelId
    ? `<span class="assistant-preview-title-row"><a href="/models/${escHtml(modelId)}" target="_blank" rel="noopener noreferrer" class="assistant-preview-name">${safeName}</a>${window.CopyModelName?.buttonHtml(name) || ''}</span>`
    : `<span class="assistant-preview-title-row"><strong class="assistant-preview-name">${safeName}</strong>${window.CopyModelName?.buttonHtml(name) || ''}</span>`;

  const metaHtml = buildPreviewMetaBadges(model);



  return `

    <li class="assistant-preview-item">

      <div class="assistant-preview-header">

        <span class="assistant-preview-rank">${item.rank}.</span>

        ${nameHtml}

        ${metaHtml ? `<span class="assistant-preview-meta">${metaHtml}</span>` : ''}

      </div>

      <span class="assistant-preview-rationale">${escHtml(item.rationale)}</span>

    </li>

  `;

}



function setError(message) {

  const errorEl = document.getElementById('assistantError');

  if (!errorEl) return;

  if (!message) {

    errorEl.hidden = true;

    errorEl.textContent = '';

    return;

  }

  errorEl.hidden = false;

  errorEl.textContent = message;

}



function setStatus(message, { html = false } = {}) {

  const statusEl = document.getElementById('assistantStatus');

  if (!statusEl) return;

  if (!message) {

    statusEl.hidden = true;

    statusEl.textContent = '';

    return;

  }

  statusEl.hidden = false;

  if (html) {

    statusEl.innerHTML = message;

  } else {

    statusEl.textContent = message;

  }

}



function setAnalyticsModelStatus(modelName) {

  const modelId = window.ASSISTANT_META?.modelId;

  const safeName = escHtml(modelName);

  if (modelId) {

    const safeId = escHtml(modelId);

    setStatus(

      `Используется аналитическая модель: <a href="/models/${safeId}" target="_blank" rel="noopener noreferrer">${safeName}</a>`,

      { html: true },

    );

    return;

  }

  setStatus(`Используется аналитическая модель: ${modelName}`);

}



function formatChatDate(value) {

  if (!value) return '';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleString('ru-RU', {

    day: '2-digit',

    month: '2-digit',

    hour: '2-digit',

    minute: '2-digit',

  });

}



function updateChatUrl(chatId) {

  const url = new URL(window.location.href);

  if (chatId) {

    url.searchParams.set('chat', chatId);

  } else {

    url.searchParams.delete('chat');

  }

  window.history.replaceState({}, '', url);

}



function restoreRecommendationToken(result) {

  if (!result) {

    lastToken = null;

    return;

  }

  lastToken = window.RecommendationStore?.save(result) || null;

}



function renderChatList() {

  const listEl = document.getElementById('assistantChatList');

  const emptyEl = document.getElementById('assistantChatListEmpty');

  if (!listEl) return;



  listEl.innerHTML = '';



  if (!chatList.length) {

    if (emptyEl) emptyEl.hidden = false;

    return;

  }



  if (emptyEl) emptyEl.hidden = true;



  chatList.forEach((chat) => {

    const item = document.createElement('li');

    item.className = 'assistant-chat-item';

    if (chat.id === currentChatId) {

      item.classList.add('active');

    }



    const button = document.createElement('button');

    button.type = 'button';

    button.className = 'assistant-chat-item-btn';

    button.dataset.chatId = chat.id;

    button.innerHTML = `

      <span class="assistant-chat-item-title">${escHtml(chat.title)}</span>

      <span class="assistant-chat-item-meta">${escHtml(formatChatDate(chat.updatedAt))}</span>

    `;

    button.addEventListener('click', () => {

      void selectChat(chat.id);

    });



    const deleteBtn = document.createElement('button');

    deleteBtn.type = 'button';

    deleteBtn.className = 'assistant-chat-delete-btn';

    deleteBtn.title = 'Удалить чат';

    deleteBtn.setAttribute('aria-label', 'Удалить чат');

    deleteBtn.textContent = '×';

    deleteBtn.addEventListener('click', (event) => {

      event.stopPropagation();

      void deleteChat(chat.id);

    });



    item.append(button, deleteBtn);

    listEl.appendChild(item);

  });

}



async function fetchChatList() {

  try {

    const response = await fetch('/api/ai/chats?limit=50');

    const payload = await response.json().catch(() => null);

    if (!response.ok) return;

    chatList = Array.isArray(payload?.data) ? payload.data : [];

    renderChatList();

  } catch {

    // ignore list errors

  }

}



function applyChatData(chat) {

  messages.length = 0;

  if (Array.isArray(chat.messages)) {

    messages.push(...chat.messages);

  }

  lastResult = chat.lastResult || null;

  restoreRecommendationToken(lastResult);

  currentChatId = chat.id;

  setError('');

  renderMessages();

  renderChatList();

  updateChatUrl(chat.id);

}



async function selectChat(chatId) {

  if (isSending || chatId === currentChatId) return;



  try {

    const response = await fetch(`/api/ai/chats/${encodeURIComponent(chatId)}`);

    const payload = await response.json().catch(() => null);

    if (!response.ok) {

      setError(payload?.error || 'Не удалось загрузить чат');

      return;

    }

    applyChatData(payload.data);

    closeAssistantSidebar();

  } catch {

    setError('Сетевая ошибка при загрузке чата.');

  }

}



async function persistCurrentChat() {

  if (!messages.length) return;



  const body = {

    messages: [...messages],

    lastResult,

  };



  try {

    if (currentChatId) {

      const response = await fetch(`/api/ai/chats/${encodeURIComponent(currentChatId)}`, {

        method: 'PUT',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(body),

      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) return;

      const updated = payload?.data;

      if (updated?.id) {

        currentChatId = updated.id;

        const index = chatList.findIndex((chat) => chat.id === updated.id);

        const listItem = {

          id: updated.id,

          title: updated.title,

          messageCount: updated.messages?.length ?? messages.length,

          createdAt: updated.createdAt,

          updatedAt: updated.updatedAt,

        };

        if (index >= 0) {

          chatList[index] = listItem;

        } else {

          chatList.unshift(listItem);

        }

        chatList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

        renderChatList();

        updateChatUrl(currentChatId);

      }

      return;

    }



    const response = await fetch('/api/ai/chats', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify(body),

    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) return;

    const created = payload?.data;

    if (!created?.id) return;

    currentChatId = created.id;

    chatList.unshift({

      id: created.id,

      title: created.title,

      messageCount: created.messages?.length ?? messages.length,

      createdAt: created.createdAt,

      updatedAt: created.updatedAt,

    });

    renderChatList();

    updateChatUrl(currentChatId);

  } catch {

    // ignore persistence errors

  }

}



async function deleteChat(chatId) {

  if (isSending) return;

  if (!window.confirm('Удалить этот чат?')) return;



  try {

    const response = await fetch(`/api/ai/chats/${encodeURIComponent(chatId)}`, {

      method: 'DELETE',

    });

    if (response.status !== 204 && !response.ok) {

      const payload = await response.json().catch(() => null);

      setError(payload?.error || 'Не удалось удалить чат');

      return;

    }



    chatList = chatList.filter((chat) => chat.id !== chatId);

    if (currentChatId === chatId) {

      startNewChat(false);

    } else {

      renderChatList();

    }

  } catch {

    setError('Сетевая ошибка при удалении чата.');

  }

}



function renderMessages() {

  const container = document.getElementById('assistantMessages');

  const emptyEl = document.getElementById('assistantEmpty');

  if (!container) return;



  if (!messages.length) {

    if (emptyEl) emptyEl.hidden = false;

    container.querySelectorAll('.chat-message, .assistant-result-block').forEach((el) => el.remove());

    return;

  }



  if (emptyEl) emptyEl.hidden = true;



  container.querySelectorAll('.chat-message, .assistant-result-block').forEach((el) => el.remove());



  messages.forEach((message) => {

    const div = document.createElement('div');

    div.className = `chat-message chat-message--${message.role}`;

    div.innerHTML = buildMessageHtml(message);

    attachMessageActions(div, message, { filePrefix: 'assistant-response' });

    container.appendChild(div);

  });



  if (lastResult && lastToken) {

    container.appendChild(buildResultBlock(lastResult, lastToken));

  }



  container.scrollTop = container.scrollHeight;

}



function formatResultAsMarkdown(result) {

  const lines = ['# Результаты подбора', ''];

  if (result.query) {

    lines.push(`**Запрос:** ${result.query}`, '');

  }

  if (result.summary) {

    lines.push(result.summary, '');

  }

  lines.push('## Модели', '');

  for (const item of result.items || []) {

    const model = item.model || {};

    const name = model.name || item.modelId || '—';

    const modelId = item.modelId || model.id;

    lines.push(`### ${item.rank}. ${name}`);

    if (modelId) {

      lines.push(`[Карточка модели](/models/${modelId})`);

    }

    const ctx = formatPreviewTokens(model.context_window);

    const latencyBadge = formatPreviewLatency(model.latency);

    const meta = [

      model.modality,

      ctx ? `${ctx} ctx` : null,

      latencyBadge?.label ?? null,

      formatPreviewRequestCost(model.input_price_per_mtok, model.output_price_per_mtok),

    ].filter(Boolean);

    if (meta.length) {

      lines.push(`_${meta.join(' · ')}_`);

    }

    lines.push('');

    if (item.rationale) {

      lines.push(item.rationale, '');

    }

  }

  return lines.join('\n').trim();

}



function goToCompareWithRecommendation(result) {

  const ids = (result.items || [])

    .map((item) => item.modelId || item.model?.id)

    .filter(Boolean);

  if (!ids.length) return;

  if (window.CompareBuffer) {

    window.CompareBuffer.setIds(ids);

    window.location.href = window.CompareBuffer.getUrl();

    return;

  }

  window.location.href = `/compare?ids=${ids.map(encodeURIComponent).join(',')}`;

}



function buildResultBlock(result, token) {

  const div = document.createElement('div');

  div.className = 'assistant-result-block page-card';



  const previewItems = (result.items || []).slice(0, 5);

  const previewHtml = previewItems.map((item) => buildPreviewItemHtml(item)).join('');



  const catalogUrl = window.RecommendationStore?.getCatalogUrl(token) || `/?rec=${encodeURIComponent(token)}&view=cards`;

  const recUrl = window.RecommendationStore?.getRecommendationsUrl(token) || `/recommendations?rec=${encodeURIComponent(token)}`;



  div.innerHTML = `

    <div class="assistant-result-header">

      <h3 class="assistant-result-title">Результаты подбора</h3>

      ${buildCopySaveActions()}

    </div>

    <p class="assistant-result-summary">${escHtml(result.summary || '')}</p>

    <ul class="assistant-preview-list">${previewHtml}</ul>

    ${result.items?.length > 5 ? `<p class="assistant-preview-more muted">и ещё ${result.items.length - 5} моделей…</p>` : ''}

    <div class="assistant-result-actions">

      <a href="${escHtml(catalogUrl)}" class="btn btn-primary">Показать карточками</a>

      <a href="${escHtml(recUrl)}" class="btn btn-secondary">С комментариями</a>

      <button type="button" class="btn btn-secondary assistant-compare-btn">Сравнить модели</button>

    </div>

  `;

  const compareBtn = div.querySelector('.assistant-compare-btn');

  if (compareBtn) {

    compareBtn.addEventListener('click', () => goToCompareWithRecommendation(result));

  }

  attachContentActions(div, () => formatResultAsMarkdown(result), { filePrefix: 'assistant-recommendations' });

  window.CopyModelName?.bindAll(div);

  return div;

}



function setLoading(loading) {

  const container = document.getElementById('assistantMessages');

  const sendBtn = document.getElementById('assistantSendBtn');

  const input = document.getElementById('assistantInput');



  if (sendBtn) sendBtn.disabled = loading;

  if (input) input.disabled = loading;



  const existing = container?.querySelector('.chat-message--loading');

  if (existing) existing.remove();



  if (loading && container) {

    const div = document.createElement('div');

    div.className = 'chat-message chat-message--assistant chat-message--loading';

    div.innerHTML = `

      <div class="chat-message-role">Ассистент</div>

      <div class="chat-message-content"><span class="chat-typing">Подбираю модели…</span></div>

    `;

    container.appendChild(div);

    container.scrollTop = container.scrollHeight;

  }

}



async function sendQuery(text) {

  const trimmed = text.trim();

  if (!trimmed || isSending) return;



  isSending = true;

  setError('');

  setLoading(true);

  lastResult = null;

  lastToken = null;



  messages.push({ role: 'user', content: trimmed });

  renderMessages();



  const input = document.getElementById('assistantInput');

  if (input) input.value = '';



  let hadSuccessfulResult = false;



  try {

    const startedAt = performance.now();

    const response = await fetch('/api/ai/recommend', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({ query: trimmed, limit: 8 }),

    });



    const payload = await response.json().catch(() => null);



    if (!response.ok) {

      const message = payload?.error

        || (Array.isArray(payload?.issues) ? payload.issues.map((i) => i.message).join('\n') : null)

        || 'Не удалось подобрать модели';

      setError(message);

      await persistCurrentChat();

      return;

    }



    const result = payload?.data;

    if (!result?.items?.length) {

      setError('AI не нашёл подходящих моделей. Попробуйте переформулировать запрос.');

      await persistCurrentChat();

      return;

    }



    lastResult = result;

    lastToken = window.RecommendationStore?.save(result) || null;

    hadSuccessfulResult = true;



    const reply = result.summary

      || `Подобрано ${result.items.length} моделей. Выберите способ отображения ниже.`;

    const elapsedMs = performance.now() - startedAt;

    messages.push({

      role: 'assistant',

      content: reply,

      usage: result.meta?.usage,

      elapsedMs,

    });

    renderMessages();

  } catch {

    setError('Сетевая ошибка при отправке запроса.');

    await persistCurrentChat();

  } finally {

    isSending = false;

    setLoading(false);

    if (hadSuccessfulResult) {

      await persistCurrentChat();

    }

  }

}



function startNewChat(updateUrl = true) {

  if (isSending) return;

  messages.length = 0;

  lastResult = null;

  lastToken = null;

  currentChatId = null;

  setError('');

  renderMessages();

  renderChatList();

  if (updateUrl) {

    updateChatUrl(null);

  }

}



function clearAssistant() {

  startNewChat(true);

}



function closeAssistantSidebar() {

  const sidebar = document.getElementById('assistantSidebar');

  const overlay = document.getElementById('assistantSidebarOverlay');

  sidebar?.classList.remove('is-open');

  overlay?.classList.remove('visible');

  if (!document.getElementById('mobileMenu')?.classList.contains('is-open')) {

    document.body.style.overflow = '';

  }

}



function initAssistantSidebar() {

  const sidebar = document.getElementById('assistantSidebar');

  const overlay = document.getElementById('assistantSidebarOverlay');

  const openBtn = document.getElementById('assistantSidebarOpenBtn');

  const closeBtn = document.getElementById('assistantSidebarCloseBtn');



  if (!sidebar || !overlay) return;



  const setOpen = (isOpen) => {

    sidebar.classList.toggle('is-open', isOpen);

    overlay.classList.toggle('visible', isOpen);

    if (!isOpen && !document.getElementById('mobileMenu')?.classList.contains('is-open')) {

      document.body.style.overflow = '';

    }

    if (isOpen) document.body.style.overflow = 'hidden';

  };



  openBtn?.addEventListener('click', () => {

    if (typeof window.closeMobileMenu === 'function') {

      window.closeMobileMenu();

    }

    setOpen(true);

  });

  closeBtn?.addEventListener('click', () => setOpen(false));

  overlay.addEventListener('click', () => setOpen(false));

  document.addEventListener('keydown', (event) => {

    if (event.key === 'Escape' && sidebar.classList.contains('is-open')) {

      setOpen(false);

    }

  });

}



async function loadAiStatus() {

  try {

    const response = await fetch('/api/ai/config');

    const payload = await response.json().catch(() => null);

    const config = payload?.data;

    if (!config?.enabled || !config?.configured) {

      setStatus('AI-провайдер не настроен. Настройте его в разделе «Админ».');

      const sendBtn = document.getElementById('assistantSendBtn');

      const input = document.getElementById('assistantInput');

      if (sendBtn) sendBtn.disabled = true;

      if (input) input.disabled = true;

      return;

    }

    setAnalyticsModelStatus(config.modelAnalytics);

  } catch {

    setStatus('Не удалось проверить настройки AI-провайдера.');

  }

}



async function initAssistant() {

  const form = document.getElementById('assistantForm');

  const input = document.getElementById('assistantInput');

  const clearBtn = document.getElementById('assistantClearBtn');

  const newChatBtn = document.getElementById('assistantNewChatBtn');



  if (!form) return;



  initAssistantSidebar();

  void loadAiStatus();

  await fetchChatList();



  const params = new URLSearchParams(window.location.search);

  const chatId = params.get('chat');

  if (chatId) {

    await selectChat(chatId);

  } else {

    const prefill = params.get('q');

    if (prefill && input) {

      input.value = prefill;

    }

  }



  form.addEventListener('submit', (event) => {

    event.preventDefault();

    void sendQuery(input?.value || '');

  });



  input?.addEventListener('keydown', (event) => {

    if (event.key === 'Enter' && !event.shiftKey) {

      event.preventDefault();

      void sendQuery(input.value || '');

    }

  });



  clearBtn?.addEventListener('click', clearAssistant);

  newChatBtn?.addEventListener('click', () => startNewChat(true));

  renderMessages();

}



document.addEventListener('DOMContentLoaded', initAssistant);

