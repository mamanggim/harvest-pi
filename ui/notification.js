// === UI Notification (Popup alert) ===
export function showNotification(message) {
  const el = document.getElementById('notification');
  if (!el) return;

  el.textContent = message;
  el.style.display = 'block';
  setTimeout(() => {
    el.style.display = 'none';
  }, 3000);
}

// === Floating Transaction Animation (ex: +100 FC) ===
export function showTransactionAnimation(amount, isPositive = true, targetEl = null) {
  const anim = document.createElement('div');
  anim.classList.add('transaction-animation', isPositive ? 'positive' : 'negative');
  anim.textContent = amount;

  document.body.appendChild(anim);

  const rect = targetEl?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 0 };
  anim.style.left = `${rect.left + rect.width / 2}px`;
  anim.style.top = `${rect.top - 20}px`;

  setTimeout(() => anim.remove(), 1000);
}
