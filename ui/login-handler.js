import { setUsername } from '/core/global-state.js';
import { initializeGame } from '/core/init.js';
import { showNotification } from '/ui/notification.js';

export function setupLoginHandler() {
  const loginBtn = document.getElementById('login-email-btn');
  const emailInput = document.getElementById('email-input');
  const passwordInput = document.getElementById('password-input');

  if (!loginBtn || !emailInput || !passwordInput) {
    console.warn('🔧 Login input/button not found');
    return;
  }

  loginBtn.addEventListener('click', () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showNotification('⚠ Email & password harus diisi');
      return;
    }

    // Simulasi login (belum pakai Firebase Auth)
    const username = email.split('@')[0];
    localStorage.setItem('username', username);
    setUsername(username);

    showNotification(`✅ Login sebagai ${username}`);
    initializeGame(); // reload alur game
  });
}
