export function renderShop() { ... }
export async function buyVegetable(id, currency) { ... }
import {
  getFarmCoins, setFarmCoins,
  getPiBalance, setPiBalance,
  getWater, setWater,
  getLangData, getCurrentLang,
  getVegetables, getInventory, setInventory
} from '/core/global-state.js';
