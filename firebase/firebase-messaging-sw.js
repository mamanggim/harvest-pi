importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/9.6.11/firebase-messaging.js');

// Konfigurasi Firebase (harus sama seperti di firebase-config.js)
firebase.initializeApp({
  apiKey: "AIzaSyDi5nCsLUOQNhPG6Bnxgsw8W60ZPaQewgw",
  authDomain: "harvest-pi.firebaseapp.com",
  projectId: "harvest-pi",
  storageBucket: "harvest-pi.firebasestorage.app",
  messagingSenderId: "650006770674",
  appId: "1:650006770674:web:bf6291198fc0a02be7b16b",
  measurementId: "G-HV6J072QQZ"
});

const messaging = firebase.messaging();

// Handler notifikasi latar belakang
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message', payload);

  const data = payload.data || {};
  const notificationTitle = '📥 New Deposit Request';
  const notificationOptions = {
    body: `User: ${data.username || 'Unknown'}, Amount: ${data.amount || '0'} PI`,
    icon: '/assets/img/ui/water_icon.png',
    data: {
      url: '/admin-panel' // Disimpan di data, bukan click_action
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Event saat notifikasi diklik (navigasi ke admin)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const redirectUrl = event.notification.data?.url || '/admin-panel';
  event.waitUntil(clients.openWindow(redirectUrl));
});
