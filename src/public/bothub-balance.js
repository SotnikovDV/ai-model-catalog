(function () {
  const pills = document.querySelectorAll('[data-bothub-balance]');
  if (!pills.length) return;

  const valueEls = document.querySelectorAll('[data-bothub-balance-value]');

  function showUnavailable() {
    valueEls.forEach((el) => {
      el.textContent = 'н/д';
    });
    pills.forEach((el) => {
      el.hidden = false;
      el.setAttribute('title', 'Не удалось получить баланс BotHub');
    });
  }

  function showBalance(balance) {
    const formatted = Number(balance).toLocaleString('ru-RU', {
      maximumFractionDigits: 2,
    });
    valueEls.forEach((el) => {
      el.textContent = formatted;
    });
    pills.forEach((el) => {
      el.hidden = false;
      el.setAttribute('title', 'Баланс BotHub');
    });
  }

  fetch('/api/bothub/balance', { credentials: 'same-origin' })
    .then(async (res) => {
      if (!res.ok) {
        showUnavailable();
        return;
      }
      const data = await res.json();
      if (typeof data.balance !== 'number' || !Number.isFinite(data.balance)) {
        showUnavailable();
        return;
      }
      showBalance(data.balance);
    })
    .catch(() => {
      showUnavailable();
    });
})();
