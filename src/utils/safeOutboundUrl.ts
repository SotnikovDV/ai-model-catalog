/**
 * Блокирует URL облачных metadata-сервисов (SSRF).
 * localhost / 127.0.0.1 не блокируются — нужны для локальных LLM (Ollama и т.п.).
 */
const BLOCKED_HOSTS = new Set([
  '169.254.169.254',
  'metadata.google.internal',
  'metadata.google',
]);

export function isBlockedOutboundUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith('.metadata.google.internal')) {
    return true;
  }

  if (/^169\.254\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
    return true;
  }

  return false;
}

export const SAFE_OUTBOUND_URL_MESSAGE = 'Адрес заблокирован (cloud metadata / недопустимый протокол)';
