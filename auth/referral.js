import { ref, get, update } from '/firebase/firebase-config.js';
import { showNotification } from '/ui/notification.js';
import { copyToClipboard } from '/core/utils.js';

// === Generate Link ===
export function generateReferralLink(username) {
  return `https://www.harvestpi.biz.id/?ref=${username}`;
}

// === Inisialisasi Handler Copy & Stat ===
export function initReferralHandler() {
  const copyBtn = document.getElementById('copy-link-btn');
  const linkEl = document.getElementById('referral-link');

  if (copyBtn && linkEl) {
    copyBtn.addEventListener('click', () => {
      if (linkEl.textContent) {
        copyToClipboard(linkEl.textContent);
        showNotification('Referral link copied!');
      } else {
        console.error('Referral link empty or missing');
      }
    });
  }

  showReferralStats(); // Panggil stat saat inisialisasi
}

// === Menampilkan Statistik Referral ===
async function showReferralStats() {
  const username = localStorage.getItem('username');
  const encodedEmail = localStorage.getItem('encodedEmail');
  if (!username || !encodedEmail) return;

  const playerRef = ref(database, `players/${username}`);
  const playersRef = ref(database, 'players');

  try {
    const [playerSnap, allPlayersSnap] = await Promise.all([
      get(playerRef),
      get(playersRef)
    ]);

    const playerData = playerSnap.val() || {};
    const allPlayers = allPlayersSnap.val() || {};

    const referralCount = Object.values(allPlayers).filter(p => p.referrer === username).length;
    const referralEarnings = parseFloat(playerData.referralEarnings || 0).toFixed(6);

    const countEl = document.getElementById('referral-count');
    const earningsEl = document.getElementById('referral-earnings');

    if (countEl) countEl.textContent = `Total Referrals: ${referralCount}`;
    if (earningsEl) earningsEl.textContent = `Referral Bonus: ${referralEarnings} PI`;
  } catch (error) {
    console.error('Failed to fetch referral stats:', error.message);
  }
}
