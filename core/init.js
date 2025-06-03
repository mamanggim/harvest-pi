import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  // ⏩ Langsung munculkan start screen dulu
  const loadingScreen = document.getElementById('loading-screen');
  const startScreen = document.getElementById('start-screen');
  const loginScreen = document.getElementById('login-screen');

  if (loadingScreen) loadingScreen.classList.remove('active');
  if (startScreen) startScreen.style.display = 'flex';

  showNotification('⚡ Skip loading → Start screen');

  // Tetap jalankan proses di belakang layar
  try {
    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLang(savedLang);

    await loadData();
    const username = localStorage.getItem('username');

    if (username) {
      setUsername(username);
      await loadPlayerData(username);
      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true);
    }

    if (!username && loginScreen) {
      // Kalau belum login, tampilkan login screen (optional)
      startScreen.style.display = 'none';
      loginScreen.style.display = 'flex';
    }

    showNotification('🎮 Game siap dijalankan');
  } catch (err) {
    showNotification('❌ Error: ' + err.message);
    console.error(err);
  }

  playBgMusic();
  playBgVoice();
}
