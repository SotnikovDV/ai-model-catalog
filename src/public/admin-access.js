(function initAdminAccess() {
  function needsLogin() {
    return Boolean(window.ADMIN_AUTH?.enabled && !window.ADMIN_AUTH?.authenticated);
  }

  function loginHref(path) {
    return `/login?next=${encodeURIComponent(path)}`;
  }

  function protectedHref(path) {
    return needsLogin() ? loginHref(path) : path;
  }

  function guardAction(event, targetPath) {
    if (!needsLogin()) return true;
    event.preventDefault();
    event.stopPropagation();
    window.location.href = protectedHref(targetPath);
    return false;
  }

  window.AdminAccess = {
    needsLogin,
    loginHref,
    protectedHref,
    guardAction,
  };
})();
