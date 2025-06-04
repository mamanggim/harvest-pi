import { database, ref, get, set } from '/firebase/firebase-config.js';
import { showNotification } from '/ui/notification.js';
import { updateWallet } from '/ui/tab-switcher.js';
import {
  setFarmCoins, setPiBalance, setWater, setLevel, setXp,
  setInventory, setFarmPlots, setHarvestCount, setAchievements,
  setReferralEarnings, setIsDataLoaded
} from './global-state.js';
import { initializePlots } from '/features/farm.js';
import { renderShop } from '/features/shop.js';
import { renderInventory } from '/features/inventory.js';
import { renderSellSection } from '/features/sell.js';
import { renderAchievements, checkDailyReward } from '/features/achievements.js';

// Timeout untuk Firebase request (20 detik untuk mobile)
const FIREBASE_TIMEOUT = 20000;

export async function loadPlayerData(userKey) {
  if (!userKey) {
    showNotification('🔒 Login required');
    return { success: false, error: 'missing_user_key' };
  }

  const playerRef = ref(database, `players/${userKey}`);

  try {
    // Pakai Promise.race untuk timeout handling
    const snapshot = await Promise.race([
      get(playerRef),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout loading data')), FIREBASE_TIMEOUT)
    ]);

    let data = snapshot.val();

    // Initialize new user jika data tidak ada
    if (!data) {
      data = await initializeNewUser(playerRef, userKey);
    }

    // Set semua state sekaligus untuk minimize re-render
    setGameState(data);

    // Render UI setelah semua state siap
    await renderGameUI();

    console.log('✅ User data loaded for:', userKey);
    return { success: true };
  } catch (err) {
    console.error('❌ Failed to load player data:', err.message);
    
    // Fallback ke cached data jika ada
    const cachedData = getCachedData(userKey);
    if (cachedData) {
      setGameState(cachedData);
      showNotification('⚠️ Using offline data');
      return { success: false, isCached: true };
    }

    showNotification('❌ Failed to load data');
    return { success: false, error: err.message };
  }
}

// ===== HELPER FUNCTIONS ===== //
async function initializeNewUser(playerRef, userKey) {
  const initData = {
    farmCoins: 100, // Bonus awal untuk new user
    piBalance: 0,
    water: 10,
    level: 1,
    xp: 0,
    inventory: [],
    farmPlots: Array(9).fill(null), // 9 plot kosong
    harvestCount: 0,
    achievements: { 
      harvest: false, 
      coins: false,
      first_plant: false 
    },
    totalDeposit: 0,
    claimedToday: false,
    referralEarnings: 0,
    email: localStorage.getItem('email'),
    username: localStorage.getItem('username'),
    status: 'approved',
    role: 'user',
    lastUpdated: Date.now()
  };

  await set(playerRef, initData);
  cacheUserData(userKey, initData); // Simpan ke cache
  return initData;
}

function setGameState(data) {
  const defaults = {
    farmCoins: 0,
    piBalance: 0,
    water: 10,
    level: 1,
    xp: 0,
    inventory: [],
    farmPlots: Array(9).fill(null),
    harvestCount: 0,
    achievements: {},
    referralEarnings: 0
  };

  // Merge dengan default values
  const mergedData = { ...defaults, ...data };

  setFarmCoins(mergedData.farmCoins);
  setPiBalance(mergedData.piBalance);
  setWater(mergedData.water);
  setLevel(mergedData.level);
  setXp(mergedData.xp);
  setInventory(mergedData.inventory);
  setFarmPlots(mergedData.farmPlots);
  setHarvestCount(mergedData.harvestCount);
  setAchievements(mergedData.achievements);
  setReferralEarnings(mergedData.referralEarnings);
  setIsDataLoaded(true);
}

async function renderGameUI() {
  // Sequential render untuk hindari overload
  updateWallet();
  initializePlots();
  await renderShop();
  await renderInventory();
  renderSellSection();
  renderAchievements();
  checkDailyReward();
}

// Simple cache system untuk offline mode
function cacheUserData(userKey, data) {
  localStorage.setItem(`cache_${userKey}`, JSON.stringify(data));
}

function getCachedData(userKey) {
  const cached = localStorage.getItem(`cache_${userKey}`);
  return cached ? JSON.parse(cached) : null;
}
