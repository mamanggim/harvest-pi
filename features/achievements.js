import {
  getFarmCoins, getPiBalance, getLevel, getHarvestCount, getAchievements,
  setAchievements, setFarmCoins, setWater, setPiBalance
} from '/core/global-state.js';
import { showNotification } from '/ui/notification.js';
import { updateWallet } from '/ui/tab-switcher.js';

const ACHIEVEMENTS = [
  {
    id: 'level_1',
    label: 'Level Up I',
    condition: () => getLevel() >= 5,
    reward: () => {
      setFarmCoins(getFarmCoins() + 100);
      setWater(prev => setWater(prev + 10));
      showNotification('🎉 Achievement Unlocked: Level Up I (+100 FC, +10 Water)');
    }
  },
  {
    id: 'level_2',
    label: 'Level Up II',
    condition: () => getLevel() >= 10,
    reward: () => {
      setFarmCoins(getFarmCoins() + 250);
      setWater(prev => setWater(prev + 15));
      showNotification('🎉 Achievement Unlocked: Level Up II (+250 FC, +15 Water)');
    }
  },
  {
    id: 'coin_1',
    label: 'Coin Collector I',
    condition: () => getFarmCoins() >= 1000,
    reward: () => {
      setWater(prev => setWater(prev + 5));
      showNotification('💰 Coin Collector I Unlocked! (+5 Water)');
    }
  },
  {
    id: 'coin_2',
    label: 'Coin Collector II',
    condition: () => getFarmCoins() >= 10000,
    reward: () => {
      setFarmCoins(getFarmCoins() + 250);
      setWater(prev => setWater(prev + 10));
      showNotification('💰 Coin Collector II Unlocked! (+250 FC, +10 Water)');
    }
  },
  {
    id: 'pi_1',
    label: 'Pi Holder I',
    condition: () => getPiBalance() >= 0.01,
    reward: () => {
      setFarmCoins(getFarmCoins() + 150);
      showNotification('🪙 Pi Holder I Unlocked! (+150 FC)');
    }
  },
  {
    id: 'pi_2',
    label: 'Pi Holder II',
    condition: () => getPiBalance() >= 0.1,
    reward: () => {
      setFarmCoins(getFarmCoins() + 500);
      setWater(prev => setWater(prev + 20));
      showNotification('🪙 Pi Holder II Unlocked! (+500 FC, +20 Water)');
    }
  },
  {
    id: 'harvest_1',
    label: 'Harvester I',
    condition: () => getHarvestCount() >= 10,
    reward: () => {
      setFarmCoins(getFarmCoins() + 100);
      showNotification('🌾 Harvester I Unlocked! (+100 FC)');
    }
  },
  {
    id: 'harvest_2',
    label: 'Harvester II',
    condition: () => getHarvestCount() >= 50,
    reward: () => {
      setFarmCoins(getFarmCoins() + 300);
      setWater(prev => setWater(prev + 10));
      showNotification('🌾 Harvester II Unlocked! (+300 FC, +10 Water)');
    }
  },
  {
    id: 'seller_1',
    label: 'Seller I',
    condition: () => getFarmCoins() >= 2000, // hasil jual dianggap sebagai FC masuk
    reward: () => {
      setPiBalance(getPiBalance() + 0.005);
      showNotification('🧺 Seller I Unlocked! (+0.005 Pi)');
    }
  },
  {
    id: 'combo_1',
    label: 'Farm Master',
    condition: () =>
      getLevel() >= 10 &&
      getHarvestCount() >= 50 &&
      getFarmCoins() >= 10000 &&
      getPiBalance() >= 0.1,
    reward: () => {
      setFarmCoins(getFarmCoins() + 1000);
      setWater(prev => setWater(prev + 25));
      showNotification('🏆 Farm Master Unlocked! (+1000 FC, +25 Water)');
    }
  }
];

// Jalankan pengecekan semua achievement
export function checkAchievements() {
  const unlocked = getAchievements();

  let updated = false;
  ACHIEVEMENTS.forEach(({ id, condition, reward }) => {
    if (!unlocked[id] && condition()) {
      unlocked[id] = true;
      reward();
      updated = true;
    }
  });

  if (updated) {
    setAchievements(unlocked);
    updateWallet(); // untuk update UI
  }
}

// Render ke UI (opsional, kalau pakai badge atau daftar)
export function renderAchievements() {
  const container = document.getElementById('achievements-content');
  if (!container) return;

  const unlocked = getAchievements();
  container.innerHTML = '';

  ACHIEVEMENTS.forEach(({ id, label }) => {
    const el = document.createElement('div');
    el.className = 'achievement' + (unlocked[id] ? ' unlocked' : '');
    el.textContent = label;
    container.appendChild(el);
  });
}
