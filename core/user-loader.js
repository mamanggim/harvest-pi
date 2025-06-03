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

export async function loadPlayerData(userKey) {
  if (!userKey) {
    showNotification('Login required.');
    return;
  }

  const playerRef = ref(database, `players/${userKey}`);

  try {
    const snapshot = await get(playerRef);
    let data = snapshot.val();

    if (!data) {
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

      await set(playerRef, init);
      console.log('Initialized new user data:', userKey);
      data = init;
    }

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

    // ✅ Baru setelah semua selesai
    setIsDataLoaded(true);

    updateWallet();
    initializePlots();
    renderShop();
    renderInventory();
    renderSellSection();
    renderAchievements();
    checkDailyReward();

    console.log('✅ User data loaded for:', userKey);
  } catch (err) {
    console.error('❌ Failed to load player data:', err.message);
    showNotification('Failed to load user data.');
  }
}
