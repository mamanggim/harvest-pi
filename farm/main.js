// Ambil database dan auth dari firebase-config.js
import { 
  auth, database, messaging, ref, onValue, set, update, get, push 
} from '/firebase/firebase-config.js';
import { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Deklarasi elemen global
const claimModalBtn = document.getElementById('claim-modal-btn');
const rewardModal = document.getElementById('reward-modal');

// Helper untuk click aman (prevent double click)
function addSafeClickListener(element, callback) {
  let isLocked = false;
  const handleClick = (e) => {
    if (isLocked) return;
    isLocked = true;
    callback(e);
    setTimeout(() => isLocked = false, 300);
  };
  if (element) {
    element.addEventListener('click', handleClick);
    element.addEventListener('touchstart', handleClick);
  }
}

// Global variables
let isDataLoaded = false;
let piInitialized = false;
let farmCoins = 0;
let piBalance = 0;
let water = 0;
let level = 1;
let xp = 0;
let inventory = [];
let vegetables = [];
let langData = {};
let currentLang = localStorage.getItem('language') || 'en';
let farmPlots = [];
let harvestCount = 0;
let achievements = { harvest: false, coins: false };
let userId = localStorage.getItem('userId') || null;
let lastClaim = null;
const plotCount = 4;
const piToFarmRate = 1000000;
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;

// Audio elements
const bgMusic = document.getElementById('bg-music');
const bgVoice = document.getElementById('bg-voice');
const harvestingSound = document.getElementById('harvesting-sound');
const wateringSound = document.getElementById('watering-sound');
const plantingSound = document.getElementById('planting-sound');
const menuSound = document.getElementById('menu-sound');
const buyingSound = document.getElementById('buying-sound');
const coinSound = document.getElementById('coin-sound');

// Audio control functions
function playAudio(audioElement, logMessage) {
  if (audioElement && !isAudioPlaying) {
    const playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => console.log(logMessage))
        .catch(e => {
          console.log(`${logMessage} failed:`, e.message);
          setTimeout(() => audioElement.play().catch(err => console.log(`Retry ${logMessage} failed:`, err.message)), 100);
        });
    }
  }
}

function playBgMusic() { playAudio(bgMusic, 'Background music started successfully'); }
function playBgVoice() { playAudio(bgVoice, 'Background voice started successfully'); }
function playHarvestingSound() { if (harvestingSound) harvestingSound.play().catch(e => console.log('Harvest sound failed:', e.message)); }
function playWateringSound() { if (wateringSound) wateringSound.play().catch(e => console.log('Watering sound failed:', e.message)); }
function playPlantingSound() { if (plantingSound) plantingSound.play().catch(e => console.log('Planting sound failed:', e.message)); }
function playMenuSound() { if (menuSound) menuSound.play().catch(e => console.log('Menu sound failed:', e.message)); }
function playBuyingSound() { if (buyingSound) buyingSound.play().catch(e => console.log('Buying sound failed:', e.message)); }
function playCoinSound() { if (coinSound) coinSound.play().catch(e => console.log('Coin sound failed:', e.message)); }

// Update audio volumes
function updateVolumes() {
  const musicVol = Math.min(Math.max((localStorage.getItem('musicVolume') ?? 50) / 100, 0), 1);
  const voiceVol = Math.min(Math.max((localStorage.getItem('voiceVolume') ?? 50) / 100, 0), 1);
  [bgMusic, bgVoice, harvestingSound, wateringSound, plantingSound, menuSound, buyingSound, coinSound]
    .forEach(el => el && (el.volume = el === bgMusic ? musicVol : voiceVol));
  console.log('Updated Volumes:', { musicVol, voiceVol });
}

// Fungsi validasi email
function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// Fungsi encode email
function encodeEmail(email) {
  return email ? email.replace('@', '_at_').replace('.', '_dot_') : '';
}

// Fungsi copy ke clipboard
function copyToClipboard(text, button) {
  if (button) {
    navigator.clipboard.writeText(text).then(() => {
      button.textContent = 'Copied!';
      setTimeout(() => button.textContent = 'Copy', 2000);
    }).catch(err => console.error('Gagal copy:', err));
  }
}

// Load data dari JSON
async function loadData() {
  try {
    const [langRes, vegRes] = await Promise.all([fetch('/data/lang.json'), fetch('/data/vegetables.json')]);
    langData = await langRes.json();
    const vegJson = await vegRes.json();
    vegetables = vegJson.vegetables || [];
    console.log('Data loaded:', { langData, vegetables });
  } catch (error) {
    console.error('Error loading data:', error.message);
    showNotification('Error loading game data.');
  }
}

// Load user balances
function loadUserBalances() {
  const playerRef = ref(database, `players/${userId}`);
  onValue(playerRef, (snapshot) => {
    const data = snapshot.val() || {};
    piBalance = data.piBalance || 0;
    farmCoins = data.farmCoins || 0;
    updateWallet();
  });
}

// Load player data
function loadPlayerData() {
  if (!userId) {
    console.warn('No userId, please login first!');
    return;
  }
  const playerRef = ref(database, `players/${userId}`);
  onValue(playerRef, (snapshot) => {
    if (isDataLoaded) return;
    const data = snapshot.val() || {};
    farmCoins = data.farmCoins || 0;
    piBalance = data.piBalance || 0;
    water = data.water || 0;
    level = data.level || 1;
    xp = data.xp || 0;
    inventory = data.inventory || [];
    farmPlots = data.farmPlots || [];
    harvestCount = data.harvestCount || 0;
    achievements = data.achievements || { harvest: false, coins: false };
    lastClaim = data.lastClaim || null;
    claimedToday = data.claimedToday || false;
    if (!data.farmPlots || data.farmPlots.length === 0) {
      farmPlots = Array(plotCount).fill().map(() => ({
        planted: false, vegetable: null, progress: 0, watered: false, currentFrame: 1, countdown: 0, totalCountdown: 0
      }));
    }
    isDataLoaded = true;
    updateWallet();
    initializePlots();
    renderShop();
    renderInventory();
    renderSellSection();
    renderAchievements();
    checkDailyReward();
  }, { onlyOnce: false });
}

// Save player data (debounced)
let saveTimeout;
async function savePlayerData() {
  if (!userId || !isDataLoaded) return;
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const playerRef = ref(database, `players/${userId}`);
    try {
      await update(playerRef, {
        farmCoins, piBalance, water, level, xp, inventory, farmPlots, harvestCount, achievements, lastClaim, claimedToday
      });
      console.log('Player data saved');
    } catch (error) {
      console.error('Error saving player data:', error.message);
      showNotification('Error saving data');
    }
  }, 500); // Debounce 500ms
}

// Update wallet UI
function updateWallet() {
  const elements = {
    farmCoins: document.getElementById('farm-coins'),
    piCoins: document.getElementById('pi-coins'),
    water: document.getElementById('water'),
    level: document.getElementById('level'),
    xpFill: document.getElementById('xp-fill'),
    farmCoinBalance: document.getElementById('farm-coin-balance'),
    piCoinBalance: document.getElementById('pi-coin-balance')
  };
  if (elements.farmCoins) elements.farmCoins.textContent = `${farmCoins} Farm Coins`;
  if (elements.piCoins) elements.piCoins.textContent = `${piBalance.toFixed(6)} PI`;
  if (elements.water) elements.water.textContent = `${water} Water`;
  if (elements.level) elements.level.textContent = `Level: ${level} | XP: ${xp}`;
  if (elements.xpFill) elements.xpFill.style.width = `${(xp / (level * 100)) * 100}%`;
  if (elements.farmCoinBalance) elements.farmCoinBalance.textContent = farmCoins;
  if (elements.piCoinBalance) elements.piCoinBalance.textContent = piBalance.toFixed(6);
  savePlayerData();
}

// Initialize farm plots
function initializePlots() {
  const farmAreaElement = document.getElementById('farm-area');
  if (!farmAreaElement) {
    console.error('farm-area element not found');
    showNotification('farm-area element not found');
    return;
  }
  farmAreaElement.innerHTML = '';
  if (!farmPlots || farmPlots.length === 0) {
    farmPlots = Array(plotCount).fill().map(() => ({
      planted: false, vegetable: null, progress: 0, watered: false, currentFrame: 1, countdown: 0, totalCountdown: 0
    }));
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
    updatePlotDisplay(plotElement, plot);
  });
  updateUIText();
}

function updatePlotDisplay(plotElement, plot) {
  const plotContent = plotElement.querySelector('.plot-content');
  const plotStatus = plotElement.querySelector('.plot-status');
  const countdownFill = plotElement.querySelector('.countdown-fill');
  if (plot.planted && plot.vegetable) {
    const plantImg = document.createElement('img');
    plantImg.classList.add('plant-img');
    plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
    plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
    plotContent.innerHTML = '';
    plotContent.appendChild(plantImg);
    setTimeout(() => plantImg.classList.add('loaded'), 50);

    if (plot.currentFrame >= plot.vegetable.frames) {
      plotElement.classList.add('ready');
      plotStatus.textContent = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
      countdownFill.style.width = '100%';
    } else if (plot.watered) {
      plotStatus.textContent = langData[currentLang]?.growing || 'Growing';
      countdownFill.style.width = `${(1 - plot.countdown / plot.totalCountdown) * 100}%`;
    } else {
      plotStatus.textContent = langData[currentLang]?.needsWater || 'Needs Water';
      countdownFill.style.width = '0%';
    }
  } else {
    plotElement.classList.remove('ready');
    plotContent.innerHTML = '';
    plotStatus.textContent = '';
    countdownFill.style.width = '0%';
  }
}

// Handle plot click
function handlePlotClick(index) {
  const plot = farmPlots[index];
  const plotElement = document.querySelectorAll('.plot')[index];
  if (!plotElement) return;
  const plotContent = plotElement.querySelector('.plot-content');
  const plotStatus = plotElement.querySelector('.plot-status');
  const countdownFill = plotElement.querySelector('.countdown-fill');

  if (!plot.planted) {
    const seedIndex = inventory.findIndex(item => item?.type === 'seed' && item.quantity > 0);
    if (seedIndex !== -1) {
      const { vegetable } = inventory[seedIndex];
      plot.planted = true;
      plot.vegetable = vegetable;
      plot.watered = false;
      plot.currentFrame = 1;
      plot.countdown = vegetable.growthTime;
      plot.totalCountdown = vegetable.growthTime;
      animatePlanting(plotElement, plotContent, vegetable, seedIndex);
      playPlantingSound();
    } else {
      showNotification(langData[currentLang]?.noSeeds || 'No Seeds in inventory!');
    }
  } else if (!plot.watered && plot.currentFrame < plot.vegetable.frames) {
    const waterNeeded = plot.vegetable.waterNeeded || 1;
    if (water >= waterNeeded) {
      water -= waterNeeded;
      plot.watered = true;
      animateWatering(plotElement, plotContent, waterNeeded);
      playWateringSound();
      startPlotCountdown(plot, plotElement, plotContent, plotStatus, countdownFill);
    } else {
      showNotification(langData[currentLang]?.notEnoughWater || 'Not Enough Water!');
    }
  } else if (plot.currentFrame >= plot.vegetable.frames || plotElement.classList.contains('ready')) {
    const yieldAmount = plot.vegetable.yield;
    addToInventory('harvest', plot.vegetable, yieldAmount);
    plot.planted = false;
    plot.vegetable = null;
    plot.currentFrame = 1;
    plot.countdown = 0;
    animateHarvest(plotElement, plotContent, yieldAmount);
    playHarvestingSound();
    harvestCount++;
    checkHarvestAchievement();
    renderInventory();
    renderSellSection();
  }
  savePlayerData();
}

function animatePlanting(plotElement, plotContent, vegetable, seedIndex) {
  const flyImage = createFlyImage(vegetable.shopImage, 'plant-fly', 60);
  const amountText = createAmountText('-1', 'negative');
  plotContent.appendChild(flyImage);
  plotContent.appendChild(amountText);
  setTimeout(() => {
    [flyImage, amountText].forEach(el => el.parentNode && el.remove());
    plotContent.innerHTML = '';
    const plantImg = document.createElement('img');
    plantImg.classList.add('plant-img');
    plantImg.src = `${vegetable.baseImage}1.png`;
    plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
    plotContent.appendChild(plantImg);
    setTimeout(() => plantImg.classList.add('loaded'), 50);
  }, 800);
  inventory[seedIndex].quantity--;
  if (inventory[seedIndex].quantity <= 0) inventory.splice(seedIndex, 1);
  showNotification(langData[currentLang]?.planted || 'Planted!');
}

function animateWatering(plotElement, plotContent, waterNeeded) {
  const waterImage = createFlyImage('assets/img/ui/water_icon.png', 'water-fly', 40, '-40px');
  const amountText = createAmountText(`-${waterNeeded}`, 'negative');
  plotContent.appendChild(waterImage);
  plotContent.appendChild(amountText);
  setTimeout(() => [waterImage, amountText].forEach(el => el.parentNode && el.remove()), 800);
  updateWallet();
  showNotification(langData[currentLang]?.watered || 'Watered!');
}

function animateHarvest(plotElement, plotContent, yieldAmount) {
  const flyImage = createFlyImage(plot.vegetable.shopImage, 'plant-fly', 60);
  const amountText = createAmountText(`+${yieldAmount}`, 'positive');
  document.body.appendChild(flyImage);
  plotContent.appendChild(amountText);
  const rect = plotContent.getBoundingClientRect();
  flyImage.style.left = `${rect.left + rect.width / 2 - 30}px`;
  flyImage.style.top = `${rect.top}px`;
  setTimeout(() => {
    [flyImage, amountText].forEach(el => el.parentNode && el.remove());
    plotContent.innerHTML = '';
    plotElement.classList.remove('ready');
  }, 800);
  showNotification(langData[currentLang]?.harvested || 'Harvested!');
}

function createFlyImage(src, className, width, top = '0') {
  const img = document.createElement('img');
  img.src = src;
  img.classList.add(className);
  img.style.width = `${width}px`;
  img.style.top = top;
  img.onerror = () => img.src = 'assets/img/ui/placeholder.png';
  return img;
}

function createAmountText(text, className) {
  const div = document.createElement('div');
  div.textContent = text;
  div.classList.add('amount-text', className);
  return div;
}

function startPlotCountdown(plot, plotElement, plotContent, plotStatus, countdownFill) {
  let interval = setInterval(() => {
    if (!plot.planted) {
      clearInterval(interval);
      countdownFill.style.width = '0%';
      return;
    }
    if (plot.currentFrame >= plot.vegetable.frames) {
      clearInterval(interval);
      plotElement.classList.add('ready');
      plotStatus.textContent = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
      countdownFill.style.width = '100%';
      return;
    }
    if (plot.watered) {
      plot.countdown--;
      const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
      countdownFill.style.width = `${progress}%`;
      if (plot.countdown <= 0) {
        plot.currentFrame++;
        plot.watered = false;
        plot.countdown = plot.vegetable.growthTime;
        let plantImg = plotContent.querySelector('.plant-img');
        if (!plantImg) {
          plantImg = createFlyImage(`${plot.vegetable.baseImage}${plot.currentFrame}.png`, 'plant-img');
          plotContent.appendChild(plantImg);
        } else {
          plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
        }
        setTimeout(() => plantImg.classList.add('loaded'), 50);
        if (plot.currentFrame >= plot.vegetable.frames) {
          plotElement.classList.add('ready');
          plotStatus.textContent = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
          countdownFill.style.width = '100%';
        } else {
          plotStatus.textContent = langData[currentLang]?.needsWater || 'Needs Water';
          countdownFill.style.width = '0%';
        }
      } else {
        plotStatus.textContent = langData[currentLang]?.growing || 'Growing';
      }
    } else {
      plotStatus.textContent = langData[currentLang]?.needsWater || 'Needs Water';
      countdownFill.style.width = '0%';
      clearInterval(interval);
    }
  }, 1000);
}

// Add to inventory
function addToInventory(type, veg, qty = 1) {
  if (!veg || !veg.id) return;
  const existing = inventory.findIndex(item => item?.type === type && item.vegetable?.id === veg.id);
  if (existing !== -1) {
    inventory[existing].quantity += qty;
  } else {
    inventory.push({ type, vegetable: veg, quantity: qty });
  }
  savePlayerData();
}

// Check level up
function checkLevelUp() {
  const xpRequired = level * 100;
  while (xp >= xpRequired) {
    xp -= xpRequired;
    level++;
    showNotification(`${langData[currentLang]?.levelUp || 'Level Up!'} ${level}`);
  }
  updateWallet();
}

// Check achievements
function checkHarvestAchievement() {
  if (harvestCount >= 10 && !achievements.harvest) {
    achievements.harvest = true;
    farmCoins += 500;
    showNotification(langData[currentLang]?.harvestAchievement || 'Achievement Unlocked: Harvest Master! +500 Coins');
    updateWallet();
    renderAchievements();
  }
}

function checkCoinAchievement() {
  if (farmCoins >= 1000 && !achievements.coins) {
    achievements.coins = true;
    water += 100;
    showNotification(langData[currentLang]?.coinAchievement || 'Achievement Unlocked: Coin Collector! +100 Water');
    updateWallet();
    renderAchievements();
  }
}

// Render shop
function renderShop() {
  const shopContentElement = document.getElementById('shop-content');
  if (!shopContentElement) return;
  shopContentElement.style.display = 'grid';
  if (!langData[currentLang] || !Array.isArray(vegetables) || vegetables.length === 0) {
    shopContentElement.innerHTML = `<p>${langData[currentLang]?.noItems || 'No items available in shop.'}</p>`;
    return;
  }
  shopContentElement.innerHTML = '';
  vegetables.forEach(veg => {
    const item = document.createElement('div');
    item.classList.add('shop-item');
    item.innerHTML = `
      <img src="${veg.shopImage}" alt="${veg.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${veg.name[currentLang]}</h3>
      <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: ${veg.farmPrice || 0} Farm Coins</p>
      <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: ${veg.piPrice || 0} PI</p>
      <button class="buy-btn" data-id="${veg.id}">Buy (Farm)</button>
      <button class="buy-pi-btn" data-id="${veg.id}">Buy (PI)</button>
    `;
    shopContentElement.appendChild(item);
  });
  const waterItem = document.createElement('div');
  waterItem.classList.add('shop-item');
  waterItem.innerHTML = `
    <img src="assets/img/ui/water_icon.png" alt="${langData[currentLang]?.waterLabel || 'Water'}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
    <h3>${langData[currentLang]?.waterLabel || 'Water'}</h3>
    <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: 100 Farm Coins</p>
    <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: 0.0001 PI</p>
    <button class="buy-btn" data-id="water">Buy (Farm)</button>
    <button class="buy-pi-btn" data-id="water">Buy (PI)</button>
  `;
  shopContentElement.appendChild(waterItem);
  document.querySelectorAll('.buy-btn').forEach(btn => addSafeClickListener(btn, () => buyVegetable(btn.dataset.id, 'farm')));
  document.querySelectorAll('.buy-pi-btn').forEach(btn => addSafeClickListener(btn, () => buyVegetable(btn.dataset.id, 'pi')));
}

// Buy vegetable or water
let isSaving = false;
async function buyVegetable(id, currency) {
  if (isSaving) return;
  isSaving = true;
  try {
    if (id === 'water') {
      if (currency === 'farm' && farmCoins >= 100) {
        farmCoins -= 100; water += 10; showTransactionAnimation('-100', false);
      } else if (currency === 'pi' && piBalance >= 0.0001) {
        piBalance -= 0.0001; water += 10; showTransactionAnimation('-0.0001 PI', false);
      } else {
        showNotification(currency === 'farm' ? langData[currentLang]?.notEnoughCoins : langData[currentLang]?.notEnoughPi);
        return;
      }
    } else {
      const veg = vegetables.find(v => v.id === id);
      if (!veg) return;
      if (currency === 'farm' && farmCoins >= veg.farmPrice) {
        farmCoins -= veg.farmPrice; showTransactionAnimation(`-${veg.farmPrice}`, false);
      } else if (currency === 'pi' && piBalance >= veg.piPrice) {
        piBalance -= veg.piPrice; showTransactionAnimation(`-${veg.piPrice} PI`, false);
      } else {
        showNotification(currency === 'farm' ? langData[currentLang]?.notEnoughCoins : langData[currentLang]?.notEnoughPi);
        return;
      }
      addToInventory('seed', veg);
    }
    updateWallet();
    renderInventory();
    playBuyingSound();
  } catch (error) {
    console.error('Error in buyVegetable:', error.message);
    showNotification('Error during purchase');
  } finally {
    isSaving = false;
  }
}

// Render inventory
function renderInventory() {
  const inventoryContentElement = document.getElementById('inventory-content');
  if (!inventoryContentElement) return;
  inventoryContentElement.innerHTML = '';
  const hasItems = inventory.some(item => item?.vegetable);
  inventory.forEach(item => {
    if (!item?.vegetable) return;
    const invItem = document.createElement('div');
    invItem.classList.add('inventory-item');
    invItem.innerHTML = `
      <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${item.type === 'seed' ? `${item.vegetable.name[currentLang]} Seed` : item.vegetable.name[currentLang]}</h3>
      <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
    `;
    inventoryContentElement.appendChild(invItem);
  });
  if (!hasItems) {
    const noItemText = document.createElement('p');
    noItemText.textContent = langData[currentLang]?.noInventory || 'No items in inventory.';
    inventoryContentElement.appendChild(noItemText);
  }
  const sellButton = document.createElement('button');
  sellButton.textContent = langData[currentLang]?.sellToShop || 'Sell to Shop';
  sellButton.classList.add('sell-to-shop-btn');
  addSafeClickListener(sellButton, openSellTab);
  inventoryContentElement.appendChild(sellButton);
}

// Render sell section
function renderSellSection() {
  const sellContentElement = document.getElementById('sell-content');
  if (!sellContentElement) return;
  sellContentElement.innerHTML = '';
  const groupedHarvest = {};
  inventory.forEach((item, index) => {
    if (item?.type === 'harvest') {
      if (!groupedHarvest[item.vegetable.id]) groupedHarvest[item.vegetable.id] = { ...item, index };
      else groupedHarvest[item.vegetable.id].quantity += item.quantity;
    }
  });
  let hasItems = false;
  Object.values(groupedHarvest).forEach(item => {
    const sellDiv = document.createElement('div');
    sellDiv.classList.add('sell-item');
    sellDiv.innerHTML = `
      <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img">
      <h3>${item.vegetable.name[currentLang]}</h3>
      <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
      <p>${langData[currentLang]?.sellPriceLabel || 'Sell Price'}: ${item.vegetable.sellPrice} Farm Coins</p>
      <button class="sell-btn" data-index="${item.index}">Sell</button>
    `;
    sellContentElement.appendChild(sellDiv);
    hasItems = true;
  });
  if (!hasItems) sellContentElement.innerHTML = `<p>${langData[currentLang]?.noSellableItems || 'No items to sell.'}</p>`;
  document.querySelectorAll('.sell-btn').forEach(btn => addSafeClickListener(btn, () => sellItem(parseInt(btn.dataset.index))));
}

// Sell item
function sellItem(index) {
  const item = inventory[index];
  if (!item || item.type !== 'harvest') return;
  const sellPrice = item.vegetable.sellPrice;
  if (typeof sellPrice !== 'number') {
    showNotification('Cannot sell: Missing sellPrice data.');
    return;
  }
  farmCoins += sellPrice * item.quantity;
  xp += 10;
  showTransactionAnimation(`+${sellPrice * item.quantity}`, true);
  inventory.splice(index, 1);
  savePlayerData();
  updateWallet();
  renderInventory();
  renderSellSection();
  playCoinSound();
  checkLevelUp();
  checkCoinAchievement();
}

// Open sell tab
function openSellTab() {
  switchTab('shop');
  const buyTab = document.getElementById('shop-buy-tab');
  const sellTab = document.getElementById('shop-sell-tab');
  const shopContent = document.getElementById('shop-content');
  const sellContent = document.getElementById('sell-section');
  if (sellTab && buyTab && shopContent && sellContent) {
    sellTab.classList.add('active');
    buyTab.classList.remove('active');
    shopContent.style.display = 'none';
    sellContent.style.display = 'block';
    renderSellSection();
  }
}

// Switch tabs
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const tabContent = document.getElementById(tab);
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (tabContent && tabBtn) {
    tabContent.classList.add('active');
    tabBtn.classList.add('active');
  }
  if (tab === 'shop') {
    renderShop();
    renderSellSection();
  } else if (tab === 'inventory') {
    renderInventory();
  } else if (tab === 'achievements') {
    renderAchievements();
  } else if (tab === 'exchange') {
    updateExchangeResult();
  }
  playMenuSound();
}

// Exchange logic
let currentExchangeRate = 1000000;
function loadExchangeRate() {
  onValue(ref(database, "exchangeRate/liveRate"), (snapshot) => {
    currentExchangeRate = snapshot.val() || currentExchangeRate;
    const rateEl = document.getElementById('live-rate');
    if (rateEl) rateEl.textContent = `1 Pi = ${currentExchangeRate.toLocaleString()} FC`;
    updateExchangeResult();
  });
}
loadExchangeRate();

function updateExchangeResult() {
  const amount = parseFloat(document.getElementById('exchange-amount').value.replace(',', '.')) || 0;
  const direction = document.getElementById('exchange-direction').value;
  const result = direction === 'piToFc' ? Math.floor(amount * currentExchangeRate) : amount / currentExchangeRate;
  const resultText = direction === 'piToFc' ? result.toLocaleString() : result.toLocaleString(undefined, { maximumFractionDigits: 6 });
  const resultDiv = document.getElementById('exchange-result');
  resultDiv.textContent = resultText.length > 25 ? resultText.substring(0, 25) + '…' : resultText;
  resultDiv.title = resultText;
}

async function handleExchange() {
  const amount = parseFloat(document.getElementById('exchange-amount').value.replace(',', '.')) || 0;
  const direction = document.getElementById('exchange-direction').value;
  const playerRef = ref(database, `players/${userId}`);
  const snapshot = await get(playerRef);
  const data = snapshot.val() || {};
  if (!data || isNaN(amount) || amount <= 0) return showNotification('Invalid amount or player data!');
  let piBalance = Number(data.piBalance || 0);
  let fc = Number(data.farmCoins || 0);
  if (direction === 'piToFc' && piBalance < amount) return showNotification('Not enough Pi!');
  if (direction !== 'piToFc' && fc < amount) return showNotification('Not enough FC!');
  const converted = direction === 'piToFc' ? Math.floor(amount * currentExchangeRate) : amount / currentExchangeRate;
  piBalance = direction === 'piToFc' ? piBalance - amount : piBalance + converted;
  fc = direction === 'piToFc' ? fc + converted : fc - amount;
  piBalance = Math.round(piBalance * 1000000) / 1000000;
  fc = Math.floor(fc);
  document.getElementById('exchange-loading').style.display = 'block';
  try {
    await update(playerRef, { piBalance, farmCoins: fc });
    const piElem = document.getElementById('pi-balance');
    const fcElem = document.getElementById('fc-balance');
    if (piElem) piElem.textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
    if (fcElem) fcElem.textContent = fc.toLocaleString();
    document.getElementById('exchange-amount').value = '';
    playCoinSound();
    showNotification('Exchange success!');
  } catch (error) {
    console.error('Exchange failed:', error.message);
    showNotification('Exchange failed: ' + error.message);
  } finally {
    document.getElementById('exchange-loading').style.display = 'none';
  }
}

// Daily reward logic
async function checkDailyReward() {
  if (!userId) return;
  const today = new Date().toISOString().split('T')[0];
  const claimRewardBtn = document.getElementById('claim-reward-btn');
  if (claimRewardBtn) {
    if (lastClaim && new Date(lastClaim).toISOString().split('T')[0] === today) {
      claimRewardBtn.classList.add('claimed');
      claimRewardBtn.textContent = langData[currentLang]?.claimed || 'Claimed!';
      claimRewardBtn.disabled = true;
      claimedToday = true;
    } else {
      claimRewardBtn.classList.remove('claimed');
      claimRewardBtn.textContent = langData[currentLang]?.claimDailyReward || 'Claim Daily Reward';
      claimRewardBtn.disabled = false;
      claimedToday = false;
    }
  }
}

async function claimDailyReward() {
  if (!userId || isClaiming) return;
  isClaiming = true;
  if (rewardModal) rewardModal.style.display = 'block';
  farmCoins += 100;
  water += 50;
  xp += 20;
  lastClaim = new Date().toISOString();
  claimedToday = true;
  const playerRef = ref(database, `players/${userId}`);
  try {
    await update(playerRef, { farmCoins, water, xp, lastClaim, claimedToday });
    updateWallet();
    if (rewardModal) rewardModal.style.display = 'none';
    const claimBtn = document.getElementById('claim-modal-btn');
    if (claimBtn) {
      claimBtn.classList.add('claimed');
      claimBtn.textContent = langData[currentLang]?.claimed || 'Claimed!';
      claimBtn.disabled = true;
    }
    checkLevelUp();
    playCoinSound();
    showNotification(langData[currentLang]?.rewardClaimed || 'Reward Claimed!');
  } catch (error) {
    console.error('Error claiming reward:', error.message);
    showNotification('Error claiming reward: ' + error.message);
  } finally {
    isClaiming = false;
  }
}

// Show notification
function showNotification(message) {
  const notificationElement = document.getElementById('notification');
  if (notificationElement) {
    notificationElement.textContent = message;
    notificationElement.style.display = 'block';
    setTimeout(() => notificationElement.style.display = 'none', 3000);
  }
}

// Show transaction animation
function showTransactionAnimation(amount, isPositive, buttonElement) {
  const animation = document.createElement('div');
  animation.classList.add('transaction-animation', isPositive ? 'positive' : 'negative');
  animation.textContent = amount;
  document.body.appendChild(animation);
  const rect = buttonElement.getBoundingClientRect();
  animation.style.left = `${rect.left + rect.width / 2}px`;
  animation.style.top = `${rect.top - 20}px`;
  setTimeout(() => animation.remove(), 1000);
}

// Render achievements
function renderAchievements() {
  const achievementsContentElement = document.getElementById('achievements-content');
  if (!achievementsContentElement) return;
  achievementsContentElement.innerHTML = `
    <div class="achievement"><h3>${langData[currentLang]?.harvestAchievementTitle || 'Harvest Master'}</h3><p>${langData[currentLang]?.harvestAchievementDesc || 'Harvest 10 crops'}</p><p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.harvest ? langData[currentLang]?.unlocked : langData[currentLang]?.locked}</p></div>
    <div class="achievement"><h3>${langData[currentLang]?.coinAchievementTitle || 'Coin Collector'}</h3><p>${langData[currentLang]?.coinAchievementDesc || 'Collect 1000 Farm Coins'}</p><p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.coins ? langData[currentLang]?.unlocked : langData[currentLang]?.locked}</p></div>
  `;
  savePlayerData();
}

// Update UI text
function updateUIText() {
  if (!langData[currentLang]) return;
  const elements = {
    title: 'title', gameTitle: 'game-title', startText: 'start-text',
    farmTab: '.tab-btn[data-tab="farm"]', shopTab: '.tab-btn[data-tab="shop"]',
    upgradesTab: '.tab-btn[data-tab="upgrades"]', inventoryTab: '.tab-btn[data-tab="inventory"]',
    exchangeTab: '.tab-btn[data-tab="exchange"]', financeTab: '.tab-btn[data-tab="finance"]',
    leaderboardTab: '.tab-btn[data-tab="leaderboard"]', achievementsTab: '.tab-btn[data-tab="achievements"]',
    langToggle: 'lang-toggle', gameLangToggle: 'game-lang-toggle', upgradesTitle: 'upgrades-title',
    upgradesContent: 'upgrades-content', exchangeTitle: 'exchange-title', exchangeRate: 'exchange-rate',
    exchangeAmount: 'exchange-amount', exchangeResultLabel: 'exchange-result-label', exchangeBtn: 'exchange-btn',
    leaderboardTitle: 'leaderboard-title', leaderboardContent: 'leaderboard-content', settingsTitle: 'settings-title',
    musicVolumeLabel: 'music-volume-label', voiceVolumeLabel: 'voice-volume-label', exitGameBtn: 'exit-game-btn',
    dailyRewardTitle: 'daily-reward-title', claimModalBtn: 'claim-modal-btn', shopBuyTab: 'shop-buy-tab',
    shopSellTab: 'shop-sell-tab', sellSectionTitle: 'sell-section-title', financeTitle: 'finance-title'
  };
  for (let [id, key] of Object.entries(elements)) {
    const el = document.getElementById(id) || document.querySelector(key);
    if (el) el.textContent = langData[currentLang][id] || langData[currentLang][key] || el.textContent;
  }
  updateWallet();
  renderShop();
  renderInventory();
  renderSellSection();
  renderAchievements();
  checkDailyReward();
}

// Toggle language
function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'id' : 'en';
  localStorage.setItem('language', currentLang);
  updateUIText();
}

// Start game
function startGame() {
  if (!userId) {
    console.warn('Please login with Email first!');
    return;
  }
  const startScreen = document.getElementById('start-screen');
  const gameScreen = document.getElementById('game-screen');
  const exitGameBtn = document.getElementById('exit-game-btn');
  if (startScreen && gameScreen && exitGameBtn) {
    startScreen.style.display = 'none';
    gameScreen.style.display = 'flex';
    exitGameBtn.style.display = 'block';
  }
  isAudioPlaying = false;
  playBgMusic();
  playBgVoice();
  switchTab('farm');
  enterFullScreen();
}

// Initialize game
async function initializeGame() {
  try {
    await loadData();
    updateUIText();
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      const loginScreen = document.getElementById('login-screen');
      if (loadingScreen && loginScreen) {
        loadingScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
      }
    }, 1000);
  } catch (error) {
    console.error('Error initializing game:', error.message);
    showNotification('Error initializing game. Please reload.');
  }
}

// Fullscreen toggle
function enterFullScreen() {
  document.documentElement.requestFullscreen?.() || document.documentElement.mozRequestFullScreen?.() ||
    document.documentElement.webkitRequestFullscreen?.() || document.documentElement.msRequestFullscreen?.();
}
function exitFullScreen() {
  document.exitFullscreen?.() || document.mozCancelFullScreen?.() || document.webkitExitFullscreen?.() ||
    document.msExitFullscreen?.();
}

// Register and login
window.registerWithEmail = async (email, password, callback) => {
  if (!email || !password || !validateEmail(email)) {
    callback(false, 'Invalid email or password!');
    return;
  }
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(userCredential.user);
    const playerRef = ref(database, `players/${userCredential.user.uid}`);
    await set(playerRef, {
      farmCoins: 0, piBalance: 0, water: 0, level: 1, xp: 0, inventory: [], farmPlots: [], harvestCount: 0,
      achievements: { harvest: false, coins: false }, lastClaim: null, claimedToday: false, totalDeposit: 0
    });
    callback(true, 'Registration successful! Please verify your email.');
  } catch (error) {
    callback(false, 'Registration failed: ' + error.message);
  }
};

window.loginWithEmail = async (email, password, callback) => {
  if (!email || !password || !validateEmail(email)) {
    callback(false, 'Invalid email or password!');
    return;
  }
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    if (!userCredential.user.emailVerified) {
      await sendEmailVerification(userCredential.user);
      callback(false, 'Please verify your email before logging in!');
      return;
    }
    userId = userCredential.user.uid;
    localStorage.setItem('userId', userId);
    loadPlayerData();
    loadUserBalances();
    callback(true, 'Login successful!');
  } catch (error) {
    callback(false, 'Login failed: ' + error.message);
  }
};

// Deposit logic
document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    realDepositBtn: 'real-deposit-btn', realDepositMsg: 'real-deposit-msg', depositAmountInput: 'deposit-amount',
    depositPopup: 'deposit-popup', popupAmount: 'popup-amount', popupMemo: 'popup-memo', popupUserId: 'popup-userid',
    popupTransferAmount: 'popup-transfer-amount', popupTransferMemo: 'popup-transfer-memo', popupWalletAddress: 'popup-wallet-address',
    countdownTimer: 'countdown-timer', copyWalletBtn: 'copy-wallet-btn', copyMemoBtn: 'copy-memo-btn',
    confirmDepositBtn: 'confirm-deposit', cancelDepositBtn: 'cancel-deposit'
  };
  const els = {};
  for (let [key, id] of Object.entries(elements)) els[key] = document.getElementById(id);
  console.log('Deposit elements:', els);

  if (Object.values(els).some(el => !el)) {
    console.error('Some deposit elements not found. Check HTML IDs.');
    return;
  }

  let countdownInterval = null;
  const countdownDuration = 30;

  els.realDepositBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user) {
      els.realDepositMsg.textContent = 'Please login first.';
      return;
    }
    const amount = parseFloat(els.depositAmountInput.value);
    if (!amount || amount < 1) {
      els.realDepositMsg.textContent = 'Minimum deposit is 1 PI.';
      return;
    }
    const encodedEmail = encodeEmail(user.email);
    const today = new Date().toISOString().split('T')[0];
    const depositLimitRef = ref(database, `depositLimits/${encodedEmail}/${today}`);
    const snapshot = await get(depositLimitRef);
    const depositData = snapshot.val() || { count: 0, timestamp: 0 };
    if (depositData.count >= 3 && Date.now() - (depositData.timestamp || 0) < 24 * 60 * 60 * 1000) {
      const remainingTime = Math.ceil((24 * 60 * 60 * 1000 - (Date.now() - depositData.timestamp)) / (60 * 60 * 1000));
      els.realDepositMsg.textContent = `Daily limit (3x) reached. Wait ${remainingTime} hours.`;
      return;
    }
    const transactionId = `DEPOSIT-${encodedEmail}-${Date.now()}`;
    const memo = `DEPOSIT-${encodedEmail}-${Date.now().toString().slice(-5)}`;
    const walletAddress = 'GCUPGJNSX6GQDI7MTNBVES6LHDCTP3QHZHPWJG4BKBQVG4L2CW6ZULPN';

    els.popupAmount.textContent = amount;
    els.popupMemo.textContent = memo;
    els.popupUserId.textContent = user.email;
    els.popupTransferAmount.textContent = amount;
    els.popupTransferMemo.textContent = memo;
    els.popupWalletAddress.textContent = walletAddress;

    let timeLeft = countdownDuration;
    els.countdownTimer.textContent = timeLeft;
    countdownInterval = setInterval(() => {
      timeLeft--;
      els.countdownTimer.textContent = timeLeft;
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        els.depositPopup.style.display = 'none';
        els.realDepositMsg.textContent = 'Deposit request timed out.';
      }
    }, 1000);

    els.depositPopup.style.display = 'flex';
    els.copyWalletBtn.onclick = () => copyToClipboard(walletAddress, els.copyWalletBtn);
    els.copyMemoBtn.onclick = () => copyToClipboard(memo, els.copyMemoBtn);

    els.confirmDepositBtn.onclick = async () => {
      clearInterval(countdownInterval);
      await set(depositLimitRef, { count: (depositData.count || 0) + 1, timestamp: Date.now() });
      await set(ref(database, `transactions/${transactionId}`), {
        amount, type: 'deposit', status: 'pending', timestamp: Date.now(), email: user.email, memo, expiresAt: Date.now() + countdownDuration * 1000
      });
      els.realDepositMsg.textContent = `Deposit request created! Transfer ${amount} PI to ${walletAddress} with memo: ${memo}`;
      els.depositPopup.style.display = 'none';
    };

    els.cancelDepositBtn.onclick = () => {
      clearInterval(countdownInterval);
      els.depositPopup.style.display = 'none';
      els.realDepositMsg.textContent = 'Deposit cancelled.';
    };
  });

  // Admin redirect and FCM setup
  let isAdmin = false;
  auth.onAuthStateChanged((user) => {
    if (user) {
      get(ref(database, `players/${encodeEmail(user.email)}/role`)).then((snapshot) => {
        isAdmin = snapshot.val() === 'admin';
        if (isAdmin && 'serviceWorker' in navigator) {
          window.location.href = 'admin/admin.html';
          navigator.serviceWorker.register('/firebase-messaging-sw.js')
            .then(registration => messaging.useServiceWorker(registration).then(() => messaging.getToken()))
            .then(token => set(ref(database, `adminTokens/${encodeEmail(user.email)}`), token))
            .catch(err => console.log('FCM Error:', err));
        }
      }).catch(err => console.log('Error fetching role:', err));
    }
  });
});

// Simulasi deteksi transaksi (opsional, hapus kalau pake Pi API)
setInterval(() => {
  get(ref(database, 'deposits')).then(snapshot => {
    const deposits = snapshot.val() || {};
    for (let id in deposits) {
      if (deposits[id].status === 'pending') {
        setTimeout(() => update(ref(database, `deposits/${id}`), { status: 'detected' }), 30000);
      }
    }
  });
}, 10000);
