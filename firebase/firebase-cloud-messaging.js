import { auth, database, messaging, ref, set } from '../firebase/firebase-config.js';

// Fungsi setup FCM untuk admin
export function setupFCM(user) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase/firebase-messaging-sw.js')
      .then((registration) => {
        messaging.useServiceWorker(registration);
        return messaging.getToken({ vapidKey: 'ISI_VAPID_KEY_ASLI_MU_DI_SINI' });
      })
      .then((token) => {
        if (token) {
          set(ref(database, `adminTokens/${user.username}`), token);
          showUserNotification('FCM token saved.');
        }
      })
      .catch((err) => {
        console.error('FCM setup error:', err);
        showUserNotification('Failed to setup notifications.');
      });
  } else {
    showUserNotification('Browser does not support Service Worker.');
  }
}

// Opsional: tombol tampilkan token manual
export function setupShowFCMToken() {
  const showTokenBtn = document.getElementById('show-token-btn');
  const tokenElement = document.getElementById('fcm-token');

  if (!showTokenBtn || !tokenElement) return;

  showTokenBtn.addEventListener('click', () => {
    if (!auth.currentUser) {
      showUserNotification('Please login as admin first!');
      return;
    }

    messaging.getToken({ vapidKey: 'ISI_VAPID_KEY_ASLI_MU_DI_SINI' })
      .then((token) => {
        tokenElement.textContent = `FCM Token: ${token}`;
        tokenElement.style.display = 'block';

        navigator.clipboard.writeText(token)
          .then(() => showUserNotification('Token copied to clipboard!'))
          .catch(() => showUserNotification('Copy failed. Copy manually.'));
      })
      .catch((err) => {
        console.error('Token error:', err);
        tokenElement.textContent = `Error: ${err.message}`;
        tokenElement.style.display = 'block';
      });
  });
}

// Fungsi notifikasi bawaan
function showUserNotification(message) {
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => (notification.style.display = 'none'), 5000);
  }
}
