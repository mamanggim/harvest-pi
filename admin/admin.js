// admin.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getDatabase, ref, get, update, onValue, set } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

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
    setTimeout(() => (notification.style.display = 'none'), 5000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  let isLoggingOut = false;
  let lastNotificationTime = 0;

  // Auth Check
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      sessionStorage.setItem('adminRedirect', 'true');
      window.location.href = '/index.html';
      return;
    }

    const email = user.email;
    const encodedEmail = encodeEmail(email);
    try {
      const roleSnap = await get(ref(database, `players/${encodedEmail}/role`));
      const role = roleSnap.exists() ? roleSnap.val() : null;
      console.log("Role ditemukan:", role);

      if (role !== 'admin') {
        showUserNotification('Access denied. Admins only.');
        await signOut(auth);
        sessionStorage.setItem('adminRedirect', 'true');
        window.location.href = '/index.html';
      }
    } catch (error) {
      console.error("Role check failed:", error);
      await signOut(auth);
      sessionStorage.setItem('adminRedirect', 'true');
      window.location.href = '/index.html';
    }
  });

  // Logout
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
        showUserNotification('Error logging out.');
      }
    });
  }

  // Listener transaksi
  onValue(ref(database, 'transactions'), (snapshot) => {
    const transactions = snapshot.val();
    const depositItems = document.getElementById('deposit-items');
    const pendingCount = document.getElementById('pending-count');
    const approvedToday = document.getElementById('approved-today');

    if (!depositItems || !pendingCount || !approvedToday) return;
    depositItems.innerHTML = '';
    let pending = 0;
    let approvedTodayCount = 0;
    const today = new Date().toISOString().split('T')[0];

    for (const id in transactions) {
      const t = transactions[id];
      if (!['deposit', 'withdraw'].includes(t.type)) continue;

      if (t.status === 'pending') {
        pending++;
        if (Date.now() - lastNotificationTime > 60000) {
          showUserNotification(`New ${t.type} from ${t.email} for ${t.amount} PI`);
          lastNotificationTime = Date.now();
        }
      }
      if (t.status === 'approved' && new Date(t.timestamp).toISOString().split('T')[0] === today) {
        approvedTodayCount++;
      }

      const timeLeft = t.expiresAt ? Math.max(0, Math.floor((t.expiresAt - Date.now()) / 1000)) : 0;
      if (timeLeft <= 0 && t.status === 'pending') {
        update(ref(database, `transactions/${id}`), { status: 'cancelled' });
        continue;
      }

      depositItems.innerHTML += `
        <tr>
          <td>${t.email}</td>
          <td>${t.amount} PI</td>
          <td>${t.memo || '-'}</td>
          <td>${new Date(t.timestamp).toLocaleString()}</td>
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
          let time = parseInt(countdownElement.textContent);
          time--;
          countdownElement.textContent = `${time} sec`;
          if (time <= 0) {
            clearInterval(interval);
            update(ref(database, `transactions/${id}`), { status: 'cancelled' });
          }
        }, 1000);
      }
    }

    pendingCount.textContent = pending;
    approvedToday.textContent = approvedTodayCount;

    const buttons = depositItems.querySelectorAll('.game-button');
    buttons.forEach((btn) => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'approve') btn.onclick = () => handleApprove(id);
      if (action === 'reject') btn.onclick = () => handleReject(id);
    });
  });

  async function handleApprove(id) {
    const refTrans = ref(database, `transactions/${id}`);
    const snap = await get(refTrans);
    const trans = snap.val();
    const email = trans.email;
    const encodedEmail = encodeEmail(email);
    const userRef = ref(database, `players/${encodedEmail}`);
    const userSnap = await get(userRef);
    const user = userSnap.val();

    if (trans.type === 'deposit') {
      await update(userRef, { piBalance: (user.piBalance || 0) + trans.amount });
    } else if (trans.type === 'withdraw') {
      if ((user.piBalance || 0) < trans.amount) return showUserNotification('Not enough balance.');
      await update(userRef, { piBalance: user.piBalance - trans.amount });
    }

    await update(refTrans, { status: 'approved', processedAt: Date.now() });
    await set(ref(database, `notifications/${encodedEmail}/${id}`), {
      message: `${trans.type} ${trans.amount} PI approved.`,
      timestamp: Date.now(),
      read: false
    });
    showUserNotification(`${trans.type} approved.`);
  }

  async function handleReject(id) {
    const refTrans = ref(database, `transactions/${id}`);
    const snap = await get(refTrans);
    const trans = snap.val();
    const email = trans.email;
    const encodedEmail = encodeEmail(email);

    await update(refTrans, { status: 'rejected', processedAt: Date.now() });
    await set(ref(database, `notifications/${encodedEmail}/${id}`), {
      message: `${trans.type} ${trans.amount} PI rejected.`,
      timestamp: Date.now(),
      read: false
    });
    showUserNotification(`${trans.type} rejected.`);
  }
});
