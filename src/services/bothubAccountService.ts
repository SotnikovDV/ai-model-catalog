import { getSyncConfig } from './syncConfig.js';

const BOTHUB_API_BASE = 'https://bothub.chat/api/v2';
const BALANCE_CACHE_TTL_MS = 60_000;
const FETCH_TIMEOUT_MS = 15_000;

type BothubTokens = {
  accessToken: string;
  refreshToken: string;
};

type BalanceCache = {
  balance: number;
  fetchedAt: number;
};

export class BothubAccountError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 503) {
    super(message);
    this.name = 'BothubAccountError';
    this.statusCode = statusCode;
  }
}

let tokens: BothubTokens | null = null;
let balanceCache: BalanceCache | null = null;

function getCredentials(): { email: string; password: string } | null {
  const email = process.env.BOTHUB_EMAIL?.trim() ?? '';
  const password = process.env.BOTHUB_PASSWORD?.trim() ?? '';
  if (!email || !password) return null;
  return { email, password };
}

/** JWT из BOTHUB_ACCESS_TOKEN или developer JWT (eyJ…) из ключа BotHub / AI. */
function getStaticBearerCandidate(): string | null {
  const fromEnv = process.env.BOTHUB_ACCESS_TOKEN?.trim();
  if (fromEnv) return fromEnv;

  try {
    const { bothubApiKey } = getSyncConfig();
    if (bothubApiKey?.startsWith('eyJ')) return bothubApiKey;
  } catch {
    // БД/конфиг могут быть недоступны в ранних тестах
  }
  return null;
}

export function isBothubAccountConfigured(): boolean {
  return Boolean(getCredentials() || getStaticBearerCandidate());
}

/** Сброс in-memory состояния (для тестов). */
export function resetBothubAccountCache(): void {
  tokens = null;
  balanceCache = null;
}

async function bothubFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${BOTHUB_API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function parseTokens(data: unknown): BothubTokens {
  if (!data || typeof data !== 'object') {
    throw new BothubAccountError('Некорректный ответ BOTHUB при авторизации');
  }
  const accessToken = (data as { accessToken?: unknown }).accessToken;
  const refreshToken = (data as { refreshToken?: unknown }).refreshToken;
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new BothubAccountError('BOTHUB не вернул access-токен');
  }
  return {
    accessToken,
    refreshToken: typeof refreshToken === 'string' ? refreshToken : '',
  };
}

async function signIn(): Promise<BothubTokens> {
  const creds = getCredentials();
  if (!creds) {
    throw new BothubAccountError(
      'Учётные данные BOTHUB не заданы (BOTHUB_EMAIL / BOTHUB_PASSWORD или BOTHUB_ACCESS_TOKEN)',
      503,
    );
  }

  let res: Response;
  try {
    res = await bothubFetch('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email: creds.email, password: creds.password }),
    });
  } catch {
    throw new BothubAccountError('Не удалось связаться с BOTHUB');
  }

  if (!res.ok) {
    throw new BothubAccountError('Не удалось войти в BOTHUB');
  }

  const data = await res.json().catch(() => null);
  tokens = parseTokens(data);
  return tokens;
}

async function refreshTokens(): Promise<BothubTokens | null> {
  if (!tokens?.refreshToken) return null;

  let res: Response;
  try {
    res = await bothubFetch('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = await res.json().catch(() => null);
  try {
    tokens = parseTokens(data);
    return tokens;
  } catch {
    return null;
  }
}

async function ensureAccessToken(): Promise<string> {
  if (tokens?.accessToken) {
    return tokens.accessToken;
  }

  // Сначала статический JWT (signin по email часто недоступен для developer-токена)
  const staticToken = getStaticBearerCandidate();
  if (staticToken) {
    tokens = { accessToken: staticToken, refreshToken: '' };
    return staticToken;
  }

  await signIn();
  return tokens!.accessToken;
}

async function fetchMe(accessToken: string): Promise<Response> {
  try {
    return await bothubFetch('/auth/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new BothubAccountError('Не удалось связаться с BOTHUB');
  }
}

function parseBalance(data: unknown): number {
  if (!data || typeof data !== 'object') {
    throw new BothubAccountError('Некорректный ответ BOTHUB при запросе баланса');
  }
  const subscription = (data as { subscription?: unknown }).subscription;
  if (!subscription || typeof subscription !== 'object') {
    throw new BothubAccountError('В ответе BOTHUB нет данных подписки');
  }
  const balance = (subscription as { balance?: unknown }).balance;
  if (typeof balance !== 'number' || !Number.isFinite(balance)) {
    throw new BothubAccountError('BOTHUB не вернул числовой баланс');
  }
  return balance;
}

export async function getBothubBalance(): Promise<number> {
  if (balanceCache && Date.now() - balanceCache.fetchedAt < BALANCE_CACHE_TTL_MS) {
    return balanceCache.balance;
  }

  let accessToken = await ensureAccessToken();
  let res = await fetchMe(accessToken);

  if (res.status === 401) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      accessToken = refreshed.accessToken;
    } else if (getCredentials()) {
      await signIn();
      accessToken = tokens!.accessToken;
    } else {
      throw new BothubAccountError('Токен BOTHUB отклонён (401)');
    }
    res = await fetchMe(accessToken);
  }

  if (!res.ok) {
    throw new BothubAccountError('Не удалось получить баланс BOTHUB');
  }

  const data = await res.json().catch(() => null);
  const balance = parseBalance(data);
  balanceCache = { balance, fetchedAt: Date.now() };
  return balance;
}
