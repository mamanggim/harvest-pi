import { ref, update } from '/firebase/firebase-config.js';
import {
  getUsername,
  getFarmCoins,
  getPiBalance,
  getWater,
  getLevel,
  getXP,
  getInventory,
  getFarmPlots,
  getHarvestCount,
  getAchievements,
  getLastClaim,
  isClaimedToday
} from './global-state.js';
import { showNotification } from '/ui/notification.js';

export async function savePlayerData() {
  const username = getUsername();
  if (!username) return;

  const playerRef = ref(database, `players/${username}`);

  const dataToSave = {
    farmCoins: getFarmCoins(),
    piBalance: getPiBalance(),
    water: getWater(),
    level: getLevel(),
    xp: getXP(),
    inventory: getInventory(),
    farmPlots: getFarmPlots(),
    harvestCount: getHarvestCount(),
    achievements: getAchievements(),
    lastClaim: getLastClaim(),
    claimedToday: isClaimedToday()
  };

  try {
    await update(playerRef, dataToSave);
    console.log('✅ Player data saved');
  } catch (error) {
    console.error('❌ Error saving player data:', error.message);
    showNotification('Error saving data');
  }
}
