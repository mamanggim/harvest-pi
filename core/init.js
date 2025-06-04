import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from '/ui/audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  const loadingScreen = document.getElementById('loading-screen');
  const loginScreen = document.getElementById('login-screen');
  const startScreen = document.getElementById('start-screen');

  // 1. Tampilkan loading screen dulu
  if (loadingScreen) loadingScreen.classList.add('active');

  try {
    // 2. Load data bahasa dan tanaman
    await loadData();
    showNotification('✅ Data berhasil dimuat');

    // 3. Cek bahasa tersimpan
    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLang(savedLang);

    // 4. Cek login user
    const username = localStorage.getItem('username');
    if (username) {
      setUsername(username);
      await loadPlayerData(username);
      updateReferralLink();
      checkDailyReward();
      setIsDataLoaded(true);

      // 5. Munculkan start screen
      if (loadingScreen) loadingScreen.style.display = 'none';
      if (startScreen) startScreen.style.display = 'flex';

      showNotification('🎮 Selamat datang kembali!');
    } else {
      // 6. Kalau belum login, munculkan login screen
      if (loadingScreen) loadingScreen.style.display = 'none';
      if (loginScreen) loginScreen.style.display = 'flex';
      showNotification('🔑 Silakan login');
    }
  } catch (err) {
    console.error('❌ Error saat init:', err);
    showNotification('❌ Gagal inisialisasi: ' + err.message);
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'flex';
  }

  // 7. Mainkan audio (jika tidak diblok browser)
  try {
    playBgMusic();
    playBgVoice();
  } catch (err) {
    console.warn('⚠ Audio gagal dimuat:', err);
  }
}
