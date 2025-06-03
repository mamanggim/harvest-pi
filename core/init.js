import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  const savedLang = localStorage.getItem('lang');
  if (savedLang) setLang(savedLang);

  try {
    await loadData(); // lang.json + vegetables.json

    // Jangan muat data user kalau belum login
    const username = localStorage.getItem('username');
    if (username) {
      setUsername(username);
      await loadPlayerData(username); // tunggu data player
      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true); // ✅ hanya aktif jika user login
    }

    // Pindah dari loading ke login atau start
    const loadingScreen = document.getElementById('loading-screen');
    const startScreen = document.getElementById('start-screen');
    const loginScreen = document.getElementById('login-screen');

    if (loadingScreen) loadingScreen.classList.remove('active');

    if (username) {
      if (startScreen) startScreen.style.display = 'flex';
    } else {
      if (loginScreen) loginScreen.style.display = 'flex';
    }

    console.log('✅ Game ready.');
  } catch (err) {
    console.error('❌ Failed to init:', err.message);
    showNotification('Failed to load game data.');
  }

  playBgMusic();
  playBgVoice();
}
