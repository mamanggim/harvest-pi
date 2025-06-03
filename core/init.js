import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  const loadingScreen = document.getElementById('loading-screen');
  const startScreen = document.getElementById('start-screen');
  const loginScreen = document.getElementById('login-screen');

  // ⏩ Skip loading screen
  if (loadingScreen) loadingScreen.classList.remove('active');
  if (startScreen) {
    startScreen.style.display = 'flex';
    showNotification('✅ Start screen muncul');
  } else {
    showNotification('❌ Start screen NOT FOUND!');
  }

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
      showNotification('🎮 Game data siap');
    } else {
      showNotification('🔑 Belum login');
      if (loginScreen && startScreen) {
        startScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
      }
    }
  } catch (err) {
    console.error('❌ Error init:', err);
    showNotification('❌ Error saat inisialisasi');
  }

  playBgMusic();
  playBgVoice();
}
