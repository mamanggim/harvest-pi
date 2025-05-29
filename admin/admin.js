import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

document.addEventListener('DOMContentLoaded', () => {
  console.log('admin.js loaded, auth:', auth); // Debug
  let isLoggingOut = false;
  let lastNotificationTime = 0;

  // Cek auth dan role
  auth.onAuthStateChanged((user) => {
    console.log('Auth state changed, user:', user); // Debug
    if (!user && !isLoggingOut) {
      showUserNotification('Please login first.');
      sessionStorage.setItem('adminRedirect', 'true');
      window.location.href = '/index.html';
      return;
    }
    if (user) {
      const encodedEmail = encodeEmail(user.email);
      get(ref(database, `players/${encodedEmail}/role`))
        .then((snapshot) => {
          if (snapshot.val() !== 'admin') {
            showUserNotification('Access denied. Admins only.');
            auth.signOut().then(() => {
              sessionStorage.setItem('adminRedirect', 'true');
              window.location.href = '/index.html';
            });
            return;
          }
        })
        .catch((error) => {
          console.error('Error checking role:', error);
          showUserNotification('Error checking permissions. Please login again.');
          auth.signOut().then(() => {
            sessionStorage.setItem('adminRedirect', 'true');
            window.location.href = '/index.html';
          });
        });
    }
  });

  // Logout
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    console.log('Logout button found:', logoutBtn);
    logoutBtn.addEventListener('click', async () => {
      console.log('Logout button clicked');
      if (isLoggingOut) return;
      isLoggingOut = true;
      try {
        if (!auth) throw new Error('Auth object undefined');
        await signOut(auth);
        console.log('Sign out successful');
        sessionStorage.setItem('adminRedirect', 'true');
        window.location.href = '/index.html';
      } catch (error) {
        isLoggingOut = false;
        console.error('Logout error:', error.message);
        showUserNotification(`Error logging out: ${error.message}`);
      }
    });
  } else {
    console.error('Logout button not found');
  }

  // Admin Dashboard
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
                countdownElement.textContent = `${timeLeft} sec`;
                if (timeLeft <= 0) {
                  clearInterval(interval);
                  update(ref(database, `transactions/${id}`), { status: 'cancelled' });
                }
              }, 1000);
            }
          }
        }
      }

      pendingCount.textContent = pending;
      approvedToday.textContent = approvedTodayCount;

      // Listener approve/reject
      const buttons = depositItems.querySelectorAll('.game-button');
      buttons.forEach((button) => {
        const id = button.dataset.id;
        const action = button.dataset.action;
        if (id && action) {
          button.addEventListener('click', () => {
            console.log(`Button clicked: ${action} for ID ${id}`);
            if (action === 'approve') {
              approveTransaction(id);
            } else if (action === 'reject') {
              rejectTransaction(id);
            }
          });
        }
      });
    }
  });

  // Approve transaksi
  async function approveTransaction(id) {
    try {
      const transactionRef = ref(database, `transactions/${id}`);
      const snap = await get(transactionRef);
      const transaction = snap.val();
      if (!transaction || !['deposit', 'withdraw'].includes(transaction.type)) {
        showUserNotification('Invalid transaction.');
        return;
      }
      if (transaction.status !== 'pending') {
        showUserNotification('Transaction already processed.');
        return;
      }

      const amount = parseFloat(transaction.amount);
      if (isNaN(amount) || amount <= 0) {
        showUserNotification('Invalid amount.');
        return;
      }

      const encodedEmail = encodeEmail(transaction.email);
      const userRef = ref(database, `players/${encodedEmail}`);
      const playerSnap = await get(userRef);
      const player = playerSnap.val();

      if (!player) {
        showUserNotification('User not found.');
        return;
      }

      if (transaction.type === 'deposit') {
        await update(userRef, {
          piBalance: (player.piBalance || 0) + amount
        });
      } else if (transaction.type === 'withdraw') {
        if ((player.piBalance || 0) < amount) {
          showUserNotification('Insufficient balance for withdrawal.');
          return;
        }
        await update(userRef, {
          piBalance: (player.piBalance || 0) - amount
        });
      }

      await update(transactionRef, {
        status: 'approved',
        processedAt: Date.now()
      });

      await set(ref(database, `notifications/${encodedEmail}/${id}`), {
        message: `${transaction.type} of ${amount} PI approved.`,
        timestamp: Date.now(),
        read: false
      });

      showUserNotification(`${transaction.type} ${amount} PI approved!`);
    } catch {
      showUserNotification(`Error approving transaction.`);
    }
  }

  // Reject transaksi
  async function rejectTransaction(id) {
    try {
      const transactionRef = ref(database, `transactions/${id}`);
      const snap = await get(transactionRef);
      const transaction = snap.val();
      if (!transaction || !['deposit', 'withdraw'].includes(transaction.type)) {
        showUserNotification('Invalid transaction.');
        return;
      }
      if (transaction.status !== 'pending') {
        showUserNotification('Transaction already processed.');
        return;
      }

      await update(transactionRef, {
        status: 'rejected',
        processedAt: Date.now()
      });

      const encodedEmail = encodeEmail(transaction.email);
      await set(ref(database, `notifications/${encodedEmail}/${id}`), {
        message: `${transaction.type} of ${transaction.amount} PI rejected. Contact admin.`,
        timestamp: Date.now(),
        read: false
      });

      showUserNotification(`${transaction.type} ${transaction.amount} PI rejected.`);
    } catch {
      showUserNotification(`Error rejecting transaction.`);
    }
  }

  function showUserNotification(message) {
    const notification = document.getElementById('notification');
    if (notification) {
      notification.textContent = message;
      notification.style.display = 'block';
      setTimeout(() => notification.style.display = 'none', 5000);
    }
  }

  function encodeEmail(email) {
    return email.replace('@', '_at_').replace('.', '_dot_');
  }
});
