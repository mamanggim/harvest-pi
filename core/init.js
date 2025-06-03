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

  const username = localStorage.getItem('username');

  try {
    await loadData(); // load lang + vegetables

    if (username) {
      setUsername(username);
      await loadPlayerData(username); // tunggu data user
      updateReferralLink();
      checkDailyReward();
    }

    setIsDataLoaded(true); // penting untuk start screen

    // ✅ Pindah dari loading ke start
    const loadingScreen = document.getElementById('loading-screen');
    const startScreen = document.getElementById('start-screen');

    if (loadingScreen) loadingScreen.classList.remove('active');
    if (startScreen) startScreen.style.display = 'flex';

    console.log('✅ Game ready.');
  } catch (err) {
    console.error('❌ Failed to init:', err.message);
    showNotification('Failed to load game data.');
  }

  playBgMusic();
  playBgVoice();
}
