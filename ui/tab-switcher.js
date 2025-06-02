import {
  getFarmCoins,
  getPiBalance,
  getWater,
  getLevel,
  getXp
} from '/core/global-state.js';
import { savePlayerData } from '/core/saver.js';

export function updateWallet() {
  const farmCoins = getFarmCoins();
  const piBalance = getPiBalance();
  const water = getWater();
  const level = getLevel();
  const xp = getXp();

  const xpNeeded = level * 100;
  const xpProgress = Math.min(100, (xp / xpNeeded) * 100);

  const updateText = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  const updateValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  updateText('farm-coins', `${farmCoins} Farm Coins`);
  updateText('pi-coins', `${piBalance.toFixed(6)} PI`);
  updateText('water', `${water} Water`);
  updateText('level', `Level: ${level} | XP: ${xp}`);

  const xpFill = document.getElementById('xp-fill');
  if (xpFill) xpFill.style.width = `${xpProgress}%`;

  updateValue('farm-coin-balance', farmCoins);
  updateValue('pi-coin-balance', piBalance.toFixed(6));

  savePlayerData();
}
