function authFetch(url, options = {}) {
  return fetch(url, {
    credentials: 'include',
    ...options,
  });
}

window.authFetch = authFetch;

async function logoutAdmin() {
  await authFetch('/api/auth/logout', { method: 'POST' });
  window.location.href = '/login';
}

window.logoutAdmin = logoutAdmin;
