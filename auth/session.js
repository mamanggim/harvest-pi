// Tampilkan form login, sembunyikan register
export function switchToLogin() {
  const loginScreen = document.getElementById('login-screen');
  const registerScreen = document.getElementById('register-screen');
  if (loginScreen) loginScreen.style.display = 'flex';
  if (registerScreen) registerScreen.style.display = 'none';
}

// Tampilkan form register, sembunyikan login
export function switchToRegister() {
  const loginScreen = document.getElementById('login-screen');
  const registerScreen = document.getElementById('register-screen');
  if (loginScreen) loginScreen.style.display = 'none';
  if (registerScreen) registerScreen.style.display = 'flex';
}

// Jalankan saat DOM ready
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

  switchToLogin(); // default: tampilkan login screen
}
