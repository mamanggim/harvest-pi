const registerEmailBtn = document.getElementById('register-email-btn');
const registerEmailInput = document.getElementById('register-email-input');
const registerPasswordInput = document.getElementById('register-password-input');
const registerUsernameInput = document.getElementById('register-username-input');
const registerError = document.getElementById('register-error');

import {
  createUserWithEmailAndPassword,
  sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import { ref, set, get } from '/firebase/firebase-config.js';
import { showNotification } from '/ui/notification.js';
import { switchToLogin } from './login.js';

export function initRegisterHandler() {
  const registerBtn = document.getElementById('register-email-btn');
  const emailInput = document.getElementById('register-email-input');
  const passwordInput = document.getElementById('register-password-input');
  const usernameInput = document.getElementById('register-username-input');
  const errorEl = document.getElementById('register-error');

  if (!registerBtn) return;

  registerBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const inputUsername = usernameInput?.value.trim() || '';

    errorEl.style.display = 'none';

    if (!email || !password || !inputUsername) {
      errorEl.style.display = 'block';
      errorEl.textContent = 'Please enter email, password, and username.';
      return;
    }

    try {
      const normalizedUsername = inputUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedUsername.length < 3) {
        throw new Error('Username must be at least 3 characters and only use letters/numbers.');
      }

      const playerRef = ref(database, `players/${normalizedUsername}`);
      const snapshot = await get(playerRef);
      if (snapshot.exists()) throw new Error('Username already taken.');

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await set(playerRef, {
        email,
        username: normalizedUsername,
        role: 'user',
        status: 'pending',
        farmCoins: 0,
        piBalance: 0,
        water: 0,
        level: 1,
        xp: 0,
        inventory: [],
        farmPlots: [],
        harvestCount: 0,
        achievements: { harvest: false, coins: false },
        lastClaim: null,
        claimedToday: false,
        totalDeposit: 0,
        referralEarnings: 0
      });

      await sendEmailVerification(user);

      errorEl.style.display = 'block';
      errorEl.textContent = 'Registration successful! Please verify your email.';
      showNotification('Registration successful! Check your email for verification.');

      emailInput.value = '';
      passwordInput.value = '';
      if (usernameInput) usernameInput.value = '';
      switchToLogin();
    } catch (error) {
      errorEl.style.display = 'block';
      errorEl.textContent = `Registration failed: ${error.message}`;
      console.error('Registration error:', error);
    }
  });
}
