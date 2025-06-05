import {
  getInventory, setInventory,
  getLangData, getCurrentLang
} from '/core/global-state.js';

import { savePlayerData } from '/core/saver.js';
import { showNotification } from '/ui/notification.js';
import { addSafeClickListener } from '/core/dom-helper.js';
import { openSellTab } from '/features/sell.js';
import { playMenuSound } from '/core/audio.js';

// ===================== ADD TO INVENTORY =====================
export function addToInventory(type, veg, qty = 1) {
  if (!veg?.id) return;

  const inventory = getInventory();
  const index = inventory.findIndex(item =>
    item && item.type === type && item.vegetable?.id === veg.id
  );

  if (index !== -1) {
    inventory[index].quantity += qty;
  } else {
    inventory.push({ type, vegetable: veg, quantity: qty });
  }

  setInventory(inventory);
  savePlayerData();
}

// ===================== RENDER INVENTORY =====================
export function renderInventory() {
  const invEl = document.getElementById('inventory-content');
  if (!invEl) return console.error('inventory-content element not found');

  const lang = getLangData();
  const currentLang = getCurrentLang();
  const inventory = getInventory();

  invEl.innerHTML = '';
  let hasItems = false;

  inventory.forEach(item => {
    if (!item?.vegetable) return;

    const veg = item.vegetable;
    const isSeed = item.type === 'seed';
    const title = isSeed ? `${veg.name[currentLang]} Seed` : veg.name[currentLang];

    const div = document.createElement('div');
    div.classList.add('inventory-item');
    div.innerHTML = `
      <img src="${veg.shopImage}" alt="${title}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${title}</h3>
      <p>${lang[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
    `;
    invEl.appendChild(div);
    hasItems = true;
  });

  if (!hasItems) {
    const noItem = document.createElement('p');
    noItem.textContent = lang[currentLang]?.noInventory || 'No items in inventory.';
    invEl.appendChild(noItem);
  }

  const sellBtn = document.createElement('button');
  sellBtn.textContent = lang[currentLang]?.sellToShop || 'Sell to Shop';
  sellBtn.classList.add('sell-to-shop-btn');
  addSafeClickListener(sellBtn, () => {
    openSellTab();
    playMenuSound();
  });

  invEl.appendChild(sellBtn);
}
