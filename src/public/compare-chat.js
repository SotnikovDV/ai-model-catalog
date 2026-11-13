(function initCompareChat() {
  const chatCommon = window.ChatCommon || {};
  const buildMessageHtml = chatCommon.buildMessageHtml
    || ((message) => String(message.content ?? ''));
  const buildMessageRatingHtml = chatCommon.buildMessageRatingHtml || (() => '');
  const attachMessageActions = chatCommon.attachMessageActions || (() => {});
  const attachMessageRating = chatCommon.attachMessageRating || (() => {});
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
  const downloadMarkdown = chatCommon.downloadMarkdown || ((content, filename) => {
    const blob = new Blob([String(content ?? '')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || 'chat-response.md';
    link.click();
    URL.revokeObjectURL(url);
  });
  const buildExportFilename = chatCommon.buildExportFilename
    || ((prefix) => `${String(prefix || 'chat').replace(/\s+/g, '-')}.md`);
  const mountAttachmentUi = chatCommon.mountAttachmentUi || (() => ({
    getAttachments: () => [],
    clear: () => {},
    setAttachments: () => {},
    setError: () => {},
    setDisabled: () => {},
  }));

  const messageEdit = createMessageEditController('chatEditCancelBtn');
  let attachmentUi = null;

  const columns = new Map();
  let isSending = false;

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

  function getModels() {
    return Array.isArray(window.COMPARE_CHAT_MODELS) ? window.COMPARE_CHAT_MODELS : [];
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

  function columnEl(modelId) {
    return document.querySelector(`.compare-chat-column[data-model-id="${CSS.escape(modelId)}"]`);
  }

  function messagesEl(modelId) {
    return document.querySelector(`[data-chat-messages="${CSS.escape(modelId)}"]`);
  }

  function emptyEl(modelId) {
    return document.querySelector(`[data-chat-empty="${CSS.escape(modelId)}"]`);
  }

  function errorEl(modelId) {
    return document.querySelector(`[data-chat-error="${CSS.escape(modelId)}"]`);
  }

  function getIncludeReasoning(model) {
    if (!modelSupportsReasoningToggle(model)) return undefined;
    const toggle = document.querySelector(`[data-reasoning-toggle="${CSS.escape(model.id)}"]`);
    if (toggle) return Boolean(toggle.checked);
    return true;
  }

  let syncingAllReasoning = false;

  function visibleReasoningToggles() {
    return [...document.querySelectorAll('[data-reasoning-toggle]')].filter((toggle) => {
      const wrap = toggle.closest('[data-reasoning-wrap]');
      return wrap && !wrap.hidden;
    });
  }

  function syncMasterReasoningToggle() {
    const wrap = document.getElementById('compareChatReasoningAllWrap');
    const master = document.getElementById('compareChatReasoningAll');
    if (!wrap || !master) return;

    const toggles = visibleReasoningToggles();
    if (toggles.length === 0) {
      wrap.hidden = true;
      master.indeterminate = false;
      return;
    }

    wrap.hidden = false;
    const checkedCount = toggles.filter((toggle) => toggle.checked).length;
    master.indeterminate = checkedCount > 0 && checkedCount < toggles.length;
    master.checked = checkedCount === toggles.length;
  }

  function setAllReasoningToggles(checked) {
    syncingAllReasoning = true;
    visibleReasoningToggles().forEach((toggle) => {
      if (toggle.checked === checked) return;
      toggle.checked = checked;
      toggle.dispatchEvent(new Event('change'));
    });
    syncingAllReasoning = false;
    syncMasterReasoningToggle();
  }

  function initReasoningToggles() {
    getModels().forEach((model) => {
      const wrap = document.querySelector(`[data-reasoning-wrap="${CSS.escape(model.id)}"]`);
      const toggle = document.querySelector(`[data-reasoning-toggle="${CSS.escape(model.id)}"]`);
      if (!wrap || !toggle) return;

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
        if (!syncingAllReasoning) syncMasterReasoningToggle();
      });
    });

    const master = document.getElementById('compareChatReasoningAll');
    master?.addEventListener('change', () => {
      master.indeterminate = false;
      setAllReasoningToggles(master.checked);
    });
    syncMasterReasoningToggle();
  }

  function setColumnError(modelId, message) {
    const state = columns.get(modelId);
    if (state) state.lastError = message || '';
    const el = errorEl(modelId);
    if (!el) return;
    if (!message) {
      el.hidden = true;
      el.textContent = '';
      return;
    }
    el.hidden = false;
    el.textContent = message;
  }

  function truncateAllColumnsFromMessage(message, modelId) {
    const state = columns.get(modelId);
    if (!state) return -1;
    const index = state.messages.indexOf(message);
    if (index < 0) return -1;
    columns.forEach((columnState, columnId) => {
      if (columnState.messages.length > index) {
        columnState.messages.splice(index);
        setColumnError(columnId, '');
      }
    });
    return index;
  }

  function snapshotColumns() {
    const snapshot = new Map();
    columns.forEach((state, modelId) => {
      snapshot.set(modelId, {
        messages: state.messages.map((item) => ({ ...item })),
        lastError: state.lastError || '',
      });
    });
    return snapshot;
  }

  function restoreColumns(snapshot) {
    columns.forEach((state, modelId) => {
      const saved = snapshot.get(modelId);
      state.messages = saved?.messages ? saved.messages.map((item) => ({ ...item })) : [];
      setColumnError(modelId, saved?.lastError || '');
    });
  }

  function editUserMessage(message, modelId) {
    if (isSending) return;
    messageEdit.begin({ columns: snapshotColumns() });
    const index = truncateAllColumnsFromMessage(message, modelId);
    if (index < 0) {
      messageEdit.commit();
      return;
    }
    columns.forEach((_, columnId) => renderColumn(columnId));
    updateExportButtonVisibility();
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
      restoreColumns(snapshot.columns);
    });
    if (!restored) return;
    attachmentUi?.clear();
    columns.forEach((_, columnId) => renderColumn(columnId));
    const input = document.getElementById('chatInput');
    if (input) input.value = '';
    updateExportButtonVisibility();
  }

  function repeatUserMessage(message, modelId) {
    if (isSending) return;
    messageEdit.commit();
    const content = String(message.content ?? '').trim();
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    if (!content && attachments.length === 0) return;
    const index = truncateAllColumnsFromMessage(message, modelId);
    if (index < 0) return;
    columns.forEach((_, columnId) => renderColumn(columnId));
    void sendMessage(content, attachments);
  }

  function getUserMessageActionOptions(message, modelId) {
    return {
      filePrefix: columns.get(modelId)?.model?.name || 'model-chat',
      onEdit: () => editUserMessage(message, modelId),
      onRepeat: () => repeatUserMessage(message, modelId),
    };
  }

  function formatWaitingElapsed(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    if (totalSec < 60) return `${totalSec} с`;
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${String(sec).padStart(2, '0')}`;
  }

  function stopWaitingTimer(state) {
    if (state.waitingTimerId != null) {
      window.clearInterval(state.waitingTimerId);
      state.waitingTimerId = null;
    }
    state.waitingStartedAt = 0;
  }

  function apiMessages(messages) {
    return messages
      .filter((message) => message.role === 'user' || message.role === 'assistant')
      .map((message) => ({ role: message.role, content: messageContentForApi(message) }));
  }

  function modelPricing(model) {
    return {
      inputPricePerMTok: model.inputPricePerMTok,
      outputPricePerMTok: model.outputPricePerMTok,
    };
  }

  function renderColumn(modelId) {
    const state = columns.get(modelId);
    const container = messagesEl(modelId);
    const empty = emptyEl(modelId);
    if (!state || !container) return;

    container.querySelectorAll('.chat-message').forEach((el) => el.remove());

    if (!state.messages.length) {
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;

    state.messages.forEach((message) => {
      const div = document.createElement('div');
      div.className = `chat-message chat-message--${message.role}`;
      const ratingHtml = message.role === 'assistant' ? buildMessageRatingHtml(message) : '';
      div.innerHTML = buildMessageHtml(message) + ratingHtml;
      attachMessageActions(div, message, getUserMessageActionOptions(message, modelId));
      if (message.role === 'assistant') {
        attachMessageRating(div, message, { modelId });
      }
      container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
  }

  function setColumnLoading(modelId, loading) {
    const state = columns.get(modelId);
    const container = messagesEl(modelId);
    if (!state || !container) return;

    const existing = container.querySelector('.chat-message--loading');
    if (existing) existing.remove();
    stopWaitingTimer(state);

    if (!loading) return;

    state.waitingStartedAt = performance.now();
    const div = document.createElement('div');
    div.className = 'chat-message chat-message--assistant chat-message--loading';
    div.innerHTML = `
      <div class="chat-message-role">Ассистент</div>
      <div class="chat-waiting" aria-live="polite">
        <span class="chat-waiting-spinner" aria-hidden="true"></span>
        <span class="chat-waiting-label">Ожидание ответа…</span>
        <span class="chat-waiting-elapsed" data-waiting-elapsed="${modelId}">0 с</span>
      </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    state.waitingTimerId = window.setInterval(() => {
      const elapsedEl = container.querySelector(`[data-waiting-elapsed="${CSS.escape(modelId)}"]`);
      if (!elapsedEl || !state.waitingStartedAt) return;
      elapsedEl.textContent = formatWaitingElapsed(performance.now() - state.waitingStartedAt);
    }, 250);
  }

  function setFormDisabled(disabled) {
    const sendBtn = document.getElementById('chatSendBtn');
    const input = document.getElementById('chatInput');
    const clearBtn = document.getElementById('chatClearBtn');
    const testMenuBtn = document.getElementById('chatTestMenuBtn');
    if (sendBtn) sendBtn.disabled = disabled;
    if (input) input.disabled = disabled;
    if (clearBtn) clearBtn.disabled = disabled;
    if (testMenuBtn) testMenuBtn.disabled = disabled;
    const reportBtn = document.getElementById('compareChatReportBtn');
    if (reportBtn) reportBtn.disabled = disabled;
    attachmentUi?.setDisabled(disabled);
    document.querySelectorAll('[data-reasoning-toggle]').forEach((el) => {
      el.disabled = disabled;
    });
    if (disabled) closeTestMenu();
  }

  function syncEmptyState() {
    const hasModels = columns.size > 0;
    const empty = document.getElementById('compareChatEmpty');
    const panel = document.getElementById('compareChatPanel');
    if (empty) empty.hidden = hasModels;
    if (panel) panel.hidden = !hasModels;
    updateExportButtonVisibility();
  }

  function getLastAssistantReply(state) {
    if (!state?.messages?.length) return null;
    for (let i = state.messages.length - 1; i >= 0; i -= 1) {
      const message = state.messages[i];
      if (message?.role === 'assistant' && String(message.content ?? '').trim()) {
        return message;
      }
    }
    return null;
  }

  function updateExportButtonVisibility() {
    const button = document.getElementById('compareChatExportBtn');
    if (button) {
      if (isSending || columns.size === 0) {
        button.hidden = true;
      } else {
        const hasAnyReply = [...columns.values()].some((state) => getLastAssistantReply(state));
        button.hidden = !hasAnyReply;
      }
    }
    updateReportButtonVisibility();
  }

  function columnRoundSettled(state) {
    if (!state?.messages?.length) return false;
    const last = state.messages[state.messages.length - 1];
    if (last?.role === 'assistant' && String(last.content ?? '').trim()) return true;
    return last?.role === 'user' && Boolean(state.lastError);
  }

  function updateReportButtonVisibility() {
    const button = document.getElementById('compareChatReportBtn');
    if (!button) return;
    const ready = !isSending
      && columns.size > 0
      && [...columns.values()].every(columnRoundSettled);
    button.hidden = !ready;
  }

  function formatReportNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toLocaleString('ru-RU') : '—';
  }

  function formatReportDuration(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '—';
    if (ms < 1000) return `${Math.round(ms)} мс`;
    return `${(ms / 1000).toFixed(ms >= 10_000 ? 1 : 2).replace('.', ',')} с`;
  }

  function formatReportSpeed(ms) {
    if (!Number.isFinite(ms) || ms < 0) return '';
    const seconds = ms / 1000;
    if (seconds === 0) return '0';
    const digits = seconds >= 0.01 ? 2 : 3;
    return seconds.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatReportPrice(value) {
    if (!Number.isFinite(value)) return '';
    return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  }

  function formatReportMoney(value) {
    if (!Number.isFinite(value)) return '—';
    return `${value.toLocaleString('ru-RU', {
      minimumFractionDigits: value < 1 ? 4 : 2,
      maximumFractionDigits: value < 1 ? 4 : 2,
    })} ₽`;
  }

  function reportUsageCost(message) {
    const usage = message?.usage;
    const pricing = message?.pricing;
    if (!usage || !pricing) return null;
    const inputRate = Number(pricing.inputPricePerMTok);
    const outputRate = Number(pricing.outputPricePerMTok);
    if (!Number.isFinite(inputRate) || !Number.isFinite(outputRate)) return null;
    const promptTokens = Number(usage.promptTokens);
    const completionTokens = Number(usage.completionTokens);
    const promptCost = Number.isFinite(promptTokens) ? (promptTokens / 1_000_000) * inputRate : 0;
    const completionCost = Number.isFinite(completionTokens) ? (completionTokens / 1_000_000) * outputRate : 0;
    return promptCost + completionCost;
  }

  function fenceBlock(text) {
    const value = String(text ?? '').replace(/\r\n/g, '\n').replace(/\n$/, '');
    const marker = value.includes('```') ? '~~~~' : '```';
    return `${marker}\n${value}\n${marker}`;
  }

  function escapeTableCell(value) {
    return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
  }

  function reportModelLink(model) {
    const name = String(model?.name || 'Модель').replace(/[[\]]/g, '');
    const id = model?.id;
    if (!id) return escapeTableCell(name);
    const url = `${window.location.origin}/models/${encodeURIComponent(id)}`;
    return `[${escapeTableCell(name)}](${url})`;
  }

  function reportReasoningCondition(states) {
    const flags = states
      .map((state) => getIncludeReasoning(state.model))
      .filter((value) => value !== undefined);
    if (!flags.length) return 'Режим рассуждений недоступен';
    if (flags.every((value) => value === false)) return 'Для всех моделей отключен режим рассуждений';
    if (flags.every((value) => value === true)) return 'Для всех моделей включен режим рассуждений';
    return 'Режим рассуждений включен не у всех моделей';
  }

  function reportOutcome(rounds) {
    const present = rounds.filter(Boolean);
    const succeeded = present.filter((round) => round.assistant).length;
    if (present.length > 0 && succeeded === present.length) return 'Все модели справились';
    if (succeeded === 0) return 'Все модели отказали';
    return `Справились ${succeeded} из ${present.length}`;
  }

  function collectRounds(state) {
    const rounds = [];
    state.messages.forEach((message, index) => {
      if (message?.role !== 'user') return;
      const next = state.messages[index + 1];
      const assistant = next?.role === 'assistant' ? next : null;
      const isLast = index === state.messages.length - 1;
      rounds.push({
        user: message,
        assistant,
        error: !assistant && isLast ? String(state.lastError || '') : '',
      });
    });
    return rounds;
  }

  function reportStatsLine(message) {
    if (!message) return '';
    const parts = [];
    if (message.elapsedMs != null) parts.push(`Время: ${formatReportDuration(message.elapsedMs)}`);
    if (message.usage?.totalTokens != null) {
      parts.push(`Токены: ${formatReportNumber(message.usage.totalTokens)}`);
    }
    const cost = reportUsageCost(message);
    if (cost != null) parts.push(`Стоимость: ${formatReportMoney(cost)}`);
    const score = Number(message.rating?.score);
    if (score) {
      const comment = String(message.rating?.comment ?? '').trim();
      parts.push(comment ? `Оценка: ${score}/5 (${comment})` : `Оценка: ${score}/5`);
    }
    return parts.join(' · ');
  }

  function buildCompareReport() {
    const entries = [...columns.values()].map((state) => ({
      state,
      rounds: collectRounds(state),
    }));
    const roundCount = entries.reduce((max, entry) => Math.max(max, entry.rounds.length), 0);
    const lines = [
      '# Отчет о сравнении моделей',
      '',
      `**Дата:** ${new Date().toLocaleString('ru-RU')}`,
      '',
      `**Моделей:** ${entries.length}`,
      '',
      '----',
      '',
    ];

    for (let roundIndex = 0; roundIndex < roundCount; roundIndex += 1) {
      const roundEntries = entries.map((entry) => ({
        state: entry.state,
        round: entry.rounds[roundIndex] || null,
      }));
      const sampleUser = roundEntries.map((entry) => entry.round?.user).find(Boolean);
      lines.push(`## Раунд ${roundIndex + 1}`, '', '### Запрос', '');
      const attachments = Array.isArray(sampleUser?.attachments) ? sampleUser.attachments : [];
      if (attachments.length) {
        lines.push(`Файлы: ${attachments.map((item) => item?.name || 'файл').join(', ')}`, '');
      }
      lines.push(fenceBlock(sampleUser?.content || ''), '');
      lines.push('### Условия', '', reportReasoningCondition(entries.map((entry) => entry.state)), '');
      lines.push(
        '### Общий результат',
        '',
        reportOutcome(roundEntries.map((entry) => entry.round)),
        '',
      );
      lines.push('### Скорость, цена', '');
      lines.push('| Модель | Скорость | Токенов | Цена | Оценка текста | Примечание к оценке |');
      lines.push('|----|----|----|----|----|----|');
      roundEntries.forEach(({ state, round }) => {
        const assistant = round?.assistant;
        const cost = assistant ? reportUsageCost(assistant) : null;
        const score = Number(assistant?.rating?.score);
        const note = String(assistant?.rating?.comment ?? '').trim();
        const cells = [
          reportModelLink(state.model),
          assistant ? formatReportSpeed(assistant.elapsedMs) : '',
          assistant?.usage?.totalTokens != null ? String(assistant.usage.totalTokens) : '',
          cost != null ? formatReportPrice(cost) : '',
          score ? String(score) : '',
          escapeTableCell(note),
        ];
        lines.push(`| ${cells.join(' | ')} |`);
      });
      lines.push('', '----', '', '### Ответы моделей', '');

      roundEntries.forEach(({ state, round }) => {
        if (!round) return;
        const name = state.model?.name || 'Модель';
        const meta = [state.model?.family, state.model?.provider].filter(Boolean).join(' · ');
        lines.push(`#### ${name}`, '');
        if (meta) lines.push(meta, '');
        if (round.assistant) {
          const stats = reportStatsLine(round.assistant);
          lines.push('**Ответ**', '');
          if (stats) lines.push(stats, '');
          const reasoning = String(round.assistant.reasoning || '').trim();
          if (reasoning) lines.push('**Рассуждение**', '', reasoning, '');
          lines.push(String(round.assistant.content ?? '').trim(), '');
          return;
        }
        lines.push('**Отказ**', '', round.error || 'Нет ответа', '');
      });
      lines.push('----', '');
    }

    return `${lines.join('\n').trim()}\n`;
  }

  function saveCompareReport() {
    if (isSending || ![...columns.values()].every(columnRoundSettled)) return;
    downloadMarkdown(buildCompareReport(), buildExportFilename('отчет-сравнения'));
  }

  function exportCompareResults() {
    if (isSending) return;
    const exports = [...columns.values()]
      .map((state) => {
        const reply = getLastAssistantReply(state);
        if (!reply) return null;
        return {
          content: String(reply.content ?? ''),
          prefix: state.model?.name || 'model-chat',
        };
      })
      .filter(Boolean);

    if (!exports.length) return;

    exports.forEach((item, index) => {
      window.setTimeout(() => {
        downloadMarkdown(item.content, buildExportFilename(item.prefix));
      }, index * 250);
    });
  }

  function currentQuery() {
    return new URLSearchParams(window.location.search);
  }

  function replaceChatUrl(ids) {
    const params = new URLSearchParams();
    if (ids.length) params.set('ids', ids.join(','));
    const from = currentQuery().get('from');
    const rec = currentQuery().get('rec');
    if (from) params.set('from', from);
    if (rec) params.set('rec', rec);
    const qs = params.toString();
    history.replaceState(null, '', qs ? `/compare/chat?${qs}` : '/compare/chat');
  }

  function excludeModel(modelId) {
    if (isSending) return;
    const column = columnEl(modelId);
    const state = columns.get(modelId);
    if (state) stopWaitingTimer(state);
    columns.delete(modelId);
    column?.remove();
    window.CompareBuffer?.remove(modelId);
    window.COMPARE_CHAT_MODELS = getModels().filter((model) => model.id !== modelId);
    replaceChatUrl([...columns.keys()]);
    syncEmptyState();
    syncMasterReasoningToggle();
  }

  async function sendToModel(model, userMessage) {
    const state = columns.get(model.id);
    if (!state) return;

    state.messages.push(userMessage);
    setColumnError(model.id, '');
    renderColumn(model.id);
    setColumnLoading(model.id, true);

    try {
      const body = { messages: apiMessages(state.messages) };
      const includeReasoning = getIncludeReasoning(model);
      if (includeReasoning !== undefined) {
        body.includeReasoning = includeReasoning;
      }

      const startedAt = performance.now();
      const response = await fetch(`/api/models/${model.id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!columns.has(model.id)) return;

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.error
          || (Array.isArray(payload?.issues) ? payload.issues.map((issue) => issue.message).join('\n') : null)
          || 'Не удалось получить ответ от модели';
        setColumnError(model.id, message);
        return;
      }

      const reply = payload?.data?.content;
      if (!reply) {
        setColumnError(model.id, 'Модель вернула пустой ответ.');
        return;
      }

      const reasoning = typeof payload?.data?.reasoning === 'string'
        ? payload.data.reasoning.trim()
        : '';

      state.messages.push({
        role: 'assistant',
        content: reply,
        reasoning: reasoning || null,
        responseId: crypto.randomUUID(),
        rating: null,
        usage: payload?.data?.usage,
        elapsedMs: performance.now() - startedAt,
        pricing: modelPricing(model),
      });
    } catch {
      if (columns.has(model.id)) {
        setColumnError(model.id, 'Сетевая ошибка при отправке сообщения.');
      }
    } finally {
      if (columns.has(model.id)) {
        setColumnLoading(model.id, false);
        renderColumn(model.id);
      }
    }
  }

  async function sendMessage(text, presetAttachments) {
    const displayText = String(text ?? '').trim();
    const attachments = Array.isArray(presetAttachments)
      ? presetAttachments
      : (attachmentUi?.getAttachments() || []);
    const apiContent = composeMessageWithAttachments(displayText, attachments);
    if (!apiContent || isSending || columns.size === 0) return;

    messageEdit.commit();

    isSending = true;
    setFormDisabled(true);
    updateExportButtonVisibility();

    const input = document.getElementById('chatInput');
    if (input) input.value = '';
    attachmentUi?.clear();

    const userMessage = { role: 'user', content: displayText };
    if (attachments.length) {
      userMessage.attachments = attachments.map((item) => ({
        name: item.name,
        text: item.text,
      }));
    }

    const models = [...columns.values()].map((state) => state.model);
    await Promise.allSettled(
      models.map((model) => sendToModel(model, {
        ...userMessage,
        attachments: userMessage.attachments
          ? userMessage.attachments.map((item) => ({ ...item }))
          : undefined,
      })),
    );

    isSending = false;
    setFormDisabled(false);
    updateExportButtonVisibility();
    input?.focus();
  }

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
    closeTestMenu();
    attachmentUi?.clear();
    columns.forEach((state, modelId) => {
      state.messages = [];
      setColumnError(modelId, '');
      renderColumn(modelId);
    });
    updateExportButtonVisibility();
  }

  function initColumns() {
    getModels().forEach((model) => {
      columns.set(model.id, {
        model,
        messages: [],
        lastError: '',
        waitingTimerId: null,
        waitingStartedAt: 0,
      });
    });

    document.querySelectorAll('.compare-chat-exclude-btn').forEach((button) => {
      button.addEventListener('click', () => {
        if (!button.dataset.id) return;
        excludeModel(button.dataset.id);
      });
    });
  }

  function initChat() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('chatInput');
    const clearBtn = document.getElementById('chatClearBtn');
    const cancelEditBtn = document.getElementById('chatEditCancelBtn');
    const exportBtn = document.getElementById('compareChatExportBtn');
    const actionsLeft = form?.querySelector('.chat-form-actions-left');
    if (!form) return;

    attachmentUi = mountAttachmentUi({
      form,
      actionsLeftEl: actionsLeft,
      onError: (message) => {
        if (columns.size === 0) return;
        columns.forEach((_, modelId) => setColumnError(modelId, message));
      },
    });

    initColumns();
    initReasoningToggles();
    initTestMenu();
    syncEmptyState();

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
    exportBtn?.addEventListener('click', exportCompareResults);
    document.getElementById('compareChatReportBtn')?.addEventListener('click', saveCompareReport);

    window.ModelModal?.init({ bindDefaultActions: true });
    window.ModelModal?.bindNameClicks(document);
  }

  document.addEventListener('DOMContentLoaded', initChat);
})();
