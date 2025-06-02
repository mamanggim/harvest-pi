import {
  getUsername, getLangData, getCurrentLang,
  getLastClaim, setLastClaim,
  isClaimedToday, setClaimedToday,
  getFarmCoins, setFarmCoins,
  getWater, setWater,
  getXP, setXP
} from '/core/global-state.js';

import { ref, get, update } from '/firebase/firebase-config.js';
import { showNotification } from '/ui/notification.js';
import { playCoinSound } from '/core/audio.js';
import { updateWallet } from '/ui/tab-switcher.js';

const claimBtn = document.getElementById('claim-reward-btn');
const rewardModal = document.getElementById('reward-modal');
const rewardText = document.getElementById('daily-reward-text');

export function initRewardHandler() {
  if (!claimBtn) return;

  claimBtn.addEventListener('click', async () => {
    const username = getUsername();
    if (!username) return;

    const today = new Date().toISOString().split('T')[0];
    const lastClaim = getLastClaim();
    const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;

    const lang = getLangData();
    const currentLang = getCurrentLang();

    if (lastClaimDate === today) {
      claimBtn.classList.add('claimed');
      claimBtn.textContent = lang[currentLang]?.claimed || 'Claimed!';
      claimBtn.disabled = true;
      setClaimedToday(true);
      return;
    }

    // Munculkan modal reward
    if (rewardModal) rewardModal.style.display = 'block';
    if (rewardText) {
      rewardText.textContent = lang[currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!';
    }
  });

  const modalClaimBtn = document.getElementById('claim-modal-btn');
  modalClaimBtn?.addEventListener('click', async () => {
    const username = getUsername();
    if (!username) return;

    // Reward
    setFarmCoins(getFarmCoins() + 100);
    setWater(getWater() + 50);
    setXP(getXP() + 10);

    const todayISO = new Date().toISOString();
    setLastClaim(todayISO);
    setClaimedToday(true);

    const playerRef = ref(database, `players/${username}`);
    await update(playerRef, {
      farmCoins: getFarmCoins(),
      water: getWater(),
      xp: getXP(),
      lastClaim: todayISO,
      claimedToday: true
    });

    if (rewardModal) rewardModal.style.display = 'none';

    const btn = document.getElementById('claim-reward-btn');
    if (btn) {
      btn.classList.add('claimed');
      btn.textContent = getLangData()[getCurrentLang()]?.claimed || 'Claimed!';
      btn.disabled = true;
    }

    updateWallet();
    playCoinSound();
    showNotification(getLangData()[getCurrentLang()]?.rewardClaimed || 'Reward Claimed!');
  });
}

// === Pengecekan saat awal load
export function checkDailyReward() {
  const username = getUsername();
  if (!username) return;

  const today = new Date().toISOString().split('T')[0];
  const lastClaim = getLastClaim();
  const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;

  const btn = document.getElementById('claim-reward-btn');
  if (!btn) return;

  const lang = getLangData();
  const currentLang = getCurrentLang();

  if (lastClaimDate === today) {
    btn.classList.add('claimed');
    btn.textContent = lang[currentLang]?.claimed || 'Claimed!';
    btn.disabled = true;
    setClaimedToday(true);
  } else {
    btn.classList.remove('claimed');
    btn.textContent = lang[currentLang]?.claimDailyReward || 'Claim Daily Reward';
    btn.disabled = false;
    setClaimedToday(false);
  }
}
