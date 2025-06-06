import {
  getFarmCoins, setFarmCoins,
  getPiBalance, setPiBalance,
  getLangData, getCurrentLang,
  getVegetables, getInventory, setInventory
} from '/core/global-state.js';

import { showNotification } from '/ui/notification.js';
import { renderInventory } from './inventory.js';

export function renderShop() {
  const shopContent = document.getElementById('shop-content');
  if (!shopContent) return;

  shopContent.innerHTML = '';

  const langData = getLangData();
  const lang = getCurrentLang();
  const vegetables = getVegetables();

  vegetables.forEach(veg => {
    const item = document.createElement('div');
    item.className = 'shop-item';

    item.innerHTML = `
      <img src="${veg.shopImage}" class="shop-item-img" alt="${veg.name}" />
      <h3>${veg.name}</h3>
      <p>${langData[lang]?.priceLabel || 'Price'}: ${veg.price} ${veg.currency}</p>
      <button data-id="${veg.id}" data-currency="${veg.currency}">
        ${langData[lang]?.buy || 'Buy'}
      </button>
    `;

    const btn = item.querySelector('button');
    btn.addEventListener('click', () => {
      buyVegetable(veg.id, veg.currency);
    });

    shopContent.appendChild(item);
  });
}

export function buyVegetable(id, currency) {
  const vegetables = getVegetables();
  const veg = vegetables.find(v => v.id === id);
  if (!veg) return;

  const inventory = getInventory();
  const langData = getLangData();
  const lang = getCurrentLang();

  if (currency === 'farm') {
    const coins = getFarmCoins();
    if (coins < veg.price) {
      showNotification(langData[lang]?.notEnoughCoins || 'Not enough Farm Coins!');
      return;
    }
    setFarmCoins(coins - veg.price);
  } else if (currency === 'pi') {
    const pi = getPiBalance();
    if (pi < veg.price) {
      showNotification(langData[lang]?.notEnoughPi || 'Not enough Pi!');
      return;
    }
    setPiBalance(pi - veg.price);
  } else {
    showNotification('❌ Unknown currency');
    return;
  }

  // Tambahkan seed ke inventory
  const existing = inventory.find(i => i.id === id && i.type === 'seed');
  if (existing) {
    existing.quantity += 1;
  } else {
    inventory.push({
      id,
      type: 'seed',
      vegetable: veg,
      quantity: 1
    });
  }

  setInventory(inventory);
  renderInventory();
  showNotification(langData[lang]?.purchaseSuccess || 'Purchase successful!');
}
