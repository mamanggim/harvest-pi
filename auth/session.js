// Session Manager untuk Harvest Pi
// Fitur: Login/Register toggle, Session persistence, dan Auto-redirect

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
    
    // Auto-focus ke username field
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
    
    // Auto-focus ke email field
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
      
      // Validasi session expiry
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
  const expiryTime = rememberMe ? 
    Date.now() + (30 * 24 * 60 * 60 * 1000) : // 30 hari
    Date.now() + (2 * 60 * 60 * 1000); // 2 jam
  
  localStorage.setItem('userKey', userKey);
  localStorage.setItem('username', username);
  localStorage.setItem('sessionExpiry', expiryTime.toString());
}

// ===== INITIALIZATION ===== //
export function initSessionToggle() {
  try {
    // Event listeners untuk toggle form
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    const backToLogin = document.getElementById('back-to-login');

    const safeAddListener = (element, event, handler) => {
      if (element) {
        element.removeEventListener(event, handler);
        element.addEventListener(event, handler);
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

    // Default state
    switchToLogin();
    
    // Cek session saat init
    checkActiveSession().then(({ isValid }) => {
      if (isValid) {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) loadingScreen.style.display = 'none';
      }
    });
  } catch (err) {
    console.error('Failed to init session toggle:', err);
  }
}

// Mobile-friendly touch events
document.addEventListener('DOMContentLoaded', () => {
  initSessionToggle();
  
  // Handle Android back button
  window.addEventListener('popstate', () => {
    const registerScreen = document.getElementById('register-screen');
    if (registerScreen && !registerScreen.classList.contains('hidden')) {
      switchToLogin();
    }
  });
});
