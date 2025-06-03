import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  showNotification('🟢 Inisialisasi dimulai...');

  const savedLang = localStorage.getItem('lang');
  if (savedLang) {
    setLang(savedLang);
    showNotification('🌐 Bahasa: ' + savedLang);
  }

  try {
    await loadData();
    showNotification('📥 Data lang + sayur OK');

    const username = localStorage.getItem('username');
    showNotification('👤 Username ditemukan? ' + (username || 'BELUM LOGIN'));

    if (username) {
      setUsername(username);

      try {
        await loadPlayerData(username);
        showNotification('📦 Data user berhasil diload');
      } catch (err) {
        showNotification('❌ Gagal load user data: ' + err.message);
      }

      updateReferralLink();
      checkDailyReward();

      setIsDataLoaded(true);
      showNotification('✅ State data siap');
    }

    // Atur layar sesuai kondisi
    const loadingScreen = document.getElementById('loading-screen');
    const startScreen = document.getElementById('start-screen');
    const loginScreen = document.getElementById('login-screen');

    if (loadingScreen) {
      loadingScreen.classList.remove('active');
      showNotification('🔄 Loading screen disembunyikan');
    }

    if (username && startScreen) {
      startScreen.style.display = 'flex';
      showNotification('🚀 Start screen muncul');
    }

    if (!username && loginScreen) {
      loginScreen.style.display = 'flex';
      showNotification('🔑 Login screen muncul');
    }

    showNotification('🎉 Game Siap!');
  } catch (err) {
    console.error('❌ Error init:', err.message);
    showNotification('❌ Gagal load: ' + err.message);
  }

  playBgMusic();
  playBgVoice();
}
