import { getLang, setLang, setUsername, getUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';

export async function initializeGame() {
  const savedLang = localStorage.getItem('lang');
  if (savedLang) setLang(savedLang);

  const username = localStorage.getItem('username');

  try {
    await loadData(); // Load lang & vegetables
    if (username) {
      setUsername(username);
      await loadPlayerData(username); // Tunggu player data selesai
      updateReferralLink();
      checkDailyReward();
    }

    setIsDataLoaded(true); // <-- Ini WAJIB
    console.log('Game initialized.');
    
    // Tampilkan start screen, sembunyikan loading
    document.getElementById('loading-screen')?.classList.remove('active');
    document.getElementById('start-screen')?.style.display = 'flex';
  } catch (err) {
    console.error('Failed to initialize game:', err.message);
    showNotification('Failed to load game data.');
  }

  playBgMusic();
  playBgVoice();
}

// Cek user sudah login atau belum untuk switch tampilan
if (localStorage.getItem('username')) {
  document.getElementById('loading-screen')?.classList.remove('active');
  document.getElementById('start-screen')?.style.display = 'flex';
} else {
  document.getElementById('loading-screen')?.classList.remove('active');
  document.getElementById('login-screen')?.style.display = 'flex';
}
