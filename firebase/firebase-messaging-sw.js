importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/9.x.x/firebase-messaging.js');

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

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = 'New Deposit Request';
  const notificationOptions = {
    body: `User: ${payload.data.userId}, Amount: ${payload.data.amount} PI`,
    icon: '/assets/img/ui/water_icon.png', // Icon notifikasi
    click_action: '/admin-panel'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
