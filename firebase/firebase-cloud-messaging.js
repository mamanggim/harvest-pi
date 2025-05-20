import { auth, database, messaging, ref, set } from '../firebase/firebase-config.js';

// Fungsi buat setup FCM
export function setupFCM(user) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/firebase/firebase-messaging-sw.js')
      .then((registration) => {
        alert('Service Worker registered: ' + registration.scope); // Log success
        messaging.useServiceWorker(registration);
        return messaging.getToken({ vapidKey: 'YOUR_VAPID_KEY_HERE' }); // Ganti dengan VAPID key lu
      })
      .then((token) => {
        alert('FCM Token: ' + token); // Log token
        set(ref(database, `adminTokens/${user.uid}`), token);
      })
      .catch((err) => {
        alert('FCM Error: ' + err.message + ' (Code: ' + err.code + ')'); // Log error detail
        showUserNotification('Failed to setup notifications.');
      });
  } else {
    alert('Service Worker not supported in this browser'); // Log kalo gak support
  }
}

// Fungsi buat show FCM Token
export function setupShowFCMToken(showUserNotification) {
  const showTokenBtn = document.getElementById('show-token-btn');
  if (showTokenBtn) {
    alert('Tombol Show FCM Token ditemukan!'); // Log buat cek tombol ada
    showTokenBtn.addEventListener('click', () => {
      alert('Tombol Show FCM Token diklik!'); // Log pas tombol diklik
      if (auth.currentUser) {
        alert('User logged in as admin: ' + auth.currentUser.email); // Log user
        messaging.getToken({ vapidKey: 'YOUR_VAPID_KEY_HERE' }).then((token) => {
          alert('FCM Token: ' + token); // Log token kalo berhasil
          const tokenElement = document.getElementById('fcm-token');
          if (tokenElement) {
            tokenElement.textContent = 'FCM Token: ' + token;
            tokenElement.style.display = 'block';
            navigator.clipboard.writeText(token).then(() => {
              alert('Token berhasil dicopy ke clipboard!'); // Log copy sukses
              showUserNotification('Token copied to clipboard!');
            }).catch((err) => {
              alert('Gagal copy token: ' + err.message); // Log copy gagal
              showUserNotification('Please copy the token manually: ' + token);
            });
          } else {
            alert('Elemen fcm-token gak ditemukan di halaman!'); // Log kalo elemen gak ada
          }
        }).catch((err) => {
          alert('Error ambil token: ' + err.message); // Log error token
          const tokenElement = document.getElementById('fcm-token');
          if (tokenElement) {
            tokenElement.textContent = 'Error getting token: ' + err.message;
            tokenElement.style.display = 'block';
          } else {
            alert('Elemen fcm-token gak ditemukan di halaman!'); // Log kalo elemen gak ada
          }
        });
      } else {
        alert('Belum login sebagai admin!'); // Log kalo belum login
        showUserNotification('Please login as admin first!');
      }
    });
  } else {
    alert('Tombol Show FCM Token gak ditemukan di halaman!'); // Log kalo tombol gak ada
  }
}

// Fungsi showUserNotification (dipindah ke sini biar fcm.js independen)
function showUserNotification(message) {
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 5000);
  }
}
