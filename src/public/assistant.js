const messages = [];

let isSending = false;

let waitingTimerId = null;

let waitingStartedAt = 0;

let lastResult = null;

let lastToken = null;

let currentChatId = null;

let chatList = [];

/** @type {'recommend' | 'chat'} */
let assistantMode = 'recommend';

/** @type {'analytics' | 'search'} */
let chatTier = 'analytics';

let cachedAiConfig = null;

const RECOMMEND_HERO_DESC = 'Опишите задачу на естественном языке — аналитическая модель из админки подберёт подходящие модели из каталога.';
const CHAT_HERO_DESC = 'Технический обзор и диалог с моделью поиска (или аналитической, если поиск не настроен). Можно продолжать уточняющими вопросами.';



const chatCommon = window.ChatCommon || {};

const escHtml = chatCommon.escHtml || ((value) => String(value ?? ''));

const buildMessageHtml = chatCommon.buildMessageHtml

  || ((message) => String(message.content ?? ''));

const attachMessageActions = chatCommon.attachMessageActions || (() => {});

const attachContentActions = chatCommon.attachContentActions || (() => {});

const buildCopySaveActions = chatCommon.buildCopySaveActions || (() => '');

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

const messageEdit = createMessageEditController('assistantEditCancelBtn');
let attachmentUi = null;



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
    ? `<span class="assistant-preview-title-row"><a href="/models/${escHtml(modelId)}" class="assistant-preview-name" data-model-modal-id="${escHtml(modelId)}" title="Открыть описание модели">${safeName}</a>${window.CopyModelName?.actionsHtml(name, modelId) || ''}</span>`
    : `<span class="assistant-preview-title-row"><strong class="assistant-preview-name">${safeName}</strong>${window.CopyModelName?.actionsHtml(name) || ''}</span>`;

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



function truncateMessagesFrom(message) {

  const index = messages.indexOf(message);

  if (index < 0) return -1;

  messages.splice(index);

  lastResult = null;

  lastToken = null;

  setError('');

  return index;

}



function editUserMessage(message) {

  if (isSending) return;

  messageEdit.begin({
    messages: messages.map((item) => ({ ...item })),
    lastResult,
    lastToken,
  });

  const index = truncateMessagesFrom(message);

  if (index < 0) {
    messageEdit.commit();
    return;
  }

  renderMessages();

  void persistCurrentChat();

  const input = document.getElementById('assistantInput');

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
    lastResult = snapshot.lastResult ?? null;
    lastToken = snapshot.lastToken ?? null;
  });

  if (!restored) return;

  setError('');

  attachmentUi?.clear();

  renderMessages();

  const input = document.getElementById('assistantInput');

  if (input) input.value = '';

  void persistCurrentChat();

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

  void sendQuery(content, attachments);

}



function getUserMessageActionOptions() {

  return {

    filePrefix: 'assistant-response',

    onEdit: editUserMessage,

    onRepeat: repeatUserMessage,

  };

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



function setSearchModelStatus(modelName) {

  const modelId = window.ASSISTANT_META?.searchModelId;

  const safeName = escHtml(modelName);

  if (modelId) {

    const safeId = escHtml(modelId);

    setStatus(

      `Используется модель с поиском: <a href="/models/${safeId}" target="_blank" rel="noopener noreferrer">${safeName}</a>`,

      { html: true },

    );

    return;

  }

  setStatus(`Используется модель с поиском: ${modelName}`);

}



function setActiveModelStatus() {

  if (assistantMode === 'chat' && chatTier === 'search') {

    const name = cachedAiConfig?.modelSearch || window.ASSISTANT_META?.searchModelName;

    if (name) {

      setSearchModelStatus(name);

      return;

    }

  }

  const analyticsName = cachedAiConfig?.modelAnalytics || window.ASSISTANT_META?.modelName;

  if (analyticsName) setAnalyticsModelStatus(analyticsName);

}



function syncAssistantHelpContext() {
  const context = assistantMode === 'chat' ? 'assistant.overview' : 'assistant.recommend';
  if (typeof window.Help?.setContext === 'function') {
    window.Help.setContext(context);
  } else {
    const helpBtn = document.getElementById('assistantHelpBtn');
    if (helpBtn) helpBtn.setAttribute('data-help-context', context);
  }
}

function applyAssistantModeUi() {

  const sendBtn = document.getElementById('assistantSendBtn');

  const input = document.getElementById('assistantInput');

  const heroDesc = document.getElementById('assistantHeroDesc');

  const emptyEl = document.getElementById('assistantEmpty');



  if (assistantMode === 'chat') {

    if (sendBtn) sendBtn.textContent = 'Отправить';

    if (input) {

      input.placeholder = 'Продолжите диалог с ассистентом…';

      input.setAttribute('aria-label', 'Сообщение ассистенту');

    }

    if (heroDesc) heroDesc.textContent = CHAT_HERO_DESC;

    if (emptyEl && !messages.length) {

      emptyEl.textContent = 'Задайте уточняющий вопрос по обзору модели или продолжите диалог.';

    }

  } else {

    if (sendBtn) sendBtn.textContent = 'Подобрать модели';

    if (input) {

      input.placeholder = 'Опишите, какую модель вы ищете…';

      input.setAttribute('aria-label', 'Запрос на подбор моделей');

    }

    if (heroDesc) heroDesc.textContent = RECOMMEND_HERO_DESC;

    if (emptyEl && !messages.length) {

      emptyEl.textContent = 'Например: «Нужна недорогая модель для RAG на русском с большим контекстом» или «Лучшая модель для кодогенерации».';

    }

  }

  syncAssistantHelpContext();

}



function enterChatMode({ preferSearch = true } = {}) {

  assistantMode = 'chat';

  const searchReady = Boolean(

    cachedAiConfig?.searchConfigured

    || (window.ASSISTANT_META?.searchConfigured && window.ASSISTANT_META?.searchModelName),

  );

  chatTier = preferSearch && searchReady ? 'search' : 'analytics';

  applyAssistantModeUi();

  setActiveModelStatus();

}



function enterRecommendMode() {

  assistantMode = 'recommend';

  chatTier = 'analytics';

  applyAssistantModeUi();

  setActiveModelStatus();

}



function toChatApiMessages(list) {

  return list

    .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'system')

    .map((message) => ({

      role: message.role,

      content: messageContentForApi(message),

    }));

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



function inferAssistantModeFromMessages(list) {

  const firstUser = list.find((message) => message.role === 'user');

  if (firstUser && /^Сделай технический обзор модели/i.test(String(firstUser.content || ''))) {

    enterChatMode({ preferSearch: true });

    return;

  }

  if (list.length && !lastResult) {

    // Диалог без блока рекомендаций — продолжаем как чат

    enterChatMode({ preferSearch: true });

    return;

  }

  enterRecommendMode();

}



function applyChatData(chat) {

  messageEdit.commit();

  messages.length = 0;

  if (Array.isArray(chat.messages)) {

    messages.push(...chat.messages);

  }

  attachmentUi?.clear();

  lastResult = chat.lastResult || null;

  restoreRecommendationToken(lastResult);

  currentChatId = chat.id;

  setError('');

  inferAssistantModeFromMessages(messages);

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



function scrollAssistantToLatestMessage() {

  const container = document.getElementById('assistantMessages');

  if (!container) return;



  const candidates = container.querySelectorAll(
    '.chat-message:not(.chat-message--loading), .assistant-result-block, .chat-message--loading',
  );

  const target = candidates[candidates.length - 1];

  if (!target) {

    container.scrollTop = container.scrollHeight;

    return;

  }



  // Верх последней реплики / блока — к верхней границе панели чата

  const containerRect = container.getBoundingClientRect();

  const targetRect = target.getBoundingClientRect();

  container.scrollTop += targetRect.top - containerRect.top;

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



  container.querySelectorAll('.chat-message:not(.chat-message--loading), .assistant-result-block').forEach((el) => el.remove());



  messages.forEach((message) => {

    const div = document.createElement('div');

    div.className = `chat-message chat-message--${message.role}`;

    div.innerHTML = buildMessageHtml(message);

    attachMessageActions(div, message, getUserMessageActionOptions());

    container.appendChild(div);

  });



  if (lastResult && lastToken) {

    container.appendChild(buildResultBlock(lastResult, lastToken));

  }



  scrollAssistantToLatestMessage();

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



function goToCompareChatWithRecommendation(result, extra = {}) {

  const max = window.CompareBuffer?.CHAT_MAX_MODELS || 8;

  const ids = (result.items || [])

    .map((item) => item.modelId || item.model?.id)

    .filter(Boolean)

    .slice(0, max);

  if (!ids.length) return;

  if (window.CompareBuffer) {

    window.CompareBuffer.setIds(ids);

  }

  const base = window.CompareBuffer?.getChatUrl(ids)

    || `/compare/chat?ids=${ids.map(encodeURIComponent).join(',')}`;

  const params = new URLSearchParams();

  if (extra.from) params.set('from', extra.from);

  if (extra.rec) params.set('rec', extra.rec);

  const suffix = params.toString();

  const url = suffix ? `${base}${base.includes('?') ? '&' : '?'}${suffix}` : base;

  window.location.href = window.AdminAccess?.protectedHref(url) || url;

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

      <button type="button" class="btn btn-secondary assistant-compare-chat-btn">Чат-сравнение</button>

    </div>

  `;

  const compareBtn = div.querySelector('.assistant-compare-btn');

  if (compareBtn) {

    compareBtn.addEventListener('click', () => goToCompareWithRecommendation(result));

  }

  const compareChatBtn = div.querySelector('.assistant-compare-chat-btn');

  if (compareChatBtn) {

    compareChatBtn.addEventListener('click', () => goToCompareChatWithRecommendation(result, { from: 'assistant' }));

  }

  attachContentActions(div, () => formatResultAsMarkdown(result), { filePrefix: 'assistant-recommendations' });

  window.CopyModelName?.bindAll(div);

  window.ModelModal?.bindNameClicks(div);

  return div;

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

  const elapsedEl = document.getElementById('assistantWaitingElapsed');

  if (!elapsedEl || !waitingStartedAt) return;

  elapsedEl.textContent = formatWaitingElapsed(performance.now() - waitingStartedAt);

}



function setLoading(loading) {

  const container = document.getElementById('assistantMessages');

  const sendBtn = document.getElementById('assistantSendBtn');

  const input = document.getElementById('assistantInput');



  if (sendBtn) {

    sendBtn.disabled = loading;

    sendBtn.setAttribute('aria-busy', loading ? 'true' : 'false');

  }

  if (input) input.disabled = loading;

  attachmentUi?.setDisabled(loading);



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

        <span class="chat-waiting-label">${assistantMode === 'chat' ? 'Готовлю ответ…' : 'Подбираю модели…'}</span>

        <span class="chat-waiting-elapsed" id="assistantWaitingElapsed">0 с</span>

      </div>

    `;

    container.appendChild(div);

    scrollAssistantToLatestMessage();

    waitingTimerId = window.setInterval(updateWaitingElapsed, 250);

  }

}



async function sendOverviewRequest(modelName, modelId) {

  const name = String(modelName || '').trim();

  if (!name || isSending) return;



  messageEdit.commit();

  isSending = true;

  setError('');

  lastResult = null;

  lastToken = null;



  const userText = `Сделай технический обзор модели «${name}»`;

  messages.push({ role: 'user', content: userText });

  renderMessages();

  setLoading(true);



  const input = document.getElementById('assistantInput');

  if (input) input.value = '';



  let hadSuccessfulResult = false;



  try {

    const startedAt = performance.now();

    const response = await fetch('/api/ai/model-overview', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        modelName: name,

        ...(modelId ? { modelId } : {}),

      }),

    });



    const payload = await response.json().catch(() => null);



    if (!response.ok) {

      const message = payload?.error

        || (Array.isArray(payload?.issues) ? payload.issues.map((i) => i.message).join('\n') : null)

        || 'Не удалось получить обзор модели';

      setError(message);

      await persistCurrentChat();

      return;

    }



    const data = payload?.data;

    const content = data?.content?.trim();

    if (!content) {

      setError('AI вернул пустой обзор модели.');

      await persistCurrentChat();

      return;

    }



    hadSuccessfulResult = true;

    messages.push({

      role: 'assistant',

      content,

      usage: data?.usage,

      elapsedMs: performance.now() - startedAt,

    });

    renderMessages();

  } catch {

    setError('Сетевая ошибка при запросе обзора модели.');

    await persistCurrentChat();

  } finally {

    isSending = false;

    setLoading(false);

    if (hadSuccessfulResult) {

      await persistCurrentChat();

    }

  }

}



async function sendChatFollowUp(text, presetAttachments) {

  const displayText = String(text ?? '').trim();

  const attachments = Array.isArray(presetAttachments)

    ? presetAttachments

    : (attachmentUi?.getAttachments() || []);

  const apiContent = composeMessageWithAttachments(displayText, attachments);

  if (!apiContent || isSending) return;



  messageEdit.commit();

  isSending = true;

  setError('');

  lastResult = null;

  lastToken = null;



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



  const input = document.getElementById('assistantInput');

  if (input) input.value = '';



  let hadSuccessfulResult = false;



  try {

    const startedAt = performance.now();

    const response = await fetch('/api/ai/chat', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({

        tier: chatTier,

        messages: toChatApiMessages(messages),

        temperature: 0.3,

        maxTokens: 2048,

      }),

    });



    const payload = await response.json().catch(() => null);



    if (!response.ok) {

      const message = payload?.error

        || (Array.isArray(payload?.issues) ? payload.issues.map((i) => i.message).join('\n') : null)

        || 'Не удалось получить ответ ассистента';

      setError(message);

      await persistCurrentChat();

      return;

    }



    const data = payload?.data;

    const content = data?.content?.trim();

    if (!content) {

      setError('AI вернул пустой ответ.');

      await persistCurrentChat();

      return;

    }



    hadSuccessfulResult = true;

    messages.push({

      role: 'assistant',

      content,

      usage: data?.usage,

      elapsedMs: performance.now() - startedAt,

    });

    renderMessages();

  } catch {

    setError('Сетевая ошибка при отправке сообщения.');

    await persistCurrentChat();

  } finally {

    isSending = false;

    setLoading(false);

    if (hadSuccessfulResult) {

      await persistCurrentChat();

    }

  }

}



async function sendQuery(text, presetAttachments) {

  if (assistantMode === 'chat') {

    await sendChatFollowUp(text, presetAttachments);

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

  lastResult = null;

  lastToken = null;



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



  const input = document.getElementById('assistantInput');

  if (input) input.value = '';



  let hadSuccessfulResult = false;



  try {

    const startedAt = performance.now();

    const response = await fetch('/api/ai/recommend', {

      method: 'POST',

      headers: { 'Content-Type': 'application/json' },

      body: JSON.stringify({
        query: apiContent,
        limit: 8,
        messages: messages.map((message) => ({
          role: message.role,
          content: messageContentForApi(message),
        })),
      }),

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



function startNewChat(updateUrl = true, options = {}) {

  if (isSending) return;

  messageEdit.commit();

  messages.length = 0;

  lastResult = null;

  lastToken = null;

  currentChatId = null;

  setError('');

  attachmentUi?.clear();

  if (options.preserveMode) {

    applyAssistantModeUi();

    setActiveModelStatus();

  } else {

    enterRecommendMode();

  }

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

    cachedAiConfig = config || null;



    if (!config?.enabled || (!config?.configured && !config?.searchConfigured)) {

      setStatus('AI-провайдер не настроен. Настройте его в разделе «Админ».');

      const sendBtn = document.getElementById('assistantSendBtn');

      const input = document.getElementById('assistantInput');

      if (sendBtn) sendBtn.disabled = true;

      if (input) input.disabled = true;

      return;

    }



    setActiveModelStatus();

  } catch {

    setStatus('Не удалось проверить настройки AI-провайдера.');

  }

}



async function initAssistant() {

  const form = document.getElementById('assistantForm');

  const input = document.getElementById('assistantInput');

  const clearBtn = document.getElementById('assistantClearBtn');

  const cancelEditBtn = document.getElementById('assistantEditCancelBtn');

  const newChatBtn = document.getElementById('assistantNewChatBtn');

  const actionsLeft = document.getElementById('assistantFormActionsLeft');



  if (!form) return;



  window.ModelModal?.init({ bindDefaultActions: true });



  attachmentUi = mountAttachmentUi({

    form,

    actionsLeftEl: actionsLeft,

    onError: setError,

  });



  initAssistantSidebar();

  await fetchChatList();

  await loadAiStatus();



  const params = new URLSearchParams(window.location.search);

  const chatId = params.get('chat');

  const overviewMode = params.get('mode') === 'overview';

  const overviewName = params.get('name')?.trim() || '';

  const overviewId = params.get('id')?.trim() || '';



  if (chatId) {

    await selectChat(chatId);

  } else if (overviewMode && overviewName) {

    enterChatMode({ preferSearch: true });

    startNewChat(false, { preserveMode: true });

    const cleanUrl = new URL(window.location.href);

    cleanUrl.searchParams.delete('mode');

    cleanUrl.searchParams.delete('name');

    cleanUrl.searchParams.delete('id');

    const qs = cleanUrl.searchParams.toString();

    window.history.replaceState({}, '', cleanUrl.pathname + (qs ? `?${qs}` : ''));

    await sendOverviewRequest(overviewName, overviewId);

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

  cancelEditBtn?.addEventListener('click', cancelEditUserMessage);

  newChatBtn?.addEventListener('click', () => startNewChat(true));

  renderMessages();

}



document.addEventListener('DOMContentLoaded', initAssistant);

