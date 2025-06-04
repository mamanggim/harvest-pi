import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  const loading = document.getElementById('loading-screen');
  const login = document.getElementById('login-screen');
  const start = document.getElementById('start-screen');

  // Pastikan hanya loading yang tampil dulu
  loading.classList.add('active');
  login.classList.remove('active');
  start.classList.remove('active');

  try {
    await loadData();

    const lang = localStorage.getItem('lang');
    if (lang) setLang(lang);

    const username = localStorage.getItem('username');

    if (username) {
      setUsername(username);
      await loadPlayerData(username);
      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true);

      loading.classList.remove('active');
      start.classList.add('active');
    } else {
      // belum login
      loading.classList.remove('active');
      login.classList.add('active');
    }

    showNotification('✅ Init selesai');
  } catch (e) {
    console.error(e);
    showNotification('❌ Gagal inisialisasi');
  }

  try {
    playBgMusic();
    playBgVoice();
  } catch (e) {
    console.warn('🔇 Audio gagal dimulai:', e);
  }
}
