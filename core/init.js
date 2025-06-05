import { getLang, setLang, setUsername } from './global-state.js';
import { loadPlayerData, updateReferralLink } from './user-loader.js';
import { loadData } from './loader.js';
import { checkDailyReward } from '/features/reward.js';
import { playBgMusic, playBgVoice } from './audio.js';
import { showNotification } from '/ui/notification.js';
import { setIsDataLoaded } from './global-state.js';

export async function initializeGame() {
  const loadingScreen = document.getElementById('loading-screen');
  const loginScreen = document.getElementById('login-screen');
  const startScreen = document.getElementById('start-screen');

  try {
    // 1. Load bahasa & data awal dengan timeout
    await Promise.race([
      loadData(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout loading data')), 5000)
    ]);

    // 2. Set bahasa dari localStorage (jika ada)
    const savedLang = localStorage.getItem('lang');
    if (savedLang) setLang(savedLang);

    // 3. Cek session user
    const username = localStorage.getItem('username');
    const sessionValid = await checkSessionValidity(username); // Pastikan fungsi ini ada di session.js

    if (username && sessionValid) {
      // 4. Jika session valid, lanjut ke game
      setUsername(username);
      
      try {
        await loadPlayerData(username);
        updateReferralLink();
        checkDailyReward();
        
        // UI Transition
        if (loadingScreen) loadingScreen.style.opacity = '0';
        setTimeout(() => {
          if (loadingScreen) loadingScreen.style.display = 'none';
          if (startScreen) startScreen.style.display = 'flex';
          if (loginScreen) loginScreen.style.display = 'none';
        }, 500);

        showNotification('🎮 Game ready!');
      } catch (error) {
        console.error('Player data error:', error);
        forceLogout(); // Bersihkan session invalid
      }
    } else {
      // 5. Jika belum login, tampilkan login screen
      if (loadingScreen) loadingScreen.style.opacity = '0';
      setTimeout(() => {
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (loginScreen) loginScreen.style.display = 'flex';
        if (startScreen) startScreen.style.display = 'none';
      }, 500);
      
      showNotification('🔑 Silakan login terlebih dahulu');
    }

    // 6. Audio akan play setelah user interaction (untuk mobile compliance)
    document.body.addEventListener('click', () => {
      playBgMusic();
      playBgVoice();
    }, { once: true });

    setIsDataLoaded(true);
  } catch (err) {
    console.error('❌ Init error:', err);
    
    // Fallback UI
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (loginScreen) loginScreen.style.display = 'flex';
    
    showNotification(err.message.includes('Timeout') ? 
      '⚠️ Koneksi lambat, coba refresh' : 
      '❌ Gagal memuat game');
  }
}

// Helper functions (taruh di file terpisah atau bagian bawah)
async function checkSessionValidity(username) {
  if (!username) return false;
  // Implementasi cek session ke Firebase/backend
  return true; // Ganti dengan logic sesungguhnya
}

function forceLogout() {
  localStorage.removeItem('username');
  window.location.reload();
}
