import {
  getLang, getFarmPlots, setFarmPlots,
  getWater, setWater,
  getInventory, setInventory,
  getHarvestCount, setHarvestCount
} from '/core/global-state.js';

import { savePlayerData } from '/core/saver.js';
import { updateWallet } from '/ui/tab-switcher.js';
import { renderInventory } from './inventory.js';
import { renderSellSection } from './sell.js';
import { showNotification } from '/ui/notification.js';
import { addSafeClickListener } from '/core/dom-helper.js';
import { updateUIText } from '/ui/language.js';
import {
  playHarvestingSound,
  playPlantingSound,
  playWateringSound
} from '/core/audio.js';

import { checkHarvestAchievement } from './achievements.js';

export function initializePlots() {
  const farmAreaElement = document.getElementById('farm-area');
  if (!farmAreaElement) {
    console.error('farm-area element not found');
    return;
  }

  let farmPlots = getFarmPlots();

  farmAreaElement.innerHTML = '';
  if (!farmPlots || farmPlots.length === 0) {
    farmPlots = Array.from({ length: 4 }, () => ({
      planted: false,
      vegetable: null,
      progress: 0,
      watered: false,
      currentFrame: 1,
      countdown: 0,
      totalCountdown: 0
    }));
    setFarmPlots(farmPlots);
  }

  farmPlots.forEach((plot, i) => {
    const plotElement = document.createElement('div');
    plotElement.classList.add('plot');
    plotElement.innerHTML = `
      <div class="plot-content"></div>
      <div class="countdown-bar"><div class="countdown-fill"></div></div>
      <div class="plot-status"></div>
    `;
    addSafeClickListener(plotElement, () => handlePlotClick(i));
    farmAreaElement.appendChild(plotElement);
  });

  updateUIText();
}
