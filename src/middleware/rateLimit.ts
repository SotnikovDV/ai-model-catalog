import rateLimit from 'express-rate-limit';

function parseLimit(envValue: string | undefined, fallback: number): number {
  const parsed = Number(envValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseLimit(process.env.AI_RATE_LIMIT_MAX, 60),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Повторите позже.' },
});

export const syncRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseLimit(process.env.SYNC_RATE_LIMIT_MAX, 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Повторите позже.' },
});

export const availabilityRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseLimit(process.env.AVAILABILITY_RATE_LIMIT_MAX, 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Повторите позже.' },
});

export const evaluationRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseLimit(process.env.EVALUATION_RATE_LIMIT_MAX, 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Слишком много запросов. Повторите позже.' },
});
