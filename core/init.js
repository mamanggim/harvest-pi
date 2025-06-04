import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  try {
    await loadData().catch(err => {
      console.error('loadData failed:', err);
      showNotification('⚠ Data gagal dimuat, pakai default');
    });

    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLang(savedLang);

    // Tunggu 1 detik buat DOM siap
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      const loginScreen = document.getElementById('login-screen');
      if (loadingScreen && loginScreen) {
        loadingScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
      }
    }, 1000);

    const username = localStorage.getItem('username');
    if (username) {
      setUsername(username);
      await loadPlayerData(username).catch(err => {
        console.error('loadPlayerData failed:', err);
        showNotification('⚠ Gagal load data user');
      });
      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true);
      showNotification('🎮 Game data siap');

      const startScreen = document.getElementById('start-screen');
      if (startScreen) startScreen.style.display = 'flex';
    } else {
      showNotification('🔑 Belum login');
    }
  } catch (err) {
    console.error('❌ Error init:', err);
    showNotification('❌ Error saat inisialisasi');
  }

  try {
    playBgMusic();
    playBgVoice();
  } catch (err) {
    console.warn('Audio failed:', err);
  }
}
