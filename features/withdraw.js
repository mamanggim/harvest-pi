import { ref, get, update, push } from '/firebase/firebase-config.js';
import { auth } from '/firebase/firebase-config.js';
import { encodeEmail, copyToClipboard } from '/core/utils.js';

let withdrawCountdownInterval = null;
const withdrawCountdownDuration = 100;

export function setupWithdrawFeature() {
  const withdrawBtn = document.getElementById("withdraw-btn");
  const withdrawAmountInput = document.getElementById("withdraw-amount");
  const withdrawMsg = document.getElementById("withdraw-msg");
  const withdrawPopup = document.getElementById("withdraw-popup");
  const withdrawPopupAmount = document.getElementById("withdraw-popup-amount");
  const withdrawPopupUsername = document.getElementById("withdraw-popup-username");
  const withdrawPopupWallet = document.getElementById("withdraw-popup-wallet");
  const withdrawWalletInput = document.getElementById("withdraw-wallet-input");
  const withdrawCountdownTimer = document.getElementById("withdraw-countdown-timer");
  const confirmWithdrawBtn = document.getElementById("confirm-withdraw");
  const cancelWithdrawBtn = document.getElementById("cancel-withdraw");

  function resetWithdrawUI() {
    withdrawPopup.style.display = 'none';
    withdrawBtn.disabled = false;
    withdrawAmountInput.disabled = false;
    withdrawWalletInput.disabled = false;
    withdrawAmountInput.value = '';
    withdrawWalletInput.value = '';
  }

  withdrawBtn?.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      withdrawMsg.textContent = 'Please login first.';
      return;
    }

    const email = user.email;
    const encodedEmail = encodeEmail(email);
    const playersRef = ref(database, 'players');
    const snapshot = await get(playersRef);
    const playersData = snapshot.val() || {};

    let username = Object.keys(playersData).find(
      uname => playersData[uname].email === email
    );

    if (!username) {
      withdrawMsg.textContent = 'Username not found. Please register.';
      return;
    }

    const amount = parseFloat(withdrawAmountInput.value);
    if (!amount || amount < 1) {
      withdrawMsg.textContent = 'Minimum withdraw is 1 PI.';
      return;
    }

    const playerRef = ref(database, `players/${username}`);
    const playerSnapshot = await get(playerRef);
    if (!playerSnapshot.exists()) {
      withdrawMsg.textContent = 'Player data not found.';
      return;
    }

    const playerData = playerSnapshot.val();
    const piBalance = playerData.piBalance || 0;
    const totalDeposit = playerData.totalDeposit || 0;
    const referralEarnings = playerData.referralEarnings || 0;
    const farmCoins = playerData.farmCoins || 0;
    const level = playerData.level || 1;

    // === Syarat withdraw ===
    const hasMinLevel = level > 10;
    const hasMinFarmCoins = farmCoins >= 10000000;
    const hasMinPiSource = totalDeposit >= 10 || referralEarnings >= 10;

    if (!hasMinLevel || !hasMinFarmCoins || !hasMinPiSource) {
      withdrawMsg.innerHTML = `
        Withdraw locked. You need:<br>
        - Level > 10<br>
        - ≥ 10,000,000 Farm Coins<br>
        - ≥ 10 PI from Deposit or Referral
      `;
      return;
    }

    if (amount > piBalance) {
      withdrawMsg.textContent = 'Insufficient PI balance.';
      return;
    }

    const walletAddress = withdrawWalletInput.value.trim();
    if (!walletAddress) {
      withdrawMsg.textContent = 'Please enter a valid wallet address.';
      return;
    }

    // === Show popup ===
    withdrawMsg.textContent = '';
    withdrawBtn.disabled = true;
    withdrawAmountInput.disabled = true;
    withdrawWalletInput.disabled = true;

    withdrawPopupAmount.textContent = amount;
    withdrawPopupUsername.textContent = username;
    withdrawPopupWallet.textContent = walletAddress;
    withdrawPopup.style.display = 'block';

    let timeLeft = withdrawCountdownDuration;
    withdrawCountdownTimer.textContent = `Time left: ${timeLeft}s`;
    clearInterval(withdrawCountdownInterval);
    withdrawCountdownInterval = setInterval(() => {
      timeLeft--;
      withdrawCountdownTimer.textContent = `Time left: ${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(withdrawCountdownInterval);
        resetWithdrawUI();
        withdrawMsg.textContent = 'Withdraw request timed out.';
      }
    }, 1000);

    confirmWithdrawBtn.onclick = async () => {
      clearInterval(withdrawCountdownInterval);
      withdrawPopup.style.display = 'none';

      try {
        const updatedPiBalance = piBalance - amount;
        await update(playerRef, { piBalance: updatedPiBalance });

        const withdrawHistoryRef = ref(database, `withdrawHistory/${encodedEmail}`);
        await push(withdrawHistoryRef, {
          amount,
          walletAddress,
          timestamp: Date.now(),
          status: 'pending'
        });

        withdrawMsg.textContent = 'Withdraw request submitted. Awaiting confirmation...';
      } catch (error) {
        console.error('Error submitting withdraw:', error.message);
        withdrawMsg.textContent = 'Error submitting withdraw: ' + error.message;
      } finally {
        resetWithdrawUI();
      }
    };

    cancelWithdrawBtn.onclick = () => {
      clearInterval(withdrawCountdownInterval);
      resetWithdrawUI();
      withdrawMsg.textContent = 'Withdraw request cancelled.';
    };
  });
}
