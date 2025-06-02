import { ref, get, update } from '/firebase/firebase-config.js';
import { showNotification } from '/ui/notification.js';
import { loadUserBalances } from '/core/user-loader.js';
import { getUsername } from '/core/global-state.js';

export function initDepositHandler() {
  const depositBtn = document.getElementById('deposit-btn');
  const amountInput = document.getElementById('pi-amount');

  if (!depositBtn || !amountInput) return;

  depositBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const username = getUsername();
    if (!username) return showNotification('Login required');

    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) {
      showNotification('Please enter a valid amount!');
      return;
    }

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

    showNotification(`✅ Deposit successful: ${amount} PI`);
    console.log(`Deposit: ${amount} PI to ${username}`);

    // Bonus referral 10% jika ada referral
    if (playerData.referrer) {
      const referrer = playerData.referrer;
      const bonus = Math.round(amount * 0.1 * 1e6) / 1e6;

      const refRef = ref(database, `players/${referrer}`);
      const refSnap = await get(refRef);
      if (refSnap.exists()) {
        const refData = refSnap.val();
        const newRefBal = (refData.piBalance || 0) + bonus;
        const newRefEarn = (refData.referralEarnings || 0) + bonus;

        await update(refRef, {
          piBalance: newRefBal,
          referralEarnings: newRefEarn
        });

        console.log(`Referral bonus: ${bonus} PI to ${referrer}`);
      }
    }

    loadUserBalances();
  } catch (error) {
    console.error('❌ Deposit error:', error.message);
    showNotification('Deposit failed: ' + error.message);
  }
}
