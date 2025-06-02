import { getFarmCoins, getPiBalance, getWater, getLevel, getXp } from '/core/global-state.js';
import { savePlayerData } from '/core/saver.js';

export function updateWallet() {
  const farmCoins = getFarmCoins();
  const piBalance = getPiBalance();
  const water = getWater();
  const level = getLevel();
  const xp = getXp();

  const farmCoinsElement = document.getElementById('farm-coins');
  const piCoinsElement = document.getElementById('pi-coins');
  const waterElement = document.getElementById('water');
  const levelElement = document.getElementById('level');
  const xpFillElement = document.getElementById('xp-fill');
  const farmCoinBalanceElement = document.getElementById('farm-coin-balance');
  const piCoinBalanceElement = document.getElementById('pi-coin-balance');

  if (farmCoinsElement) farmCoinsElement.textContent = `${farmCoins} Farm Coins`;
  if (piCoinsElement) piCoinsElement.textContent = `${piBalance.toFixed(6)} PI`;
  if (waterElement) waterElement.textContent = `${water} Water`;
  if (levelElement) levelElement.textContent = `Level: ${level} | XP: ${xp}`;
  if (xpFillElement) xpFillElement.style.width = `${(xp / (level * 100)) * 100}%`;
  if (farmCoinBalanceElement) farmCoinBalanceElement.textContent = farmCoins;
  if (piCoinBalanceElement) piCoinBalanceElement.textContent = piBalance.toFixed(6);

  savePlayerData(); // Simpan otomatis
}
