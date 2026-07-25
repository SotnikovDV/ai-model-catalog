import { Router, type Request, type Response } from 'express';
import { modelRepository } from '../models/modelRepository.js';
import { modelRatingRepository } from '../models/modelRatingRepository.js';
import { providerRepository, toProviderPublic } from '../models/providerRepository.js';
import { getAiConfigPublic } from '../services/aiConfig.js';
import { enrichModelForView, enrichModelsForView, RATING_FIELDS } from '../utils/modelView.js';
import { getUseCaseCategoryLabels } from '../utils/useCaseTaxonomy.js';
import { getViewAuth, resolveProtectedHref } from '../utils/viewAuth.js';
import {
  getModelFieldMetaMap,
  getSyncParamMetaMap,
} from '../utils/fieldMeta.js';
import { DETAIL_SECTION_META } from '../data/fieldMeta.js';
import { syncLogRepository } from '../models/syncLogRepository.js';
import {
  SYNC_LOG_KIND_LABELS,
  SYNC_LOG_STATUS_LABELS,
  formatDuration,
  formatSyncLogDate,
  formatSyncValue,
} from '../utils/syncLogView.js';
import type { ModelFilter } from '../types.js';
import { isAdminAuthEnabled, getAuthenticatedAdmin, requireAdminPageAuth } from '../middleware/adminAuth.js';

const viewMeta = {
  MODEL_FIELD_META: getModelFieldMetaMap(),
  SYNC_PARAM_META: getSyncParamMetaMap(),
  DETAIL_SECTION_META,
};

const router = Router();

function getEnrichedModelsBundle() {
  const models = modelRepository.findAll();
  const ratingsMap = modelRatingRepository.getAverageScoresMap();
  return {
    models: enrichModelsForView(models, ratingsMap),
    ratingsMap,
  };
}

function getEnrichedModelsForClient() {
  return getEnrichedModelsBundle().models;
}

function safeNextPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) {
    return '/admin';
  }
  return value;
}

router.get('/login', (req: Request, res: Response) => {
  if (!isAdminAuthEnabled()) {
    res.redirect('/admin');
    return;
  }

  if (getAuthenticatedAdmin(req)) {
    res.redirect(safeNextPath(req.query.next));
    return;
  }

  res.render('login', { next: safeNextPath(req.query.next) });
});

function parseFilter(query: Record<string, unknown>): ModelFilter {
  return {
    provider: query.provider as string | undefined,
    family: query.family as string | undefined,
    modality: query.modality as string | undefined,
    supports_vision: query.supports_vision === '1' ? true : undefined,
    supports_function_calling: query.supports_function_calling === '1' ? true : undefined,
    supports_json_mode: query.supports_json_mode === '1' ? true : undefined,
    supports_streaming: query.supports_streaming === '1' ? true : undefined,
    supports_web_search: query.supports_web_search === '1' ? true : undefined,
    min_context: query.min_context ? Number(query.min_context) : undefined,
    max_context: query.max_context ? Number(query.max_context) : undefined,
    search: query.search as string | undefined,
    sort: query.sort as any,
    order: query.order as any,
  };
}

router.get('/', (_req: Request, res: Response) => {
  const models = getEnrichedModelsForClient();
  const totalCount = models.length;
  const shownCount = models.filter((m) => !m.is_hidden).length;
  res.render('index', {
    models,
    totalCount,
    shownCount,
    useCaseCategories: getUseCaseCategoryLabels(),
    ...getViewAuth(_req),
  });
});

router.get('/models/new', requireAdminPageAuth, (_req: Request, res: Response) => {
  res.render('form', {
    model: null,
    providers: providerRepository.findAllEnabled(),
    ...viewMeta,
  });
});

router.get('/models/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = modelRepository.findById(id);
  if (!model) {
    res.status(404).render('error', { message: 'Модель не найдена' });
    return;
  }
  const { models, ratingsMap } = getEnrichedModelsBundle();
  const modelPath = `/models/${id}`;
  const autoBenchmarkRating = modelRatingRepository.findAutoBenchmarkRating(model.id);
  res.render('detail', {
    model: enrichModelForView(model, ratingsMap.get(model.id) ?? null),
    autoBenchmarkRating,
    ratingFields: RATING_FIELDS,
    models,
    totalCount: models.length,
    shownCount: models.filter((m) => !m.is_hidden).length,
    useCaseCategories: getUseCaseCategoryLabels(),
    ...getViewAuth(req),
    protectedHrefs: {
      chat: resolveProtectedHref(req, `${modelPath}/chat`),
      edit: resolveProtectedHref(req, `${modelPath}/edit`),
      detail: resolveProtectedHref(req, modelPath),
    },
    ...viewMeta,
  });
});

router.get('/models/:id/chat', requireAdminPageAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = modelRepository.findById(id);
  if (!model) {
    res.status(404).render('error', { message: 'Модель не найдена' });
    return;
  }
  const from = typeof req.query.from === 'string' ? req.query.from : '';
  const backHref = from === 'catalog' ? '/' : `/models/${id}`;
  const backLabel = from === 'catalog' ? 'Назад к каталогу' : 'Назад к модели';
  const { models, ratingsMap } = getEnrichedModelsBundle();
  res.render('chat', {
    model: enrichModelForView(model, ratingsMap.get(model.id) ?? null),
    models,
    totalCount: models.length,
    shownCount: models.filter((m) => !m.is_hidden).length,
    useCaseCategories: getUseCaseCategoryLabels(),
    backHref,
    backLabel,
  });
});

router.get('/models/:id/edit', requireAdminPageAuth, (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const model = modelRepository.findById(id);
  if (!model) {
    res.status(404).render('error', { message: 'Модель не найдена' });
    return;
  }
  res.render('form', {
    model,
    providers: providerRepository.findAllEnabled(),
    ...viewMeta,
  });
});

const CATALOG_SOURCE_LABELS: Record<string, string> = {
  bothub: 'BotHub',
  openrouter: 'OpenRouter',
  routerai: 'RouterAI',
  custom: 'Свой источник',
};

const CATALOG_SOURCE_URL_HINTS: Record<string, string> = {
  bothub: 'https://bothub.chat/api/v2/model/list',
  openrouter: 'https://openrouter.ai/api/v1/models',
  routerai: 'https://routerai.ru/api/v1/models',
  custom: 'https://example.com/api/models',
};

const CATALOG_SOURCE_BASE_URL_HINTS: Record<string, string> = {
  bothub: 'https://openai.bothub.chat/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  routerai: 'https://routerai.ru/api/v1',
  custom: 'https://example.com/api/v1',
};

function buildProvidersViewData() {
  const raw = providerRepository.findAll();
  const providers = raw.map((provider) => {
    const pub = toProviderPublic(provider);
    return {
      ...pub,
      modelCount: providerRepository.countModels(provider.id),
    };
  });

  return {
    providers,
    catalogSourceLabels: CATALOG_SOURCE_LABELS,
  };
}

function adminViewData(req: Request, extra: Record<string, unknown> = {}) {
  return {
    authUser: req.authUser ?? null,
    ...extra,
  };
}

router.get('/admin', (req: Request, res: Response) => {
  const modelCount = modelRepository.count();
  res.render('admin', adminViewData(req, { modelCount }));
});

router.get('/admin/providers', (req: Request, res: Response) => {
  res.render('admin-providers', adminViewData(req, buildProvidersViewData()));
});

router.get('/admin/providers/new', (req: Request, res: Response) => {
  res.render('admin-provider-form', adminViewData(req, {
    provider: null,
    catalogSourceLabels: CATALOG_SOURCE_LABELS,
    catalogSourceUrlHints: CATALOG_SOURCE_URL_HINTS,
    catalogSourceBaseUrlHints: CATALOG_SOURCE_BASE_URL_HINTS,
  }));
});

router.get('/admin/providers/:id/edit', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const provider = providerRepository.findById(id);
  if (!provider) {
    res.status(404).render('error', { message: 'Провайдер не найден' });
    return;
  }
  res.render('admin-provider-form', adminViewData(req, {
    provider: toProviderPublic(provider),
    catalogSourceLabels: CATALOG_SOURCE_LABELS,
    catalogSourceUrlHints: CATALOG_SOURCE_URL_HINTS,
    catalogSourceBaseUrlHints: CATALOG_SOURCE_BASE_URL_HINTS,
  }));
});

router.get('/admin/sync', (req: Request, res: Response) => {
  const modelCount = modelRepository.count();
  res.render('admin-sync', adminViewData(req, {
    modelCount,
    families: modelRepository.getFamilies(),
    ...viewMeta,
  }));
});

router.get('/admin/sync/logs', (req: Request, res: Response) => {
  const logs = syncLogRepository.findRecent(100, 0);
  res.render('admin-sync-logs', adminViewData(req, {
    logs,
    totalCount: syncLogRepository.count(),
    kindLabels: SYNC_LOG_KIND_LABELS,
    statusLabels: SYNC_LOG_STATUS_LABELS,
    formatSyncLogDate,
    formatDuration,
  }));
});

router.get('/admin/sync/logs/:id', (req: Request, res: Response) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const log = syncLogRepository.findById(id);
  if (!log) {
    res.status(404).render('error', { message: 'Запись журнала не найдена' });
    return;
  }
  res.render('admin-sync-log', adminViewData(req, {
    log,
    kindLabels: SYNC_LOG_KIND_LABELS,
    statusLabels: SYNC_LOG_STATUS_LABELS,
    formatSyncLogDate,
    formatDuration,
    formatSyncValue,
  }));
});

router.get('/compare', (req: Request, res: Response) => {
  const raw = req.query.ids;
  const ids = typeof raw === 'string'
    ? raw.split(',').filter(Boolean)
    : Array.isArray(raw)
    ? raw.filter((v): v is string => typeof v === 'string')
    : [];
  const ratingsMap = modelRatingRepository.getAverageScoresMap();
  const models = enrichModelsForView(modelRepository.findByIds(ids), ratingsMap);
  res.render('compare', {
    models,
    ratingFields: RATING_FIELDS,
    ...viewMeta,
    ...getViewAuth(req),
  });
});

router.get('/assistant', requireAdminPageAuth, (req: Request, res: Response) => {
  const models = modelRepository.findAll();
  const aiConfig = getAiConfigPublic();
  const analyticsCatalogModel = modelRepository.findByNormalizedName(aiConfig.modelAnalytics);
  res.render('assistant', {
    totalCount: models.length,
    shownCount: models.filter((m) => !m.is_hidden).length,
    aiConfig,
    analyticsModel: analyticsCatalogModel ? enrichModelForView(analyticsCatalogModel) : null,
    ...getViewAuth(req),
  });
});

router.get('/recommendations', (req: Request, res: Response) => {
  res.render('recommendations', { ...getViewAuth(req) });
});

export default router;
