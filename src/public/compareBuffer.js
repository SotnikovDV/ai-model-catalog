const COMPARE_BUFFER_KEY = 'compare_buffer';
const COMPARE_BUFFER_EVENT = 'compare-buffer-changed';

function readIds() {
  try {
    const raw = sessionStorage.getItem(COMPARE_BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((id) => typeof id === 'string' && id))];
  } catch {
    return [];
  }
}

function writeIds(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  try {
    sessionStorage.setItem(COMPARE_BUFFER_KEY, JSON.stringify(unique));
  } catch {
    // ignore storage errors
  }
  document.dispatchEvent(new CustomEvent(COMPARE_BUFFER_EVENT, { detail: { ids: unique } }));
}

function getCompareUrl(ids = readIds()) {
  if (!ids.length) return '/compare';
  return `/compare?ids=${ids.map(encodeURIComponent).join(',')}`;
}

window.CompareBuffer = {
  getIds: readIds,
  has(id) {
    return readIds().includes(id);
  },
  add(id) {
    if (!id) return readIds();
    const ids = readIds();
    if (!ids.includes(id)) {
      writeIds([...ids, id]);
    }
    return readIds();
  },
  remove(id) {
    writeIds(readIds().filter((item) => item !== id));
    return readIds();
  },
  toggle(id) {
    if (!id) return readIds();
    if (readIds().includes(id)) {
      return window.CompareBuffer.remove(id);
    }
    return window.CompareBuffer.add(id);
  },
  setIds(ids) {
    writeIds(ids);
    return readIds();
  },
  getUrl: getCompareUrl,
  syncFromUrl(search = window.location.search) {
    const raw = new URLSearchParams(search).get('ids');
    if (!raw) return readIds();
    const ids = raw.split(',').map((id) => id.trim()).filter(Boolean);
    writeIds(ids);
    return ids;
  },
  onChange(callback) {
    document.addEventListener(COMPARE_BUFFER_EVENT, callback);
  },
};
