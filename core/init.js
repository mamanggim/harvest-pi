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

  if (loadingScreen) {
    loadingScreen.style.display = 'none';
    console.log('Loading screen hidden');
  } else {
    console.log('Loading screen NOT FOUND!');
  }
  if (startScreen) {
    startScreen.style.display = 'flex';
    showNotification('✅ Start screen muncul');
  } else {
    showNotification('❌ Start screen NOT FOUND!');
  }

  try {
    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLang(savedLang);

    await loadData().catch(err => {
      console.error('loadData failed:', err);
      showNotification('⚠ Data gagal dimuat, pakai default');
    });

    const username = localStorage.getItem('username');
    if (username) {
      setUsername(username);
      await Promise.race([
        loadPlayerData(username),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]).catch(err => {
        console.error('loadPlayerData failed:', err);
        showNotification('⚠ Gagal load data user');
      });
      updateReferralLink();
      await checkDailyReward().catch(err => console.error('Reward check failed:', err));
      setIsDataLoaded(true);
      showNotification('🎮 Game data siap');
    } else {
      showNotification('🔑 Belum login');
      if (loginScreen) loginScreen.style.display = 'flex';
      if (startScreen) startScreen.style.display = 'none';
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
