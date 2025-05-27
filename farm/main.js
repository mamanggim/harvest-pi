import { database, ref, onValue, set, update, get, push } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { langData } from '/data/lang.json';
import { vegetables as vegData } from '/data/vegetables.json';

// Global variables
let isDataLoaded = false;
let piInitialized = false;
let farmCoins = 0;
let piBalance = 0;
let water = 0;
let level = 1;
let xp = 0;
let inventory = [];
let vegetables = vegData.vegetables || [];
let currentLang = localStorage.getItem('language') || 'en';
let farmPlots = [];
let harvestCount = 0;
let achievements = { harvest: false, coins: false };
let userId = null;
let lastClaim = null;
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;
const plotCount = 4; // 2x2 grid
const piToFarmRate = 1000000; // 1 PI = 1,000,000 Farm Coins

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
function playBgMusic() {
  if (bgMusic && !isAudioPlaying) {
    bgMusic.play().then(() => {
      isAudioPlaying = true;
      console.log('Background music started');
    }).catch(e => {
      console.log('BG Music failed:', e.message);
      setTimeout(() => bgMusic.play().catch(err => console.log('Retry BG Music failed:', err)), 100);
    });
  }
}

function playBgVoice() {
  if (bgVoice && !isAudioPlaying) {
    bgVoice.play().then(() => console.log('Background voice started')).catch(e => {
      console.log('BG Voice failed:', e.message);
      setTimeout(() => bgVoice.play().catch(err => console.log('Retry BG Voice failed:', err)), 100);
    });
  }
}

function playHarvestingSound() { harvestingSound?.play().catch(e => console.log('Harvest sound failed:', e.message)); }
function playWateringSound() { wateringSound?.play().catch(e => console.log('Watering sound failed:', e.message)); }
function playPlantingSound() { plantingSound?.play().catch(e => console.log('Planting sound failed:', e.message)); }
function playMenuSound() { menuSound?.play().catch(e => console.log('Menu sound failed:', e.message)); }
function playBuyingSound() { buyingSound?.play().catch(e => console.log('Buying sound failed:', e.message)); }
function playCoinSound() { coinSound?.play().catch(e => console.log('Coin sound failed:', e.message)); }

// Volume control
const musicVolumeSlider = document.getElementById('music-volume');
const voiceVolumeSlider = document.getElementById('voice-volume');

if (musicVolumeSlider) {
  musicVolumeSlider.value = localStorage.getItem('musicVolume') ?? 50;
  musicVolumeSlider.addEventListener('input', () => {
    localStorage.setItem('musicVolume', musicVolumeSlider.value);
    updateVolumes();
  });
}

if (voiceVolumeSlider) {
  voiceVolumeSlider.value = localStorage.getItem('voiceVolume') ?? 50;
  voiceVolumeSlider.addEventListener('input', () => {
    localStorage.setItem('voiceVolume', voiceVolumeSlider.value);
    updateVolumes();
  });
}

function updateVolumes() {
  const musicVol = Math.min(Math.max((parseFloat(localStorage.getItem('musicVolume') ?? 50) / 100), 0), 1);
  const voiceVol = Math.min(Math.max((parseFloat(localStorage.getItem('voiceVolume') ?? 50) / 100), 0), 1);
  if (bgMusic) bgMusic.volume = musicVol;
  if (bgVoice) bgVoice.volume = voiceVol;
  [harvestingSound, wateringSound, plantingSound, menuSound, buyingSound, coinSound].forEach(sound => {
    if (sound) sound.volume = voiceVol;
  });
}
updateVolumes();

function addSafeClickListener(element, callback) {
  let isLocked = false;
  ['click', 'touchstart'].forEach(event => {
    element.addEventListener(event, (e) => {
      if (isLocked) return;
      isLocked = true;
      callback(e);
      setTimeout(() => isLocked = false, 300);
    });
  });
}

function showNotification(message) {
  const notificationElement = document.getElementById('notification');
  if (notificationElement) {
    notificationElement.textContent = message;
    notificationElement.style.display = 'block';
    setTimeout(() => notificationElement.style.display = 'none', 3000);
  }
}

function showTransactionAnimation(amountText, isPositive, sourceElement) {
  const animation = document.createElement('div');
  animation.textContent = amountText;
  animation.classList.add('amount-text', isPositive ? 'positive' : 'negative');
  document.body.appendChild(animation);
  const rect = sourceElement?.getBoundingClientRect() || { left: window.innerWidth / 2, top: window.innerHeight / 2 };
  animation.style.left = `${rect.left + rect.width / 2}px`;
  animation.style.top = `${rect.top}px`;
  setTimeout(() => animation.remove(), 800);
}

function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    if (button) {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => button.textContent = originalText, 2000);
    }
    showNotification('Copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showNotification('Failed to copy.');
  });
}

async function initializePiSDK() {
  if (!window.Pi) {
    console.error('Pi SDK not loaded');
    showNotification('Pi Network SDK not available.');
    return false;
  }
  try {
    await Pi.init({
      version: "2.0",
      appId: "YOUR_APP_ID" // Ganti dengan App ID dari Pi Developer Portal
    });
    piInitialized = true;
    console.log('Pi SDK initialized');
    return true;
  } catch (error) {
    console.error('Pi init failed:', error.message);
    showNotification('Failed to initialize Pi SDK: ' + error.message);
    return false;
  }
}

async function authenticateWithPi() {
  if (!piInitialized && !(await initializePiSDK())) return;

  try {
    const authResult = await Pi.authenticate(['username'], (payment) => console.log('Incomplete payment:', payment));
    const response = await fetch('http://localhost:3000/auth/pi?accessToken=' + encodeURIComponent(authResult.accessToken));
    const serverData = await response.json();
    if (!serverData.user || !serverData.user.uid) throw new Error('Server validation failed');

    userId = serverData.user.uid;
    localStorage.setItem('userId', userId);

    const playerRef = ref(database, `players/${userId}`);
    const snapshot = await get(playerRef);
    let playerData = snapshot.val();

    if (!playerData) {
      playerData = {
        farmCoins: 0,
        piBalance: 0,
        water: 0,
        level: 1,
        xp: 0,
        inventory: [],
        farmPlots: [],
        harvestCount: 0,
        achievements: { harvest: false, coins: false },
        lastClaim: null,
        claimedToday: false,
        totalDeposit: 0,
        username: serverData.user.username
      };
      await set(playerRef, playerData);
    }

    loadPlayerData();
    showNotification(`Logged in as ${serverData.user.username}`);
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
  } catch (error) {
    console.error('Pi Auth failed:', error.message);
    showNotification('Pi login failed: ' + error.message);
  }
}

function loadPlayerData() {
  if (!userId) return console.warn('No userId, please login!');
  const playerRef = ref(database, `players/${userId}`);
  onValue(playerRef, (snapshot) => {
    if (isDataLoaded) return;
    const data = snapshot.val();
    if (data) {
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
    } else {
      set(playerRef, {
        farmCoins: 0,
        piBalance: 0,
        water: 0,
        level: 1,
        xp: 0,
        inventory: [],
        farmPlots: [],
        harvestCount: 0,
        achievements: { harvest: false, coins: false },
        lastClaim: null,
        claimedToday: false,
        totalDeposit: 0
      }).catch(err => showNotification('Error initializing player data.'));
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

async function savePlayerData() {
  if (!userId || !isDataLoaded) return;
  const playerRef = ref(database, `players/${userId}`);
  try {
    await update(playerRef, {
      farmCoins,
      piBalance,
      water,
      level,
      xp,
      inventory,
      farmPlots,
      harvestCount,
      achievements,
      lastClaim,
      claimedToday,
      totalDeposit: playerData?.totalDeposit || 0
    });
    console.log('Player data saved');
  } catch (error) {
    console.error('Error saving player data:', error.message);
    showNotification('Error saving data');
  }
}

function updateWallet() {
  const elements = {
    'farm-coins': `${farmCoins} ${langData[currentLang]?.coinLabel || 'Coins'}`,
    'pi-coins': `${piBalance.toFixed(6)} PI`,
    'water': `${water} ${langData[currentLang]?.waterLabel || 'Water'}`,
    'level': `Level: ${level} | XP: ${xp}`,
    'farm-coin-balance': farmCoins,
    'pi-coin-balance': piBalance.toFixed(6)
  };
  Object.entries(elements).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
    else console.warn(`Element #${id} not found`);
  });
  const xpFill = document.getElementById('xp-fill');
  if (xpFill) xpFill.style.width = `${(xp / (level * 100)) * 100}%`;
  savePlayerData();
}

function initializePlots() {
  const farmArea = document.getElementById('farm-area');
  if (!farmArea) return showNotification('Farm area not found');
  farmArea.innerHTML = '';
  if (!farmPlots.length) {
    farmPlots = Array(plotCount).fill().map(() => ({
      planted: false,
      vegetable: null,
      progress: 0,
      watered: false,
      currentFrame: 1,
      countdown: 0,
      totalCountdown: 0
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
    farmArea.appendChild(plotElement);
    if (plot.planted && plot.vegetable) {
      updatePlotUI(plot, plotElement, i);
    }
  });
}

function updatePlotUI(plot, plotElement, index) {
  const plotContent = plotElement.querySelector('.plot-content');
  const plotStatus = plotElement.querySelector('.plot-status');
  const countdownFill = plotElement.querySelector('.countdown-fill');
  if (plot.currentFrame >= plot.vegetable.frames) {
    plotElement.classList.add('ready');
    plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
    countdownFill.style.width = '100%';
  } else if (plot.watered) {
    plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
    const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
    countdownFill.style.width = `${progress}%`;
  } else {
    plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
    countdownFill.style.width = '0%';
  }
  const plantImg = document.createElement('img');
  plantImg.classList.add('plant-img');
  plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
  plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
  plotContent.innerHTML = '';
  plotContent.appendChild(plantImg);
  plantImg.classList.add('loaded');
  if (plot.watered && plot.currentFrame < plot.vegetable.frames) {
    const interval = setInterval(() => {
      if (!plot.planted || plot.currentFrame >= plot.vegetable.frames) {
        clearInterval(interval);
        updatePlotUI(plot, plotElement, index);
        return;
      }
      plot.countdown--;
      if (plot.countdown <= 0) {
        plot.currentFrame++;
        plot.watered = false;
        plot.countdown = plot.vegetable.growthTime;
        plot.totalCountdown = plot.vegetable.growthTime;
        updatePlotUI(plot, plotElement, index);
      } else {
        const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
        countdownFill.style.width = `${progress}%`;
        plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
      }
      savePlayerData();
    }, 1000);
  }
}

function handlePlotClick(index) {
  const plot = farmPlots[index];
  const plotElement = document.querySelectorAll('.plot')[index];
  const plotContent = plotElement.querySelector('.plot-content');
  const plotStatus = plotElement.querySelector('.plot-status');
  const countdownFill = plotElement.querySelector('.countdown-fill');

  if (!plot.planted) {
    const seedIndex = inventory.findIndex(item => item?.type === 'seed' && item.quantity > 0);
    if (seedIndex === -1) return showNotification(langData[currentLang]?.noSeeds || 'No Seeds!');
    const seed = inventory[seedIndex];
    plot.planted = true;
    plot.vegetable = seed.vegetable;
    plot.progress = 0;
    plot.watered = false;
    plot.currentFrame = 1;
    plot.countdown = seed.vegetable.growthTime;
    plot.totalCountdown = seed.vegetable.growthTime;
    inventory[seedIndex].quantity--;
    if (inventory[seedIndex].quantity <= 0) inventory.splice(seedIndex, 1);
    updatePlotUI(plot, plotElement, index);
    showNotification(langData[currentLang]?.planted || 'Planted!');
    playPlantingSound();
    renderInventory();
  } else if (!plot.watered && plot.currentFrame < plot.vegetable.frames) {
    if (water < plot.vegetable.waterNeeded) return showNotification(langData[currentLang]?.notEnoughWater || 'Not Enough Water!');
    water -= plot.vegetable.waterNeeded;
    plot.watered = true;
    updatePlotUI(plot, plotElement, index);
    showNotification(langData[currentLang]?.watered || 'Watered!');
    playWateringSound();
  } else if (plot.currentFrame >= plot.vegetable.frames) {
    const yieldAmount = plot.vegetable.yield;
    addToInventory('harvest', plot.vegetable, yieldAmount);
    plot.planted = false;
    plot.vegetable = null;
    plot.progress = 0;
    plot.watered = false;
    plot.currentFrame = 1;
    plot.countdown = 0;
    plot.totalCountdown = 0;
    plotContent.innerHTML = '';
    plotStatus.innerHTML = '';
    countdownFill.style.width = '0%';
    plotElement.classList.remove('ready');
    harvestCount++;
    checkHarvestAchievement();
    showNotification(langData[currentLang]?.harvested || 'Harvested!');
    playHarvestingSound();
    renderInventory();
    renderSellSection();
  }
  savePlayerData();
}

function renderShop() {
  const shopContent = document.getElementById('shop-content');
  if (!shopContent) return console.error('shop-content not found');
  shopContent.innerHTML = '';
  vegetables.forEach(veg => {
    const vegItem = document.createElement('div');
    vegItem.classList.add('shop-item');
    vegItem.innerHTML = `
      <img src="${veg.shopImage}" alt="${veg.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${veg.name[currentLang]}</h3>
      <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: ${veg.farmPrice} ${langData[currentLang]?.coinLabel || 'Coins'}</p>
      <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: ${veg.piPrice} PI</p>
      <button class="buy-btn" data-id="${veg.id}">${langData[currentLang]?.buyLabel || 'Buy'} (Farm)</button>
      <button class="buy-pi-btn" data-id="${veg.id}">${langData[currentLang]?.buyLabel || 'Buy'} (PI)</button>
    `;
    shopContent.appendChild(vegItem);
  });
  const waterItem = document.createElement('div');
  waterItem.classList.add('shop-item');
  waterItem.innerHTML = `
    <img src="assets/img/ui/water_icon.png" alt="${langData[currentLang]?.waterLabel || 'Water'}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
    <h3>${langData[currentLang]?.waterLabel || 'Water'}</h3>
    <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: 100 ${langData[currentLang]?.coinLabel || 'Coins'}</p>
    <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: 0.0001 PI</p>
    <button class="buy-btn" data-id="water">${langData[currentLang]?.buyLabel || 'Buy'} (Farm)</button>
    <button class="buy-pi-btn" data-id="water">${langData[currentLang]?.buyLabel || 'Buy'} (PI)</button>
  `;
  shopContent.appendChild(waterItem);
  document.querySelectorAll('.buy-btn').forEach(btn => {
    addSafeClickListener(btn, () => buyVegetable(btn.getAttribute('data-id'), 'farm'));
  });
  document.querySelectorAll('.buy-pi-btn').forEach(btn => {
    addSafeClickListener(btn, () => buyVegetable(btn.getAttribute('data-id'), 'pi'));
  });
}

async function buyVegetable(id, currency) {
  let isSaving = false;
  if (isSaving) return;
  isSaving = true;
  try {
    if (id === 'water') {
      if (currency === 'farm' && farmCoins >= 100) {
        farmCoins -= 100;
        water += 10;
        showTransactionAnimation('-100', false, document.querySelector(`.buy-btn[data-id="water"]`));
      } else if (currency === 'pi' && piBalance >= 0.0001) {
        piBalance -= 0.0001;
        water += 10;
        showTransactionAnimation('-0.0001 PI', false, document.querySelector(`.buy-pi-btn[data-id="water"]`));
      } else {
        showNotification(currency === 'farm' ? langData[currentLang]?.notEnoughCoins || 'Not Enough Coins!' : langData[currentLang]?.notEnoughPi || 'Not Enough PI!');
        isSaving = false;
        return;
      }
      updateWallet();
      playBuyingSound();
      await savePlayerData();
      isSaving = false;
      return;
    }
    const veg = vegetables.find(v => v.id === id);
    if (!veg) return;
    let canBuy = false;
    if (currency === 'farm' && farmCoins >= veg.farmPrice) {
      farmCoins -= veg.farmPrice;
      canBuy = true;
      showTransactionAnimation(`-${veg.farmPrice}`, false, document.querySelector(`.buy-btn[data-id="${id}"]`));
    } else if (currency === 'pi' && piBalance >= veg.piPrice) {
      piBalance -= veg.piPrice;
      canBuy = true;
      showTransactionAnimation(`-${veg.piPrice} PI`, false, document.querySelector(`.buy-pi-btn[data-id="${id}"]`));
    } else {
      showNotification(currency === 'farm' ? langData[currentLang]?.notEnoughCoins || 'Not Enough Coins!' : langData[currentLang]?.notEnoughPi || 'Not Enough PI!');
      isSaving = false;
      return;
    }
    if (canBuy) {
      addToInventory('seed', veg, 1);
      updateWallet();
      renderInventory();
      playBuyingSound();
      await savePlayerData();
    }
  } catch (error) {
    console.error('Buy error:', error.message);
    showNotification('Purchase failed');
  }
  isSaving = false;
}

function renderInventory() {
  const inventoryContent = document.getElementById('inventory-content');
  if (!inventoryContent) return console.error('inventory-content not found');
  inventoryContent.innerHTML = '';
  let hasItems = false;
  inventory.forEach(item => {
    if (!item?.vegetable) return;
    const invItem = document.createElement('div');
    invItem.classList.add('inventory-item');
    const title = item.type === 'seed' ? `${item.vegetable.name[currentLang]} Seed` : item.vegetable.name[currentLang];
    invItem.innerHTML = `
      <img src="${item.vegetable.shopImage}" alt="${title}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${title}</h3>
      <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
    `;
    inventoryContent.appendChild(invItem);
    hasItems = true;
  });
  if (!hasItems) {
    inventoryContent.innerHTML = `<p>${langData[currentLang]?.noInventory || 'No items in inventory.'}</p>`;
  }
  const sellButton = document.createElement('button');
  sellButton.textContent = langData[currentLang]?.sellToShop || 'Sell to Shop';
  sellButton.classList.add('sell-to-shop-btn');
  addSafeClickListener(sellButton, openSellTab);
  inventoryContent.appendChild(sellButton);
}

function addToInventory(type, veg, qty = 1) {
  if (!veg?.id) return;
  const existingIndex = inventory.findIndex(item => item?.type === type && item.vegetable.id === veg.id);
  if (existingIndex !== -1) {
    inventory[existingIndex].quantity += qty;
  } else {
    inventory.push({ type, vegetable: veg, quantity: qty });
  }
  savePlayerData();
}

function renderSellSection() {
  const sellContent = document.getElementById('sell-content');
  if (!sellContent) return console.error('sell-content not found');
  sellContent.innerHTML = '';
  let hasItems = false;
  const groupedHarvest = inventory.reduce((acc, item, index) => {
    if (item?.type === 'harvest') {
      const vegId = item.vegetable.id;
      acc[vegId] = acc[vegId] || { ...item, index, quantity: 0 };
      acc[vegId].quantity += item.quantity;
    }
    return acc;
  }, {});
  Object.values(groupedHarvest).forEach(item => {
    const sellDiv = document.createElement('div');
    sellDiv.classList.add('sell-item');
    sellDiv.innerHTML = `
      <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img">
      <h3>${item.vegetable.name[currentLang]}</h3>
      <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
      <p>${langData[currentLang]?.sellPriceLabel || 'Sell Price'}: ${item.vegetable.sellPrice} ${langData[currentLang]?.coinLabel || 'Coins'}</p>
      <button class="sell-btn" data-index="${item.index}">${langData[currentLang]?.sellLabel || 'Sell'}</button>
    `;
    sellContent.appendChild(sellDiv);
    hasItems = true;
    addSafeClickListener(sellDiv.querySelector('.sell-btn'), () => sellItem(item.index));
  });
  if (!hasItems) {
    sellContent.innerHTML = `<p>${langData[currentLang]?.noSellableItems || 'No items to sell.'}</p>`;
  }
}

function sellItem(index) {
  const item = inventory[index];
  if (!item || item.type !== 'harvest') return;
  const totalGain = item.vegetable.sellPrice * item.quantity;
  farmCoins += totalGain;
  xp += 10;
  showTransactionAnimation(`+${totalGain}`, true, document.querySelector(`.sell-btn[data-index="${index}"]`));
  inventory.splice(index, 1);
  savePlayerData();
  updateWallet();
  renderInventory();
  renderSellSection();
  playCoinSound();
  checkLevelUp();
  checkCoinAchievement();
}

function updateReferralLink() {
  const referralLinkInput = document.getElementById('referral-link');
  if (referralLinkInput && userId) {
    const referralLink = `https://your-game-url.com/?ref=${userId}`;
    referralLinkInput.value = referralLink;
    const copyReferralBtn = document.getElementById('copy-referral-btn');
    if (copyReferralBtn) {
      addSafeClickListener(copyReferralBtn, () => copyToClipboard(referralLink, copyReferralBtn));
    }
  }
}

function renderReferrals() {
  const referralList = document.getElementById('referral-list');
  if (!referralList) return;
  const referralRef = ref(database, `referrals/${userId}`);
  onValue(referralRef, (snapshot) => {
    referralList.innerHTML = '';
    const referrals = snapshot.val() || {};
    Object.entries(referrals).forEach(([referredId, data]) => {
      const li = document.createElement('li');
      li.textContent = `User: ${data.username || referredId}, Joined: ${new Date(data.timestamp).toLocaleDateString()}`;
      referralList.appendChild(li);
    });
    const referralCount = document.getElementById('referral-count');
    if (referralCount) referralCount.textContent = Object.keys(referrals).length;
  });
}

const depositBtn = document.getElementById('confirm-deposit');
const depositAmountInput = document.getElementById('deposit-amount');
const depositPopup = document.getElementById('deposit-popup');
const popupAmount = document.getElementById('popup-amount');
const popupMemo = document.getElementById('popup-memo');
const popupWalletAddress = document.getElementById('popup-wallet-address');
const countdownTimer = document.getElementById('countdown-timer');
const copyWalletBtn = document.getElementById('copy-wallet-btn');
const copyMemoBtn = document.getElementById('copy-memo-btn');
const cancelDepositBtn = document.getElementById('cancel-deposit');

if (depositBtn) {
  addSafeClickListener(depositBtn, async () => {
    if (!userId) return showNotification('Please login first.');
    const amount = parseFloat(depositAmountInput.value);
    if (!amount || amount < 1) return showNotification('Minimum deposit is 1 PI.');
    const memo = `Deposit_${userId}_${Date.now()}`;
    const walletAddress = 'YOUR_WALLET_ADDRESS'; // Ganti dengan wallet address asli
    const timeLeft = 100;
    popupAmount.textContent = amount;
    popupMemo.textContent = memo;
    popupWalletAddress.textContent = walletAddress;
    countdownTimer.textContent = timeLeft;
    depositPopup.style.display = 'block';
    const countdownInterval = setInterval(() => {
      countdownTimer.textContent = --timeLeft;
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        depositPopup.style.display = 'none';
        showNotification('Deposit time expired.');
      }
    }, 1000);
    addSafeClickListener(cancelDepositBtn, () => {
      clearInterval(countdownInterval);
      depositPopup.style.display = 'none';
      showNotification('Deposit cancelled.');
      playMenuSound();
    });
    addSafeClickListener(copyWalletBtn, () => copyToClipboard(walletAddress, copyWalletBtn));
    addSafeClickListener(copyMemoBtn, () => copyToClipboard(memo, copyMemoBtn));
    addSafeClickListener(document.getElementById('confirm-deposit'), async () => {
      clearInterval(countdownInterval);
      depositPopup.style.display = 'none';
      try {
        const playerRef = ref(database, `players/${userId}`);
        const snapshot = await get(playerRef);
        const data = snapshot.val();
        piBalance += amount;
        await update(playerRef, { piBalance, totalDeposit: (data.totalDeposit || 0) + amount });
        await push(ref(database, `depositHistory/${userId}`), {
          amount,
          memo,
          timestamp: Date.now(),
          status: 'completed'
        });
        updateWallet();
        showNotification(`Deposited ${amount} PI!`);
        playCoinSound();
      } catch (error) {
        console.error('Deposit error:', error.message);
        showNotification('Deposit failed.');
      }
    });
  });
}

const withdrawBtn = document.getElementById('withdraw-btn');
const withdrawAmountInput = document.getElementById('withdraw-amount');
const withdrawWalletInput = document.getElementById('withdraw-wallet-input');
const withdrawPopup = document.getElementById('withdraw-popup');
const withdrawPopupAmount = document.getElementById('withdraw-popup-amount');
const withdrawPopupWallet = document.getElementById('withdraw-popup-wallet');
const withdrawCountdownTimer = document.getElementById('withdraw-countdown-timer');
const confirmWithdrawBtn = document.getElementById('confirm-withdraw');
const cancelWithdrawBtn = document.getElementById('cancel-withdraw');

if (withdrawBtn) {
  addSafeClickListener(withdrawBtn, async () => {
    if (!userId) return showNotification('Please login first.');
    const amount = parseFloat(withdrawAmountInput.value);
    const walletAddress = withdrawWalletInput.value.trim();
    if (!amount || amount <= 0) return showNotification('Enter a valid amount.');
    if (!walletAddress) return showNotification('Enter a wallet address.');
    const playerRef = ref(database, `players/${userId}`);
    const snapshot = await get(playerRef);
    const data = snapshot.val();
    if (level < 10 || farmCoins < 10000000 || (data.totalDeposit || 0) < 10) {
      return showNotification('Withdraw requirements not met.');
    }
    if (piBalance < amount) return showNotification('Insufficient PI balance.');
    let timeLeft = 100;
    withdrawPopupAmount.textContent = amount;
    withdrawPopupWallet.textContent = walletAddress;
    withdrawCountdownTimer.textContent = timeLeft;
    withdrawPopup.style.display = 'block';
    const countdownInterval = setInterval(() => {
      withdrawCountdownTimer.textContent = --timeLeft;
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        withdrawPopup.style.display = 'none';
        showNotification('Withdraw time expired.');
      }
    }, 1000);
    addSafeClickListener(cancelWithdrawBtn, () => {
      clearInterval(countdownInterval);
      withdrawPopup.style.display = 'none';
      showNotification('Withdraw cancelled.');
      playMenuSound();
    });
    addSafeClickListener(confirmWithdrawBtn, async () => {
      clearInterval(countdownInterval);
      withdrawPopup.style.display = 'none';
      try {
        piBalance -= amount;
        await update(playerRef, { piBalance });
        await push(ref(database, `depositHistory/${userId}`), {
          amount: -amount,
          walletAddress,
          timestamp: Date.now(),
          status: 'completed'
        });
        updateWallet();
        showNotification(`Withdrew ${amount} PI!`);
        playCoinSound();
      } catch (error) {
        console.error('Withdraw error:', error.message);
        showNotification('Withdraw failed.');
      }
    });
  });
}

function updateUIText() {
  const uiElements = {
    'title': 'title',
    'game-title': 'title',
    'start-text': 'startGame',
    'farm-tab': 'farmTab',
    'shop-tab': 'shopTab',
    'inventory-tab': 'inventoryTab',
    'exchange-tab': 'exchangeTab',
    'finance-tab': 'financeTab',
    'leaderboard-tab': 'leaderboardTab',
    'achievements-tab': 'achievementsTab',
    'lang-toggle': 'switchLang',
    'game-lang-toggle': 'switchLang',
    'settings-title': 'settingsTitle',
    'music-volume-label': 'musicVolumeLabel',
    'voice-volume-label': 'voiceVolumeLabel',
    'exit-game-btn': 'exitGame',
    'daily-reward-title': 'dailyRewardTitle',
    'claim-modal-btn': 'claimButton',
    'shop-buy-tab': 'buyTab',
    'shop-sell-tab': 'sellTab',
    'sell-section-title': 'sellSectionTitle'
  };
  Object.entries(uiElements).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = langData[currentLang]?.[key] || el.textContent;
  });
  updateWallet();
  renderShop();
  renderInventory();
  renderSellSection();
  renderAchievements();
  checkDailyReward();
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'id' : 'en';
  localStorage.setItem('language', currentLang);
  updateUIText();
}

function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  const tabContent = document.getElementById(tab);
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (tabContent && tabBtn) {
    tabContent.classList.add('active');
    tabBtn.classList.add('active');
  }
  if (tab === 'shop') renderShop();
  else if (tab === 'inventory') renderInventory();
  else if (tab === 'achievements') renderAchievements();
  playMenuSound();
}

function startGame() {
  if (!userId) return showNotification('Please login with Pi Network!');
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'flex';
  document.getElementById('exit-game-btn').style.display = 'block';
  isAudioPlaying = false;
  playBgMusic();
  playBgVoice();
  switchTab('farm');
  enterFullScreen();
}

async function initializeGame() {
  try {
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Initialization timeout')), 10000));
    await Promise.race([Promise.resolve(), timeout]);
    updateUIText();
    setTimeout(() => {
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
    }, 1000);
    document.getElementById('login-pi-btn')?.addSafeClickListener(authenticateWithPi);
  } catch (error) {
    console.error('Init failed:', error.message);
    showNotification('Error initializing game.');
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeGame();
  document.getElementById('start-text')?.addSafeClickListener(startGame);
  document.getElementById('lang-toggle')?.addSafeClickListener(toggleLanguage);
  document.getElementById('game-lang-toggle')?.addSafeClickListener(toggleLanguage);
  document.getElementById('settings-btn')?.addSafeClickListener(() => {
    document.getElementById('settings-modal').style.display = 'block';
    playMenuSound();
  });
  document.getElementById('close-settings')?.addSafeClickListener(() => {
    document.getElementById('settings-modal').style.display = 'none';
    playMenuSound();
  });
  document.getElementById('fullscreen-toggle')?.addSafeClickListener(() => {
    document.fullscreenElement ? exitFullScreen() : enterFullScreen();
    playMenuSound();
  });
  document.getElementById('exit-game-btn')?.addSafeClickListener(() => {
    bgMusic?.pause();
    bgVoice?.pause();
    window.location.reload();
  });
});
