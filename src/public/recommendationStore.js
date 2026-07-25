if (!window.RecommendationStore) {
  const REC_STORE_PREFIX = 'rec_store_';
  const TTL_MS = 24 * 60 * 60 * 1000;

  function generateToken() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `rec-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function readEntry(token) {
    if (!token) return null;
    try {
      const raw = sessionStorage.getItem(REC_STORE_PREFIX + token);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (parsed.savedAt && Date.now() - parsed.savedAt > TTL_MS) {
        sessionStorage.removeItem(REC_STORE_PREFIX + token);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  window.RecommendationStore = {
    save(result) {
      const token = generateToken();
      const entry = { ...result, savedAt: Date.now() };
      try {
        sessionStorage.setItem(REC_STORE_PREFIX + token, JSON.stringify(entry));
      } catch {
        // ignore storage errors
      }
      return token;
    },

    load(token) {
      return readEntry(token);
    },

    clear(token) {
      if (!token) return;
      try {
        sessionStorage.removeItem(REC_STORE_PREFIX + token);
      } catch {
        // ignore storage errors
      }
    },

    getCatalogUrl(token) {
      return `/?rec=${encodeURIComponent(token)}&view=cards`;
    },

    getRecommendationsUrl(token) {
      return `/recommendations?rec=${encodeURIComponent(token)}`;
    },

    getTokenFromUrl(search = window.location.search) {
      return new URLSearchParams(search).get('rec');
    },
  };
}
