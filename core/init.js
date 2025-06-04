import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  try {
    // 1. Load bahasa & data awal
    await loadData();

    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLang(savedLang);

    const loadingScreen = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const startScreen = document.getElementById('start-screen');

    // 2. Sembunyikan loading screen
    if (loadingScreen) loadingScreen.style.display = 'none';

    const username = localStorage.getItem('username');

    if (username) {
      // 3. Kalau udah login, lanjut ke start screen
      setUsername(username);
      await loadPlayerData(username);
      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true);

      if (startScreen) startScreen.style.display = 'flex';
      if (loginScreen) loginScreen.style.display = 'none';

      showNotification('🎮 Game ready!');
    } else {
      // 4. Belum login → tampilkan login screen
      if (loginScreen) loginScreen.style.display = 'flex';
      if (startScreen) startScreen.style.display = 'none';

      showNotification('🔑 Silakan login terlebih dahulu');
    }

    // 5. Mainkan audio
    playBgMusic();
    playBgVoice();
  } catch (err) {
    console.error('❌ Error init:', err);
    showNotification('❌ Gagal inisialisasi game');
  }
}
