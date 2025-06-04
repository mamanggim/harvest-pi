import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  try {
    // 1. Load data bahasa & tanaman
    await loadData().catch(err => {
      console.error('loadData failed:', err);
      showNotification('⚠️ Gagal load data game.');
    });

    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLang(savedLang);

    // 2. Hide loading, prepare screen
    const loadingScreen = document.getElementById('loading-screen');
    const startScreen = document.getElementById('start-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';

    // 3. Cek login
    const username = localStorage.getItem('username');
    if (username) {
      setUsername(username);
      await loadPlayerData(username).catch(err => {
        console.error('loadPlayerData failed:', err);
        showNotification('⚠️ Gagal load user');
      });

      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true);

      if (startScreen) startScreen.style.display = 'flex';
      showNotification('✅ Game Siap Dimulai!');
    } else {
      // Belum login, redirect ke /auth/login.html
      showNotification('🔑 Belum login, redirect ke login...');
      window.location.href = '/auth/login.html';
      return;
    }
  } catch (err) {
    console.error('❌ Error init:', err);
    showNotification('❌ Error saat inisialisasi');
  }

  // 4. Jalankan audio
  try {
    playBgMusic();
    playBgVoice();
  } catch (err) {
    console.warn('Audio failed:', err);
  }
}
