/**
 * Perplexity Sonar возвращает `citations: string[]` (1-based индексы в тексте как [1], [2]).
 */

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function extractCitationUrls(payload: {
  citations?: unknown;
  search_results?: unknown;
}): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  const push = (raw: unknown) => {
    if (typeof raw !== 'string') return;
    const url = raw.trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) return;
    seen.add(url);
    urls.push(url);
  };

  if (Array.isArray(payload.citations)) {
    for (const item of payload.citations) {
      if (typeof item === 'string') {
        push(item);
      } else if (item && typeof item === 'object' && 'url' in item) {
        push((item as { url?: unknown }).url);
      }
    }
  }

  if (urls.length === 0 && Array.isArray(payload.search_results)) {
    for (const item of payload.search_results) {
      if (item && typeof item === 'object' && 'url' in item) {
        push((item as { url?: unknown }).url);
      }
    }
  }

  return urls;
}

/**
 * Заменяет [n] на кликабельные сноски.
 * Уже оформленные markdown-ссылки [n](url) не трогает.
 */
export function linkifyCitationFootnotes(content: string, citations: string[]): string {
  if (!content || citations.length === 0) return content;

  return content.replace(/\[(\d+)\](?!\()/g, (match, numStr: string) => {
    const index = Number.parseInt(numStr, 10) - 1;
    if (!Number.isFinite(index) || index < 0 || index >= citations.length) return match;
    const url = citations[index];
    if (!url) return match;
    const safeUrl = escapeHtmlAttr(url);
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="citation-ref" title="${safeUrl}">[${numStr}]</a>`;
  });
}

export function appendCitationsSection(content: string, citations: string[]): string {
  if (!content || citations.length === 0) return content;
  if (/\n#{1,3}\s*Источники\b/i.test(content) || /^#{1,3}\s*Источники\b/im.test(content)) {
    return content;
  }

  const lines = citations.map((url, index) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return `${index + 1}. [${host}](${url})`;
    } catch {
      return `${index + 1}. ${url}`;
    }
  });

  return `${content.trim()}\n\n### Источники\n\n${lines.join('\n')}`;
}

export function applyCitationsToContent(content: string, citations: string[]): string {
  if (!citations.length) return content;
  const linked = linkifyCitationFootnotes(content, citations);
  return appendCitationsSection(linked, citations);
}
