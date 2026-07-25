function isSafeRedirect(path) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  if (!form) return;

  const errorEl = document.getElementById('loginError');
  const submitBtn = form.querySelector('button[type="submit"]');
  const passwordInput = document.getElementById('loginPassword');
  const passwordToggle = document.getElementById('loginPasswordToggle');
  const nextPath = isSafeRedirect(window.__LOGIN_NEXT__) ? window.__LOGIN_NEXT__ : '/admin';

  if (passwordInput && passwordToggle) {
    const showIcon = passwordToggle.querySelector('.password-toggle-icon--show');
    const hideIcon = passwordToggle.querySelector('.password-toggle-icon--hide');

    passwordToggle.addEventListener('click', () => {
      const isHidden = passwordInput.type === 'password';
      passwordInput.type = isHidden ? 'text' : 'password';
      passwordToggle.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
      passwordToggle.setAttribute('aria-label', isHidden ? 'Скрыть пароль' : 'Показать пароль');
      if (showIcon) showIcon.hidden = isHidden;
      if (hideIcon) hideIcon.hidden = !isHidden;
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (errorEl) errorEl.hidden = true;

    const formData = new FormData(form);
    const payload = {
      username: String(formData.get('username') ?? '').trim(),
      password: String(formData.get('password') ?? ''),
    };

    if (submitBtn) submitBtn.disabled = true;

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        const message = result?.error
          || (Array.isArray(result?.issues) ? result.issues.map((i) => i.message).join('\n') : null)
          || 'Не удалось войти';
        if (errorEl) {
          errorEl.textContent = message;
          errorEl.hidden = false;
        }
        return;
      }

      window.location.href = nextPath;
    } catch {
      if (errorEl) {
        errorEl.textContent = 'Не удалось выполнить вход';
        errorEl.hidden = false;
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
});
