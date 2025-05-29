import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, onValue, set, get, update } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

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
const database = getDatabase(app);

function encodeEmail(email) {
  return email.replace('@', '_at_').replace('.', '_dot_');
}

function showUserNotification(message) {
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 5000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  let isLoggingOut = false;

  setTimeout(() => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        showUserNotification('Please login first.');
        sessionStorage.setItem('adminRedirect', 'true');
        window.location.href = '/index.html';
        return;
      }

      const encodedEmail = encodeEmail(user.email);
      const roleRef = ref(database, `players/${encodedEmail}/role`);
      const roleSnap = await get(roleRef);
      const role = roleSnap.val();

      if (role !== 'admin') {
        showUserNotification('Access denied. Admins only.');
        await signOut(auth);
        sessionStorage.setItem('adminRedirect', 'true');
        window.location.href = '/index.html';
        return;
      }

      // Lanjut load dashboard
    });
  }, 1000);

  // Logout Button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      if (isLoggingOut) return;
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

  // Tampilkan Transaksi
  const transactionsRef = ref(database, 'transactions');
  onValue(transactionsRef, (snapshot) => {
    const transactions = snapshot.val();
    const depositItems = document.getElementById('deposit-items');
    const pendingCount = document.getElementById('pending-count');
    const approvedToday = document.getElementById('approved-today');

    depositItems.innerHTML = '';
    let pending = 0;
    let approvedTodayCount = 0;
    const today = new Date().toISOString().split('T')[0];

    if (transactions) {
      for (const id in transactions) {
        const t = transactions[id];
        if (!['deposit', 'withdraw'].includes(t.type)) continue;

        if (t.status === 'pending') pending++;
        if (t.status === 'approved' && new Date(t.timestamp).toISOString().split('T')[0] === today) {
          approvedTodayCount++;
        }

        const timeLeft = t.expiresAt ? Math.max(0, Math.floor((t.expiresAt - Date.now()) / 1000)) : 0;

        depositItems.innerHTML += `
          <tr>
            <td class="text-limit">${t.email}</td>
            <td>${t.amount} PI</td>
            <td class="text-limit">${t.memo || '-'}</td>
            <td class="text-limit">${new Date(t.timestamp).toLocaleString()}</td>
            <td>${t.status}</td>
            <td id="countdown-${id}">${timeLeft}s</td>
            <td>
              ${t.status === 'pending' ? `
                <button class="game-button" data-id="${id}" data-action="approve">Approve</button>
                <button class="game-button" data-id="${id}" data-action="reject">Reject</button>
              ` : '-'}
            </td>
          </tr>
        `;

        // Countdown timeout cancel
        if (t.status === 'pending' && timeLeft > 0) {
          const countdownEl = document.getElementById(`countdown-${id}`);
          const interval = setInterval(() => {
            const newTime = Math.max(0, Math.floor((t.expiresAt - Date.now()) / 1000));
            countdownEl.textContent = `${newTime}s`;
            if (newTime <= 0) {
              clearInterval(interval);
              update(ref(database, `transactions/${id}`), { status: 'cancelled' });
            }
          }, 1000);
        }
      }
    }

    pendingCount.textContent = pending;
    approvedToday.textContent = approvedTodayCount;

    // Event listener tombol approve/reject
    depositItems.querySelectorAll('.game-button').forEach(btn => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      btn.addEventListener('click', () => {
        if (action === 'approve') approveTransaction(id);
        else if (action === 'reject') rejectTransaction(id);
      });
    });
  });

  async function approveTransaction(id) {
    const transRef = ref(database, `transactions/${id}`);
    const snap = await get(transRef);
    const data = snap.val();
    if (!data || data.status !== 'pending') return;

    const email = data.email;
    const encodedEmail = encodeEmail(email);
    const userRef = ref(database, `players/${encodedEmail}`);
    const userSnap = await get(userRef);
    const user = userSnap.val();
    if (!user) return;

    const amount = parseFloat(data.amount);
    if (data.type === 'deposit') {
      await update(userRef, { piBalance: (user.piBalance || 0) + amount });
    } else if (data.type === 'withdraw') {
      if ((user.piBalance || 0) < amount) {
        showUserNotification('Insufficient balance.');
        return;
      }
      await update(userRef, { piBalance: (user.piBalance || 0) - amount });
    }

    await update(transRef, { status: 'approved', processedAt: Date.now() });
    await set(ref(database, `notifications/${encodedEmail}/${id}`), {
      message: `${data.type} of ${amount} PI approved.`,
      timestamp: Date.now(),
      read: false
    });

    showUserNotification(`${data.type} approved: ${amount} PI`);
  }

  async function rejectTransaction(id) {
    const transRef = ref(database, `transactions/${id}`);
    const snap = await get(transRef);
    const data = snap.val();
    if (!data || data.status !== 'pending') return;

    await update(transRef, { status: 'rejected', processedAt: Date.now() });

    const encodedEmail = encodeEmail(data.email);
    await set(ref(database, `notifications/${encodedEmail}/${id}`), {
      message: `${data.type} of ${data.amount} PI rejected.`,
      timestamp: Date.now(),
      read: false
    });

    showUserNotification(`${data.type} rejected: ${data.amount} PI`);
  }
});
