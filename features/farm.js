import { getFarmPlots, setFarmPlots } from '/core/global-state.js';
import { savePlayerData } from '/core/saver.js';
import { addSafeClickListener } from '/core/utils.js';
import { updateUIText } from '/ui/language.js';

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

    // ...lanjutan render tanaman dan interval tetap sama seperti aslinya
  });

  updateUIText();
}

// features/farm.js

import {
  getLang, getCurrentLang,
  getFarmPlots, setFarmPlots,
  getWater, setWater,
  getInventory, setInventory,
  getHarvestCount, setHarvestCount
} from '/core/global-state.js';

import { savePlayerData } from '/core/saver.js';
import { updateWallet } from '/ui/tab-switcher.js';
import { renderInventory } from './inventory.js';
import { renderSellSection } from './sell.js';
import { showNotification } from '/ui/notification.js';
import { addSafeClickListener } from '/core/utils.js';
import {
  playHarvestingSound,
  playPlantingSound,
  playWateringSound
} from '/core/audio.js';
import { checkHarvestAchievement } from './achievements.js';

// Handle user click on a specific plot
export function handlePlotClick(index) {
  const farmPlots = getFarmPlots();
  const plot = farmPlots[index];
  const plotElement = document.querySelectorAll('.plot')[index];
  const plotContent = plotElement?.querySelector('.plot-content');
  const plotStatus = plotElement?.querySelector('.plot-status');
  const countdownFill = plotElement?.querySelector('.countdown-fill');
  const langData = getLang();
  const currentLang = getCurrentLang();
  let water = getWater();
  let inventory = getInventory();

  // === Menanam ===
  if (!plot.planted) {
    const seedIndex = inventory.findIndex(item => item?.type === 'seed' && item.quantity > 0);
    if (seedIndex === -1) {
      showNotification(langData[currentLang]?.noSeeds || 'No Seeds in inventory!');
      return;
    }

    const seed = inventory[seedIndex];
    const vegetable = seed.vegetable;

    Object.assign(plot, {
      planted: true,
      vegetable,
      progress: 0,
      watered: false,
      currentFrame: 1,
      countdown: vegetable.growthTime,
      totalCountdown: vegetable.growthTime
    });

    // Animasi tanam
    const flyImage = document.createElement('img');
    flyImage.src = vegetable.shopImage;
    flyImage.className = 'plant-fly';
    flyImage.style.width = '60px';

    const amountText = document.createElement('div');
    amountText.textContent = '-1';
    amountText.className = 'amount-text negative';

    plotContent?.append(flyImage, amountText);

    setTimeout(() => {
      flyImage.remove();
      amountText.remove();
      if (plotContent) {
        plotContent.innerHTML = '';
        const plantImg = document.createElement('img');
        plantImg.className = 'plant-img';
        plantImg.src = `${vegetable.baseImage}${plot.currentFrame}.png`;
        plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
        plotContent.appendChild(plantImg);
        setTimeout(() => plantImg.classList.add('loaded'), 50);
      }
    }, 800);

    plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
    countdownFill.style.width = '0%';

    seed.quantity -= 1;
    if (seed.quantity <= 0) inventory.splice(seedIndex, 1);

    setInventory(inventory);
    setFarmPlots(farmPlots);
    savePlayerData();
    renderInventory();
    showNotification(langData[currentLang]?.planted || 'Planted!');
    playPlantingSound();
    return;
  }

  // === Menyiram ===
  if (plot.planted && !plot.watered && plot.currentFrame < plot.vegetable.frames) {
    const waterNeeded = plot.vegetable.waterNeeded || 1;
    if (water < waterNeeded) {
      showNotification(langData[currentLang]?.notEnoughWater || 'Not Enough Water!');
      return;
    }

    water -= waterNeeded;
    setWater(water);
    plot.watered = true;

    const waterImage = document.createElement('img');
    waterImage.src = 'assets/img/ui/water_icon.png';
    waterImage.onerror = () => waterImage.src = 'assets/img/ui/placeholder.png';
    waterImage.className = 'water-fly';
    waterImage.style.width = '40px';
    waterImage.style.top = '-40px';

    const amountText = document.createElement('div');
    amountText.textContent = `-${waterNeeded}`;
    amountText.className = 'amount-text negative';

    plotContent?.append(waterImage, amountText);

    setTimeout(() => {
      waterImage.remove();
      amountText.remove();
    }, 800);

    updateWallet();
    showNotification(langData[currentLang]?.watered || 'Watered!');
    playWateringSound();

    const countdownInterval = setInterval(() => {
      if (!plot.planted || !plot.watered) {
        clearInterval(countdownInterval);
        countdownFill.style.width = '0%';
        return;
      }

      plot.countdown--;
      const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
      countdownFill.style.width = `${progress}%`;

      if (plot.countdown <= 0) {
        plot.currentFrame++;
        plot.watered = false;
        plot.countdown = plot.vegetable.growthTime;
        plot.totalCountdown = plot.vegetable.growthTime;

        let plantImg = plotContent?.querySelector('.plant-img');
        if (!plantImg) {
          plantImg = document.createElement('img');
          plantImg.className = 'plant-img';
          plotContent?.appendChild(plantImg);
        }

        plantImg.classList.remove('loaded');
        plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
        plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
        setTimeout(() => plantImg.classList.add('loaded'), 50);

        if (plot.currentFrame >= plot.vegetable.frames) {
          plotElement.classList.add('ready');
          plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
          countdownFill.style.width = '100%';
          clearInterval(countdownInterval);
        } else {
          plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
          countdownFill.style.width = '0%';
        }
      } else {
        plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
      }

      savePlayerData();
    }, 1000);

    return;
  }

  // === Panen ===
  if (plot.currentFrame >= plot.vegetable.frames || plotElement.classList.contains('ready')) {
    const yieldAmount = plot.vegetable.yield;
    addToInventory('harvest', plot.vegetable, yieldAmount);

    const imageSrc = plot.vegetable?.shopImage || 'assets/img/ui/placeholder.png';
    const flyImage = document.createElement('img');
    flyImage.src = imageSrc;
    flyImage.className = 'plant-fly';
    flyImage.style.width = '60px';

    const rect = plotContent?.getBoundingClientRect() || { left: 0, top: 0, width: 0 };
    flyImage.style.left = `${rect.left + rect.width / 2 - 30}px`;
    flyImage.style.top = `${rect.top}px`;
    document.body.appendChild(flyImage);

    const amountText = document.createElement('div');
    amountText.textContent = `+${yieldAmount}`;
    amountText.className = 'amount-text positive';
    plotContent?.appendChild(amountText);

    setTimeout(() => {
      flyImage.remove();
      amountText.remove();
      plotContent.innerHTML = '';
      plotStatus.innerHTML = '';
      countdownFill.style.width = '0%';
      plotElement.classList.remove('ready');
    }, 800);

    Object.assign(plot, {
      planted: false,
      vegetable: null,
      progress: 0,
      watered: false,
      currentFrame: 1,
      countdown: 0,
      totalCountdown: 0
    });

    setHarvestCount(getHarvestCount() + 1);
    setFarmPlots(farmPlots);
    savePlayerData();
    checkHarvestAchievement();
    showNotification(langData[currentLang]?.harvested || 'Harvested!');
    playHarvestingSound();
    renderInventory();
    renderSellSection();
  }
}

// Paksa reflow agar CSS grid langsung terbentuk
export function forceReflow(el) {
  void el.offsetHeight;
}
