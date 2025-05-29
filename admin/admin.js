import { auth, onAuthStateChanged, signOut } from '../firebase/firebase-config.js';

console.log('admin.js loaded, auth:', auth); // Debug

document.addEventListener('DOMContentLoaded', () => {
  // Delay biar auth state siap
  setTimeout(() => {
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
    }, (error) => {
      console.error('Auth state error:', error); // Debug
    });
  }, 2000); // Delay 2 detik

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
});
