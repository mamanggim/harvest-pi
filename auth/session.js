// ===== UI TOGGLES ===== //
export function switchToLogin() {
  const loginScreen = document.getElementById('login-screen');
  const registerScreen = document.getElementById('register-screen');
  const loadingIndicator = document.getElementById('auth-loading');

  if (loginScreen) loginScreen.style.display = 'flex';
  if (registerScreen) registerScreen.style.display = 'none';
  if (loadingIndicator) loadingIndicator.style.display = 'none';
}

export function switchToRegister() {
  const loginScreen = document.getElementById('login-screen');
  const registerScreen = document.getElementById('register-screen');
  const loadingIndicator = document.getElementById('auth-loading');

  if (registerScreen) registerScreen.style.display = 'flex';
  if (loginScreen) loginScreen.style.display = 'none';
  if (loadingIndicator) loadingIndicator.style.display = 'none';
}

// ===== SESSION MANAGEMENT ===== //
export function checkSessionValidity(username) {
  if (!username) return false;

  const storedKey = localStorage.getItem('userKey');
  const expiry = localStorage.getItem('sessionExpiry');

  if (!storedKey || !expiry) return false;

  return Date.now() < Number(expiry);
}

export function forceLogout() {
  localStorage.removeItem('userKey');
  localStorage.removeItem('username');
  localStorage.removeItem('sessionExpiry');
  window.location.reload();
}

export function createSession(userKey, username, rememberMe = false) {
  const expiryTime = rememberMe
    ? Date.now() + 30 * 24 * 60 * 60 * 1000 // 30 hari
    : Date.now() + 2 * 60 * 60 * 1000;      // 2 jam

  localStorage.setItem('userKey', userKey);
  localStorage.setItem('username', username);
  localStorage.setItem('sessionExpiry', expiryTime.toString());
}

// ===== SESSION TOGGLE INIT ===== //
export function initSessionToggle() {
  const registerLink = document.getElementById('register-link');
  const loginLink = document.getElementById('login-link');

  if (registerLink) {
    registerLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchToRegister();
    });
  }

  if (loginLink) {
    loginLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchToLogin();
    });
  }

  switchToLogin();
}
