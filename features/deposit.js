import { ref, get, update } from '/firebase/firebase-config.js';
import { showNotification } from '/ui/notification.js';
import { loadUserBalances } from '/core/storage.js';

export function initDepositHandler(username) {
  const depositBtn = document.getElementById('deposit-btn');
  const amountInput = document.getElementById('pi-amount');

  if (!depositBtn || !amountInput) return;

  depositBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const amount = parseFloat(amountInput.value) || 0;
    if (amount <= 0) return alert('Please enter a valid amount!');
    await handleDeposit(username, amount);
    amountInput.value = '';
  });
}

export async function handleDeposit(username, amount) {
  if (!username || amount <= 0) return;

  const playerRef = ref(database, `players/${username}`);
  try {
    const snapshot = await get(playerRef);
    const playerData = snapshot.val() || {};
    const newBalance = (playerData.piBalance || 0) + amount;

    await update(playerRef, { piBalance: newBalance });
    console.log(`Deposit successful: ${amount} PI added to ${username}`);
    showNotification(`Deposit successful: ${amount} PI`);

    loadUserBalances(); // Refresh UI
  } catch (error) {
    console.error('Deposit error:', error);
    showNotification('Error depositing: ' + error.message);
  }
}
