import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, onValue, set, get, update } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// Konfigurasi Firebase
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

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
  let isLoggingOut = false;
  let lastNotificationTime = 0;

  // Logout tombol
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      console.log('Logout clicked');
      isLoggingOut = true;
      try {
        await signOut(auth);
        sessionStorage.setItem('adminRedirect', 'true');
        window.location.href = '/index.html';
      } catch (error) {
        isLoggingOut = false;
        console.error('Logout error:', error.message);
        showUserNotification(`Error logging out: ${error.message}`);
      }
    });
  }

  // Auth state listener
  onAuthStateChanged(auth, async (user) => {
    if (!user && !isLoggingOut) {
      sessionStorage.setItem('adminRedirect', 'true');
      window.location.href = '/index.html';
      return;
    }

    if (user) {
      const encodedEmail = encodeEmail(user.email);
      try {
        const snapshot = await get(ref(database, `players/${encodedEmail}/role`));
        const role = snapshot.val();
        if (role !== 'admin') {
          showUserNotification('Access denied. Admin only.');
          isLoggingOut = true;
          await signOut(auth);
          sessionStorage.setItem('adminRedirect', 'true');
          window.location.href = '/index.html';
        }
      } catch (err) {
        console.error('Error checking role:', err.message);
        isLoggingOut = true;
        await signOut(auth);
        sessionStorage.setItem('adminRedirect', 'true');
        window.location.href = '/index.html';
      }
    }
  });

  // Load transaksi
  onValue(ref(database, 'transactions'), (snapshot) => {
    const transactions = snapshot.val();
    const depositItems = document.getElementById('deposit-items');
    const pendingCount = document.getElementById('pending-count');
    const approvedToday = document.getElementById('approved-today');

    if (depositItems && pendingCount && approvedToday) {
      depositItems.innerHTML = '';
      let pending = 0;
      let approvedTodayCount = 0;
      const today = new Date().toISOString().split('T')[0];

      if (transactions) {
        for (const id in transactions) {
          const t = transactions[id];
          if (t.type === 'deposit' || t.type === 'withdraw') {
            if (t.status === 'pending') {
              pending++;
              if (Date.now() - lastNotificationTime > 60000) {
                showUserNotification(`New ${t.type} request from ${t.email} for ${t.amount} PI`);
                lastNotificationTime = Date.now();
              }
            }
            if (t.status === 'approved' && new Date(t.timestamp).toISOString().split('T')[0] === today) {
              approvedTodayCount++;
            }

            let timeLeft = t.expiresAt ? Math.max(0, Math.floor((t.expiresAt - Date.now()) / 1000)) : 0;
            if (timeLeft <= 0 && t.status === 'pending') {
              update(ref(database, `transactions/${id}`), { status: 'cancelled' });
              continue;
            }

            depositItems.innerHTML += `
              <tr>
                <td class="text-limit">${t.email}</td>
                <td>${t.amount} PI</td>
                <td class="text-limit">${t.memo || '-'}</td>
                <td class="text-limit">${new Date(t.timestamp).toLocaleString()}</td>
                <td>${t.status}</td>
                <td id="countdown-${id}">${timeLeft} sec</td>
                <td>
                  ${t.status === 'pending' ? `
                    <button class="game-button" data-id="${id}" data-action="approve">Approve</button>
                    <button class="game-button" data-id="${id}" data-action="reject">Reject</button>
                  ` : '-'}
                </td>
              </tr>
            `;

            if (t.status === 'pending') {
              const countdownElement = document.getElementById(`countdown-${id}`);
              const interval = setInterval(() => {
                timeLeft--;
                if (countdownElement) {
                  countdownElement.textContent = `${timeLeft} sec`;
                  if (timeLeft <= 0) {
                    clearInterval(interval);
                    update(ref(database, `transactions/${id}`), { status: 'cancelled' });
                  }
                }
              }, 1000);
            }
          }
        }
      }

      pendingCount.textContent = pending;
      approvedToday.textContent = approvedTodayCount;

      const buttons = depositItems.querySelectorAll('.game-button');
      buttons.forEach((btn) => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        btn.addEventListener('click', () => {
          if (action === 'approve') approveTransaction(id);
          else if (action === 'reject') rejectTransaction(id);
        });
      });
    }
  });

  async function approveTransaction(id) {
    try {
      const txRef = ref(database, `transactions/${id}`);
      const snap = await get(txRef);
      const tx = snap.val();
      if (!tx || tx.status !== 'pending') return;

      const encodedEmail = encodeEmail(tx.email);
      const userRef = ref(database, `players/${encodedEmail}`);
      const userSnap = await get(userRef);
      const userData = userSnap.val();

      if (!userData) return;

      const amount = parseFloat(tx.amount);
      if (tx.type === 'deposit') {
        await update(userRef, { piBalance: (userData.piBalance || 0) + amount });
      } else if (tx.type === 'withdraw') {
        if ((userData.piBalance || 0) < amount) return;
        await update(userRef, { piBalance: (userData.piBalance || 0) - amount });
      }

      await update(txRef, {
        status: 'approved',
        processedAt: Date.now()
      });

      await set(ref(database, `notifications/${encodedEmail}/${id}`), {
        message: `${tx.type} of ${amount} PI approved.`,
        timestamp: Date.now(),
        read: false
      });

      showUserNotification(`${tx.type} ${amount} PI approved!`);
    } catch (err) {
      showUserNotification(`Failed to approve transaction.`);
    }
  }

  async function rejectTransaction(id) {
    try {
      const txRef = ref(database, `transactions/${id}`);
      const snap = await get(txRef);
      const tx = snap.val();
      if (!tx || tx.status !== 'pending') return;

      await update(txRef, {
        status: 'rejected',
        processedAt: Date.now()
      });

      const encodedEmail = encodeEmail(tx.email);
      await set(ref(database, `notifications/${encodedEmail}/${id}`), {
        message: `${tx.type} of ${tx.amount} PI rejected. Contact admin.`,
        timestamp: Date.now(),
        read: false
      });

      showUserNotification(`${tx.type} ${tx.amount} PI rejected.`);
    } catch {
      showUserNotification(`Failed to reject transaction.`);
    }
  }

  function showUserNotification(msg) {
    const notif = document.getElementById('notification');
    if (notif) {
      notif.textContent = msg;
      notif.style.display = 'block';
      setTimeout(() => notif.style.display = 'none', 5000);
    }
  }

  function encodeEmail(email) {
    return email.replace('@', '_at_').replace(/\./g, '_dot_');
  }
});
