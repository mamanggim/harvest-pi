import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  showNotification('🟢 Init dimulai');

  const savedLang = localStorage.getItem('lang');
  if (savedLang) {
    setLang(savedLang);
    showNotification('🌐 Bahasa dimuat: ' + savedLang);
  }

  try {
    await loadData();
    showNotification('✅ Data lang & vegetables OK');

    const username = localStorage.getItem('username');
    if (username) {
      setUsername(username);
      showNotification('👤 Username: ' + username);

      await loadPlayerData(username);
      showNotification('📦 Data user selesai');

      updateReferralLink();
      checkDailyReward();

      setIsDataLoaded(true);
      showNotification('✅ Data user siap');
    } else {
      showNotification('🔒 Belum login');
    }

    // Atur tampilan layar
    const loadingScreen = document.getElementById('loading-screen');
    const startScreen = document.getElementById('start-screen');
    const loginScreen = document.getElementById('login-screen');

    if (loadingScreen) {
      loadingScreen.classList.remove('active');
      showNotification('⏹ Loading disembunyikan');
    }

    if (username && startScreen) {
      startScreen.style.display = 'flex';
      showNotification('🏁 Muncul start screen');
    }

    if (!username && loginScreen) {
      loginScreen.style.display = 'flex';
      showNotification('🔑 Muncul login screen');
    }

    showNotification('🎮 Game siap dijalankan');
  } catch (err) {
    console.error('❌ Failed to init:', err.message);
    showNotification('❌ Gagal load game: ' + err.message);
  }

  playBgMusic();
  playBgVoice();
}
