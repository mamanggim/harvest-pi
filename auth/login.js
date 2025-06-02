const loginEmailBtn = document.getElementById('login-email-btn');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const verifyEmailMsg = document.getElementById('verify-status');

import {
  signInWithEmailAndPassword,
  sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import { auth, database, ref, get, update, onValue } from '/firebase/firebase-config.js';
import { addSafeClickListener } from '/core/utils.js';
import { showNotification } from '/ui/notification.js';
import { loadPlayerData } from '/core/user-loader.js';
import { updateReferralLink } from '/auth/referral.js';
import { encodeEmail, resolveUserKey } from '/core/utils.js';

// Elemen DOM
const loginEmailBtn = document.getElementById('login-email-btn');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const verifyEmailMsg = document.getElementById('verify-status');

// Handler Login
if (loginEmailBtn) {
  addSafeClickListener(loginEmailBtn, async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      loginError.textContent = 'Please enter email and password.';
      loginError.style.display = 'block';
      return;
    }

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        loginError.textContent = 'Please verify your email.';
        loginError.style.display = 'block';
        verifyEmailMsg.style.display = 'block';
        return;
      }

      const playersSnapshot = await get(ref(database, 'players'));
      const players = playersSnapshot.val() || {};
      const foundUsername = Object.keys(players).find(key => players[key].email === email);

      if (!foundUsername) throw new Error('User not found in players database.');

      const playerData = players[foundUsername];
      if (!playerData) throw new Error('Player data missing.');
      if (playerData.status !== 'approved') {
        throw new Error(`Account ${playerData.status}. Contact admin.`);
      }

      const role = playerData.role || 'user';
      const encodedEmail = encodeEmail(email);
      const userKey = resolveUserKey(role, email, foundUsername);

      // Simpan ke localStorage
      localStorage.setItem('username', foundUsername);
      localStorage.setItem('email', email);
      localStorage.setItem('role', role);
      localStorage.setItem('encodedEmail', encodedEmail);
      localStorage.setItem('userKey', userKey);

      // Notifikasi realtime
      const notifRef = ref(database, `notifications/${userKey}`);
      onValue(notifRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          Object.entries(data).forEach(([id, notif]) => {
            if (!notif.read) {
              showNotification(notif.message);
              update(ref(database, `notifications/${userKey}/${id}`), { read: true });
            }
          });
        }
      });

      showNotification(`Logged in as ${email}`);

      // Redirect
      if (role === 'admin') {
        window.location.href = '/admin/admin.html';
      } else {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
      }

      loadPlayerData(userKey);
      updateReferralLink();

    } catch (error) {
      console.error('Login error:', error.message);
      loginError.textContent = error.message;
      loginError.style.display = 'block';
    }
  });
}
