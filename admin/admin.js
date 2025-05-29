import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyDi5nCsLUOQNhPG6Bnxgsw8W60ZPaQewgw",
  authDomain: "harvest-pi.firebaseapp.com",
  databaseURL: "https://harvest-pi-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "harvest-pi",
  storageBucket: "harvest-pi.firebasestorage.app",
  messagingSenderId: "650006770674",
  appId: "1:650006770674:web:bf6291198fc0a02be7b16b",
  measurementId: "G-HV6J072QQZ"
};

const app = initializeApp(firebaseConfig, 'adminApp');
const auth = getAuth(app);

console.log('admin.js loaded, auth:', auth); // Debug

// Cek auth state
onAuthStateChanged(auth, (user) => {
  console.log('Auth state changed, user:', user); // Debug
  if (!user) {
    console.log('No user, redirecting to login'); // Debug
    const notification = document.getElementById('notification');
    if (notification) {
      notification.textContent = 'Please login first.';
      notification.style.display = 'block';
      setTimeout(() => notification.style.display = 'none', 5000);
    }
    sessionStorage.setItem('adminRedirect', 'true');
    window.location.href = '/index.html';
    return;
  }
  console.log('User logged in:', user.email); // Debug
});

// Logout
const logoutBtn = document.getElementById('logout-btn');
if (logoutBtn) {
  console.log('Logout button found:', logoutBtn); // Debug
  logoutBtn.addEventListener('click', async () => {
    console.log('Logout button clicked'); // Debug
    try {
      if (!auth) throw new Error('Auth object undefined');
      await signOut(auth);
      console.log('Sign out successful'); // Debug
      sessionStorage.setItem('adminRedirect', 'true');
      window.location.href = '/index.html';
    } catch (error) {
      console.error('Logout error:', error.message); // Debug
      const notification = document.getElementById('notification');
      if (notification) {
        notification.textContent = `Error logging out: ${error.message}`;
        notification.style.display = 'block';
        setTimeout(() => notification.style.display = 'none', 5000);
      }
    }
  });
} else {
  console.error('Logout button not found'); // Debug
}
