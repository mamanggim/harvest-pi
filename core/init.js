import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  try {
    // 1. Sembunyikan loading
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';

    // 2. Cek bahasa
    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLang(savedLang);

    // 3. Cek apakah sudah login
    const username = localStorage.getItem('username');

    if (username) {
      // ✅ Sudah login, lanjut ke start screen
      setUsername(username);
      await loadData();
      await loadPlayerData(username);
      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true);

      const startScreen = document.getElementById('start-screen');
      const loginScreen = document.getElementById('login-screen');

      if (loginScreen) loginScreen.style.display = 'none';
      if (startScreen) startScreen.style.display = 'flex';

      showNotification('🎮 Game siap dimainkan!');
    } else {
      // 🔑 Belum login, tampilkan login screen
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) loginScreen.style.display = 'flex';

      showNotification('🔐 Silakan login untuk mulai');
    }

    // 4. Jalankan musik
    try {
      playBgMusic();
      playBgVoice();
    } catch (err) {
      console.warn('🎵 Gagal play musik:', err);
    }
  } catch (err) {
    console.error('❌ Error init:', err);
    showNotification('❌ Gagal memulai game');
  }
}
