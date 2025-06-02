import { showNotification } from '/ui/notification.js';
import { copyToClipboard } from '/core/utils.js';
import { ref, get, update } from '/firebase/firebase-config.js';
import { getUsername } from '/core/global-state.js';

// Buat link referral dari username
export function generateReferralLink(username) {
  return `https://www.harvestpi.biz.id/?ref=${username}`;
}

// Tampilkan tombol salin link referral
export function initReferralHandler() {
  const copyBtn = document.getElementById('copy-link-btn');
  const linkEl = document.getElementById('referral-link');

  if (!copyBtn || !linkEl) return;

  copyBtn.addEventListener('click', () => {
    if (linkEl.textContent) {
      copyToClipboard(linkEl.textContent);
      showNotification('Referral link copied!');
    } else {
      console.error('Referral link empty or missing');
    }
  });

  loadReferralStats();
}

// Ambil total referral & bonus referral dari DB
async function loadReferralStats() {
  const username = getUsername();
  if (!username) return;

  const playerRef = ref(database, `players/${username}`);
  try {
    const snapshot = await get(playerRef);
    const data = snapshot.val() || {};

    const referralCountEl = document.getElementById('referral-count');
    const referralEarningsEl = document.getElementById('referral-earnings');

    if (referralCountEl) referralCountEl.textContent = data.referralCount || 0;
    if (referralEarningsEl) referralEarningsEl.textContent = `${data.referralEarnings || 0} PI`;

  } catch (err) {
    console.error('Failed to load referral stats:', err.message);
  }
}
