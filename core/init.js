import { getCurrentLang, setCurrentLang, setUsername, getUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';

export async function initializeGame() {
  const savedLang = localStorage.getItem('lang');
  if (savedLang) setCurrentLang(savedLang);

  const username = localStorage.getItem('username');
  if (username) {
    setUsername(username);
    loadPlayerData(username);
    updateReferralLink();
    checkDailyReward();
  }

  try {
    await loadData();
    console.log('Game initialized, data loaded');
  } catch (err) {
    console.error('Failed to initialize game:', err.message);
    showNotification('Failed to load game data.');
  }

  playBgMusic();
  playBgVoice();
}
