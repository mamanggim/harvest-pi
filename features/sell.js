import {
  getInventory,
  setInventory,
  getFarmCoins,
  setFarmCoins,
  getXP,
  setXP,
  getLangData,
  getCurrentLang
} from '/core/global-state.js';

import { savePlayerData } from '/core/storage.js';
import { updateWallet } from '/ui/tab-switcher.js';
import { renderInventory } from './inventory.js';
import { playCoinSound, playMenuSound } from '/core/audio.js';
import { showNotification, showTransactionAnimation } from '/ui/notification.js';
import { checkLevelUp, checkCoinAchievement } from './achievements.js';

export function renderSellSection() {
  const sellContentElement = document.getElementById('sell-content');
  if (!sellContentElement) return console.error('[renderSellSection] Element #sell-content not found');

  const lang = getLangData()[getCurrentLang()];
  if (!lang) {
    sellContentElement.innerHTML = '<p style="color:red;">Language data not loaded</p>';
    return;
  }

  sellContentElement.innerHTML = '';

  const inventory = getInventory();
  const groupedHarvest = {};
  inventory.forEach((item) => {
    if (item?.type === 'harvest') {
      const vegId = item.vegetable.id;
      if (!groupedHarvest[vegId]) {
        groupedHarvest[vegId] = { ...item };
      } else {
        groupedHarvest[vegId].quantity += item.quantity;
      }
    }
  });

  const harvestItems = Object.values(groupedHarvest);
  if (harvestItems.length === 0) {
    sellContentElement.innerHTML = `<p>${lang.noSellableItems || 'No items to sell.'}</p>`;
    return;
  }

  harvestItems.forEach((item) => {
    const sellPrice = item.vegetable.sellPrice;
    if (typeof sellPrice !== 'number') return;

    const sellDiv = document.createElement('div');
    sellDiv.className = 'sell-item';
    sellDiv.innerHTML = `
      <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[getCurrentLang()]}" class="shop-item-img">
      <h3>${item.vegetable.name[getCurrentLang()]}</h3>
      <p>${lang.quantityLabel || 'Quantity'}: ${item.quantity}</p>
      <p>${lang.sellPriceLabel || 'Sell Price'}: ${sellPrice} Farm Coins</p>
      <button class="sell-btn" data-id="${item.vegetable.id}">${lang.sellLabel || 'Sell'}</button>
    `;
    sellContentElement.appendChild(sellDiv);
  });

  sellContentElement.querySelectorAll('.sell-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const vegId = btn.getAttribute('data-id');
      const inventory = getInventory();
      const index = inventory.findIndex(item =>
        item.type === 'harvest' && item.vegetable?.id === vegId
      );
      if (index !== -1) sellItem(index);
    });
  });
}

export function sellItem(index) {
  const inventory = getInventory();
  const item = inventory[index];
  if (!item || item.type !== 'harvest') return;

  const sellPrice = item.vegetable.sellPrice;
  if (typeof sellPrice !== 'number') return;

  const totalGain = sellPrice * item.quantity;
  setFarmCoins(getFarmCoins() + totalGain);
  setXP(getXP() + 10);

  const btnElement = document.querySelector(`.sell-btn[data-id="${item.vegetable.id}"]`);
  if (btnElement) {
    showTransactionAnimation(`+${totalGain}`, true, btnElement);
  }

  inventory.splice(index, 1);
  setInventory(inventory);
  savePlayerData();
  updateWallet();
  renderInventory();
  renderSellSection();
  playCoinSound();
  checkLevelUp();
  checkCoinAchievement();
}

export function openSellTab() {
  const buyTab = document.getElementById('shop-buy-tab');
  const sellTab = document.getElementById('shop-sell-tab');
  const shopContent = document.getElementById('shop-content');
  const sellContent = document.getElementById('sell-section');

  if (buyTab && sellTab && shopContent && sellContent) {
    sellTab.classList.add('active');
    buyTab.classList.remove('active');
    shopContent.style.display = 'none';
    sellContent.style.display = 'block';
    renderSellSection();
    playMenuSound();
  }
}
