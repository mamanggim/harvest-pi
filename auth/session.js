// session.js
// Session Manager untuk Harvest Pi
// Fitur: Login/Register toggle, Session persistence, Auto-redirect, dan session checker

// ===== UI TOGGLES ===== //
export function switchToLogin() {
  try {
    const loginScreen = document.getElementById('login-screen');
    const registerScreen = document.getElementById('register-screen');
    const loadingIndicator = document.getElementById('auth-loading');

    if (loginScreen) {
      loginScreen.style.display = 'flex';
      loginScreen.classList.remove('hidden');
    }
    if (registerScreen) registerScreen.classList.add('hidden');
    if (loadingIndicator) loadingIndicator.style.display = 'none';

    const usernameField = document.getElementById('login-username');
    if (usernameField) setTimeout(() => usernameField.focus(), 100);
  } catch (err) {
    console.error('Failed to switch to login:', err);
  }
}

export function switchToRegister() {
  try {
    const loginScreen = document.getElementById('login-screen');
    const registerScreen = document.getElementById('register-screen');
    const loadingIndicator = document.getElementById('auth-loading');

    if (registerScreen) {
      registerScreen.style.display = 'flex';
      registerScreen.classList.remove('hidden');
    }
    if (loginScreen) loginScreen.classList.add('hidden');
    if (loadingIndicator) loadingIndicator.style.display = 'none';

    const emailField = document.getElementById('register-email');
    if (emailField) setTimeout(() => emailField.focus(), 100);
  } catch (err) {
    console.error('Failed to switch to register:', err);
  }
}

// ===== SESSION MANAGEMENT ===== //
export function checkActiveSession() {
  return new Promise((resolve) => {
    try {
      const userKey = localStorage.getItem('userKey');
      const sessionExpiry = localStorage.getItem('sessionExpiry');

      if (userKey && sessionExpiry && Date.now() < Number(sessionExpiry)) {
        resolve({ isValid: true, userKey });
      } else {
        clearSession();
        resolve({ isValid: false });
      }
    } catch (err) {
      console.error('Session check error:', err);
      resolve({ isValid: false });
    }
  });
}

export function clearSession() {
  localStorage.removeItem('userKey');
  localStorage.removeItem('sessionExpiry');
  localStorage.removeItem('username');
}

export function createSession(userKey, username, rememberMe = false) {
  const expiryTime = rememberMe
    ? Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 hari
    : Date.now() + 2 * 60 * 60 * 1000; // 2 jam

  localStorage.setItem('userKey', userKey);
  localStorage.setItem('username', username);
  localStorage.setItem('sessionExpiry', expiryTime.toString());
}

// Untuk validasi session di init.js
export async function checkSessionValidity(username) {
  if (!username) return false;

  const sessionExpiry = localStorage.getItem('sessionExpiry');
  if (!sessionExpiry || Date.now() > Number(sessionExpiry)) return false;

  // Kamu bisa tambahkan validasi backend di sini
  return true;
}

export function forceLogout() {
  clearSession();
  location.reload();
}

// ===== INITIALIZATION ===== //
export function initSessionToggle() {
  try {
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    const backToLogin = document.getElementById('back-to-login');

    const safeAddListener = (el, evt, handler) => {
      if (el) {
        el.removeEventListener(evt, handler);
        el.addEventListener(evt, handler);
      }
    };

    safeAddListener(registerLink, 'click', (e) => {
      e.preventDefault();
      switchToRegister();
    });

    safeAddListener(loginLink, 'click', (e) => {
      e.preventDefault();
      switchToLogin();
    });

    safeAddListener(backToLogin, 'click', (e) => {
      e.preventDefault();
      switchToLogin();
    });

    // Default ke login
    switchToLogin();

    checkActiveSession().then(({ isValid }) => {
      if (isValid) {
        const loading = document.getElementById('loading-screen');
        if (loading) loading.style.display = 'none';
      }
    });
  } catch (err) {
    console.error('Failed to init session toggle:', err);
  }
}

// Auto setup saat DOM siap
document.addEventListener('DOMContentLoaded', () => {
  initSessionToggle();

  window.addEventListener('popstate', () => {
    const registerScreen = document.getElementById('register-screen');
    if (registerScreen && !registerScreen.classList.contains('hidden')) {
      switchToLogin();
    }
  });
});
