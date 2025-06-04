import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  try {
    showNotification('🔁 Mulai inisialisasi game...');

    // 1. Load data bahasa & tanaman
    await loadData().catch(err => {
      console.error('❌ loadData error:', err);
      showNotification('⚠ Gagal load data dasar (bahasa/tanaman)');
    });

    // 2. Set bahasa dari localStorage
    const savedLang = localStorage.getItem('lang');
    if (savedLang) {
      setLang(savedLang);
      showNotification('🌐 Bahasa aktif: ' + savedLang);
    }

    // 3. Sembunyikan loading, tampilkan login
    const loadingScreen = document.getElementById('loading-screen');
    const loginScreen = document.getElementById('login-screen');
    const startScreen = document.getElementById('start-screen');

    if (loadingScreen) {
      loadingScreen.classList.remove('active');
      showNotification('✅ Loading selesai, lanjut...');
    }

    const username = localStorage.getItem('username');
    if (username) {
      // 4. Jika sudah login sebelumnya, load data user
      setUsername(username);
      await loadPlayerData(username).catch(err => {
        console.error('❌ Gagal load user:', err);
        showNotification('⚠ Gagal ambil data user');
      });

      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true);

      // 5. Tampilkan start screen
      if (startScreen) {
        startScreen.style.display = 'flex';
        showNotification('🎮 Game siap dimainkan');
      }
    } else {
      // 6. Kalau belum login, munculkan login screen
      if (loginScreen) loginScreen.style.display = 'flex';
      showNotification('🔑 Belum login. Munculkan login screen.');
    }

    // 7. Audio
    try {
      playBgMusic();
      playBgVoice();
    } catch (err) {
      console.warn('🔇 Audio gagal dimuat:', err);
    }

  } catch (err) {
    console.error('❌ Error utama:', err);
    showNotification('❌ Error saat inisialisasi game');
  }
}
