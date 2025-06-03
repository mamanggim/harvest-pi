import { database, ref, onValue, set } from '/firebase/firebase-config.js';
import { showNotification } from '/ui/notification.js';
import { updateWallet } from '/ui/tab-switcher.js';

import {
  getUsername,
  setFarmCoins, setPiBalance, setWater, setLevel, setXp,
  setInventory, setFarmPlots, setHarvestCount, setAchievements,
  setReferralEarnings, setIsDataLoaded
} from './global-state.js';

import { initializePlots } from '/features/farm.js';
import { renderShop } from '/features/shop.js';
import { renderInventory } from '/features/inventory.js';
import { renderSellSection } from '/features/sell.js';
import { renderAchievements, checkDailyReward } from '/features/achievements.js';

/**
 * Load hanya balance (pi + farm coins) dari Firebase dan update UI
 */
export function loadUserBalances() {
  const username = getUsername();
  if (!username) return;

  const playerRef = ref(database, `players/${username}`);
  onValue(playerRef, (snapshot) => {
    const data = snapshot.val() || {};
    setFarmCoins(data.farmCoins || 0);
    setPiBalance(data.piBalance || 0);
    updateWallet();
  });
}

/**
 * Load seluruh data pemain dan update global state + UI
 */
export function loadPlayerData(userKey) {
  if (!userKey) {
    showNotification('Login required.');
    return;
  }

  const playerRef = ref(database, `players/${userKey}`);
  onValue(playerRef, (snapshot) => {
    const data = snapshot.val();

  import { setIsDataLoaded } from './global-state.js';

// Setelah loadPlayerData selesai:
setIsDataLoaded(true);

    // Inisialisasi data baru jika kosong
    if (!data) {
      const role = localStorage.getItem('role');
      if (role === 'admin') {
        console.warn('Skip initializing admin data');
        return;
      }

      const init = {
        farmCoins: 0,
        piBalance: 0,
        water: 0,
        level: 1,
        xp: 0,
        inventory: [],
        farmPlots: [],
        harvestCount: 0,
        achievements: { harvest: false, coins: false },
        totalDeposit: 0,
        claimedToday: false,
        referralEarnings: 0,
        email: localStorage.getItem('email'),
        username: localStorage.getItem('username'),
        status: 'approved',
        role: 'user'
      };

      set(playerRef, init)
        .then(() => console.log('Initialized new user data:', userKey))
        .catch((err) => {
          console.error('Failed to init user data:', err.message);
          showNotification('Failed to init data');
        });
      return;
    }

    // Assign ke global state
    setFarmCoins(data.farmCoins || 0);
    setPiBalance(data.piBalance || 0);
    setWater(data.water || 0);
    setLevel(data.level || 1);
    setXp(data.xp || 0);
    setInventory(data.inventory || []);
    setFarmPlots(data.farmPlots || []);
    setHarvestCount(data.harvestCount || 0);
    setAchievements(data.achievements || { harvest: false, coins: false });
    setReferralEarnings(data.referralEarnings || 0);
    setIsDataLoaded(true);

    updateWallet();
    initializePlots();
    renderShop();
    renderInventory();
    renderSellSection();
    renderAchievements();
    checkDailyReward();

    console.log('✅ User data loaded for:', userKey);
  });
}
