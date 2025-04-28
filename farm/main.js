// Ambil database dan auth dari window.firebaseConfig (dari firebase-config.js)
const { database, auth } = window.firebaseConfig;
import { ref, onValue, set } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Global variables
let farmCoins = 0;
let pi = 0;
let water = 0;
let level = 1;
let xp = 0;
let inventory = [];
let vegetables = [];
let langData = {};
let currentLang = 'en';
let farmPlots = [];
let harvestCount = 0;
let userId = null; // ID dari anonymous login
const plotCount = 4;
const piToFarmRate = 1000000;

// Audio elements
const bgMusic = document.getElementById('bg-music');
const bgVoice = document.getElementById('bg-voice');
const harvestSound = document.getElementById('harvest-sound');
const wateringSound = document.getElementById('watering-sound');
const menuSound = document.getElementById('menu-sound');
const buyingSound = document.getElementById('buying-sound');
const coinSound = document.getElementById('coin-sound');

function playBgMusic() {
  if (bgMusic) {
    const playPromise = bgMusic.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log('BG Music failed:', e.message));
    }
  }
}

function playBgVoice() {
  if (bgVoice) {
    const playPromise = bgVoice.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log('BG Voice failed:', e.message));
    }
  }
}

function playHarvestSound() {
  if (harvestSound) {
    const playPromise = harvestSound.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log('Harvest sound failed:', e.message));
    }
  }
}

function playWateringSound() {
  if (wateringSound) {
    const playPromise = wateringSound.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log('Watering sound failed:', e.message));
    }
  }
}

function playMenuSound() {
  if (menuSound) {
    const playPromise = menuSound.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log('Menu sound failed:', e.message));
    }
  }
}

function playBuyingSound() {
  if (buyingSound) {
    const playPromise = buyingSound.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log('Buying sound failed:', e.message));
    }
  }
}

function playCoinSound() {
  if (coinSound) {
    const playPromise = coinSound.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log('Coin sound failed:', e.message));
    }
  }
}

function updateVolumes() {
  const musicVolume = localStorage.getItem('musicVolume') || 50;
  const voiceVolume = localStorage.getItem('voiceVolume') || 50;
  if (bgMusic) bgMusic.volume = musicVolume / 100;
  if (bgVoice) bgVoice.volume = voiceVolume / 100;
  if (harvestSound) harvestSound.volume = voiceVolume / 100;
  if (wateringSound) wateringSound.volume = voiceVolume / 100;
  if (menuSound) menuSound.volume = voiceVolume / 100;
  if (buyingSound) buyingSound.volume = voiceVolume / 100;
  if (coinSound) coinSound.volume = voiceVolume / 100;
}

// Load data from JSON files
async function loadData() {
  console.log('Starting to load data...');
  try {
    console.log('Fetching lang.json from /harvest-pi/data/lang.json...');
    const langRes = await fetch('/harvest-pi/data/lang.json');
    console.log('lang.json fetch response status:', langRes.status);
    if (!langRes.ok) throw new Error(`Failed to fetch lang.json: ${langRes.status}`);
    langData = await langRes.json();
    console.log('lang.json loaded successfully:', langData);
  } catch (e) {
    console.log('Error loading lang.json:', e.message);
    alert('Error loading lang.json: ' + e.message);
    langData = { en: { /* fallback data sama seperti sebelumnya */ }, id: { /* fallback data sama seperti sebelumnya */ } };
  }

  try {
    console.log('Fetching vegetables.json from /harvest-pi/data/vegetables.json...');
    const vegRes = await fetch('/harvest-pi/data/vegetables.json');
    console.log('vegetables.json fetch response status:', vegRes.status);
    if (!vegRes.ok) throw new Error(`Failed to fetch vegetables.json: ${vegRes.status}`);
    const vegData = await vegRes.json();
    vegetables = vegData.vegetables || [];
    console.log('vegetables.json loaded successfully:', vegetables);
  } catch (e) {
    console.log('Error loading vegetables.json:', e.message);
    alert('Error loading vegetables.json: ' + e.message);
    vegetables = [];
  }
  console.log('Finished loading data.');
}

// Load player data with anonymous login
async function loadPlayerData() {
  console.log('Starting to load player data with anonymous login...');
  try {
    // Login ke Firebase pake anonymous login
    const userCredential = await signInAnonymously(auth);
    userId = userCredential.user.uid;
    console.log('Signed in to Firebase anonymously, userId:', userId);

    // Simpan data player di Firebase pake userId
    const playerRef = ref(database, `players/${userId}`);
    onValue(playerRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        farmCoins = data.farmCoins || 0;
        pi = data.pi || 0;
        water = data.water || 0;
        level = data.level || 1;
        xp = data.xp || 0;
        inventory = data.inventory || [];
        harvestCount = data.harvestCount || 0;
        localStorage.setItem('musicVolume', data.musicVolume || 50);
        localStorage.setItem('voiceVolume', data.voiceVolume || 50);
        console.log('Player data loaded from Firebase:', data);
      } else {
        const initialData = {
          farmCoins: 0,
          pi: 0,
          water: 0,
          level: 1,
          xp: 0,
          inventory: [],
          harvestCount: 0,
          lastClaim: null,
          musicVolume: 50,
          voiceVolume: 50
        };
        set(playerRef, initialData);
        farmCoins = 0;
        pi = 0;
        water = 0;
        level = 1;
        xp = 0;
        inventory = [];
        harvestCount = 0;
        console.log('Initialized new player data:', initialData);
      }
      updateWallet();
      updateVolumes();
      initializePlots();
      renderShop();
      renderInventory();
      renderSellSection();
      renderAchievements();
      checkDailyReward();
    }, { onlyOnce: false });
  } catch (error) {
    console.log('Error loading player data with anonymous login:', error.message);
    alert('Error loading player data: ' + error.message);
    showNotification('Failed to connect to Firebase');
  }
  console.log('Finished loading player data.');
}

// Save player data to Firebase
function savePlayerData() {
  if (!userId) return;
  const playerRef = ref(database, `players/${userId}`);
  set(playerRef, {
    farmCoins,
    pi,
    water,
    level,
    xp,
    inventory,
    harvestCount,
    lastClaim: localStorage.getItem('lastClaim'),
    musicVolume: parseInt(localStorage.getItem('musicVolume')) || 50,
    voiceVolume: parseInt(localStorage.getItem('voiceVolume')) || 50
  }).catch(error => {
    console.log('Error saving player data to Firebase:', error.message);
  });
}

// Update wallet UI
function updateWallet() {
  document.getElementById('farm-coins').textContent = `${farmCoins} ${langData[currentLang].coinLabel || 'Coins'}`;
  document.getElementById('pi-coins').textContent = `${pi.toFixed(2)} PI`;
  document.getElementById('water').textContent = `${water} ${langData[currentLang].waterLabel || 'Water'}`;
  document.getElementById('level').textContent = `Level: ${level} | XP: ${xp}`;
  const xpPercentage = (xp / (level * 100)) * 100;
  document.getElementById('xp-fill').style.width = `${xpPercentage}%`;
  savePlayerData();
}

// Initialize farm plots
function initializePlots() {
  const farmArea = document.getElementById('farm-area');
  if (!farmArea) {
    alert('farm-area element not found');
    return;
  }

  farmPlots = [];
  farmArea.innerHTML = '';
  for (let i = 0; i < plotCount; i++) {
    const plot = document.createElement('div');
    plot.classList.add('plot');
    plot.innerHTML = `
      <div class="plot-content"></div>
      <div class="countdown-bar">
        <div class="countdown-fill"></div>
      </div>
      <div class="plot-status"></div>
    `;
    plot.addEventListener('click', () => handlePlotClick(i));
    plot.addEventListener('touchstart', () => handlePlotClick(i));
    farmArea.appendChild(plot);
    farmPlots.push({ planted: false, vegetable: null, progress: 0, watered: false, currentFrame: 1, countdown: 0, totalCountdown: 0 });
  }

  updateUIText();
}

// Handle plot click with manual growth
function handlePlotClick(index) {
  const plot = farmPlots[index];
  const plotElement = document.querySelectorAll('.plot')[index];
  const plotContent = plotElement.querySelector('.plot-content');
  const plotStatus = plotElement.querySelector('.plot-status');
  const countdownFill = plotElement.querySelector('.countdown-fill');

  if (!plot.planted) {
    const seedIndex = inventory.findIndex(item => item && typeof item === 'string' && item.includes('Seed'));
    if (seedIndex !== -1) {
      console.log(`Before planting: inventory = ${JSON.stringify(inventory)}`);
      const seed = inventory[seedIndex];
      const vegId = seed.split(' ')[0].toLowerCase();
      const vegetable = vegetables.find(v => v.id === vegId) || vegetables[Math.floor(Math.random() * vegetables.length)];
      plot.planted = true;
      plot.vegetable = vegetable;
      plot.progress = 0;
      plot.watered = false;
      plot.currentFrame = 1;
      plot.countdown = vegetable.growthTime;
      plot.totalCountdown = vegetable.growthTime;

      const flyImage = document.createElement('img');
      flyImage.src = vegetable.shopImage;
      flyImage.classList.add('plant-fly');
      flyImage.style.width = '60px';
      plotContent.appendChild(flyImage);

      const amountText = document.createElement('div');
      amountText.textContent = '-1';
      amountText.classList.add('amount-text', 'negative');
      plotContent.appendChild(amountText);

      setTimeout(() => {
        flyImage.remove();
        amountText.remove();
        plotContent.innerHTML = '';
        const plantImg = document.createElement('img');
        plantImg.classList.add('plant-img');
        plantImg.src = `${vegetable.baseImage}${plot.currentFrame}.png`;
        plotContent.appendChild(plantImg);
        setTimeout(() => {
          plantImg.classList.add('loaded');
        }, 50);

        inventory.splice(seedIndex, 1);
        console.log(`After planting: inventory = ${JSON.stringify(inventory)}`);
        savePlayerData();
      }, 800);

      plotStatus.innerHTML = langData[currentLang].needsWater || 'Needs Water';
      countdownFill.style.width = '0%';

      showNotification(langData[currentLang].planted);
      playBuyingSound();
    } else {
      showNotification(langData[currentLang].noSeeds || 'No Seeds in inventory!');
    }
  } else if (plot.planted && !plot.watered && plot.currentFrame < plot.vegetable.frames) {
    const waterNeeded = plot.vegetable.waterNeeded || 1;
    if (water >= waterNeeded) {
      water -= waterNeeded;
      plot.watered = true;

      const waterImage = document.createElement('img');
      waterImage.src = 'assets/img/ui/water_icon.png';
      waterImage.classList.add('water-fly');
      waterImage.style.width = '40px';
      waterImage.style.top = '-40px';
      plotContent.appendChild(waterImage);

      const amountText = document.createElement('div');
      amountText.textContent = `-${waterNeeded}`;
      amountText.classList.add('amount-text', 'negative');
      plotContent.appendChild(amountText);

      setTimeout(() => {
        waterImage.remove();
        amountText.remove();
      }, 800);

      updateWallet();
      showNotification(langData[currentLang].watered);
      playWateringSound();

      const countdownInterval = setInterval(() => {
        if (!plot.planted) {
          clearInterval(countdownInterval);
          countdownFill.style.width = '0%';
          return;
        }
        if (plot.currentFrame >= plot.vegetable.frames) {
          clearInterval(countdownInterval);
          countdownFill.style.width = '100%';
          plotElement.classList.add('ready');
          plotStatus.innerHTML = langData[currentLang].readyToHarvest || 'Ready to Harvest';
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
            plot.totalCountdown = plot.vegetable.growthTime;
            let plantImg = plotContent.querySelector('.plant-img');
            if (!plantImg) {
              plantImg = document.createElement('img');
              plantImg.classList.add('plant-img');
              plotContent.appendChild(plantImg);
            }
            plantImg.classList.remove('loaded');
            plantImg.src = `${vegetable.baseImage}${plot.currentFrame}.png`;
            setTimeout(() => {
              plantImg.classList.add('loaded');
            }, 50);
            if (plot.currentFrame >= plot.vegetable.frames) {
              plotElement.classList.add('ready');
              plotStatus.innerHTML = langData[currentLang].readyToHarvest || 'Ready to Harvest';
              clearInterval(countdownInterval);
              countdownFill.style.width = '100%';
            } else {
              plotStatus.innerHTML = langData[currentLang].needsWater || 'Needs Water';
              countdownFill.style.width = '0%';
            }
          } else {
            plotStatus.innerHTML = langData[currentLang].growing || 'Growing';
          }
        } else {
          plotStatus.innerHTML = langData[currentLang].needsWater || 'Needs Water';
          clearInterval(countdownInterval);
          countdownFill.style.width = '0%';
        }
      }, 1000);
    } else {
      showNotification(langData[currentLang].notEnoughWater);
    }
  } else if (plot.currentFrame >= plot.vegetable.frames || plotElement.classList.contains('ready')) {
    const yieldAmount = plot.vegetable.yield || 1;
    inventory.push({ vegetable: plot.vegetable, quantity: yieldAmount });
    savePlayerData();
  
    const flyImage = document.createElement('img');
    flyImage.src = plot.vegetable.shopImage;
    flyImage.classList.add('plant-fly');
    flyImage.style.width = '60px';
    plotContent.appendChild(flyImage);

    const amountText = document.createElement('div');
    amountText.textContent = `+${yieldAmount}`;
    amountText.classList.add('amount-text', 'positive');
    plotContent.appendChild(amountText);

    setTimeout(() => {
      flyImage.remove();
      amountText.remove();
      plotContent.innerHTML = '';
      plotStatus.innerHTML = '';
      countdownFill.style.width = '0%';
      plotElement.classList.remove('ready');
    }, 800);

    plot.planted = false;
    plot.vegetable = null;
    plot.progress = 0;
    plot.watered = false;
    plot.currentFrame = 1;
    plot.countdown = 0;
    plot.totalCountdown = 0;

    harvestCount++;
    savePlayerData();
    checkHarvestAchievement();
    showNotification(langData[currentLang].harvested);
    playHarvestSound();
    renderInventory();
    renderSellSection();
  }
}

// Render shop with Water item
function renderShop() {
  const shopContent = document.getElementById('shop-content');
  if (!shopContent) {
    alert('shop-content element not found');
    return;
  }

  shopContent.innerHTML = '';
  if (!vegetables || vegetables.length === 0) {
    shopContent.innerHTML = `<p>${langData[currentLang].noItems || 'No items available in shop. Please check vegetables.json.'}</p>`;
    return;
  }

  vegetables.forEach(veg => {
    const vegItem = document.createElement('div');
    vegItem.classList.add('shop-item');
    const farmPrice = veg.farmPrice !== undefined ? veg.farmPrice : 0;
    vegItem.innerHTML = `
      <img src="${veg.shopImage}" alt="${veg.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${veg.name[currentLang]}</h3>
      <p>${langData[currentLang].farmPriceLabel || 'Farm Price'}: ${farmPrice} ${langData[currentLang].coinLabel}</p>
      <p>${langData[currentLang].piPriceLabel || 'PI Price'}: ${veg.piPrice} PI</p>
      <button class="buy-btn" data-id="${veg.id}">${langData[currentLang].buyLabel} (Farm)</button>
      <button class="buy-pi-btn" data-id="${veg.id}">${langData[currentLang].buyLabel} (PI)</button>
    `;
    shopContent.appendChild(vegItem);
  });

  const waterItem = document.createElement('div');
  waterItem.classList.add('shop-item');
  waterItem.innerHTML = `
    <img src="assets/img/ui/water.png" alt="${langData[currentLang].waterLabel || 'Water'}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
    <h3>${langData[currentLang].waterLabel || 'Water'}</h3>
    <p>${langData[currentLang].farmPriceLabel || 'Farm Price'}: 100 ${langData[currentLang].coinLabel}</p>
    <p>${langData[currentLang].piPriceLabel || 'PI Price'}: 0.0001 PI</p>
    <button class="buy-btn" data-id="water">${langData[currentLang].buyLabel} (Farm)</button>
    <button class="buy-pi-btn" data-id="water">${langData[currentLang].buyLabel} (PI)</button>
  `;
  shopContent.appendChild(waterItem);

  document.querySelectorAll('.buy-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      buyVegetable(id, 'farm');
    });
    btn.addEventListener('touchstart', (e) => {
      const id = e.target.getAttribute('data-id');
      buyVegetable(id, 'farm');
    });
  });

  document.querySelectorAll('.buy-pi-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.target.getAttribute('data-id');
      buyVegetable(id, 'pi');
    });
    btn.addEventListener('touchstart', (e) => {
      const id = e.target.getAttribute('data-id');
      buyVegetable(id, 'pi');
    });
  });
}

// Buy vegetable or water
function buyVegetable(id, currency) {
  if (id === 'water') {
    if (currency === 'farm') {
      if (farmCoins >= 100) {
        farmCoins -= 100;
        water += 10;
        updateWallet();
        showTransactionAnimation(`-100`, false, document.querySelector(`.buy-btn[data-id="water"]`));
        playBuyingSound();
      } else {
        showNotification(langData[currentLang].notEnoughCoins);
      }
    } else {
      if (pi >= 0.0001) {
        pi -= 0.0001;
        water += 10;
        updateWallet();
        showTransactionAnimation(`-0.0001 PI`, false, document.querySelector(`.buy-pi-btn[data-id="water"]`));
        playBuyingSound();
      } else {
        showNotification(langData[currentLang].notEnoughPi);
      }
    }
    return;
  }

  const veg = vegetables.find(v => v.id === id);
  if (!veg) return;

  if (currency === 'farm') {
    if (farmCoins >= veg.farmPrice) {
      farmCoins -= veg.farmPrice;
      inventory.push(`${veg.name[currentLang]} ${langData[currentLang].seedLabel || 'Seed'}`);
      savePlayerData();
      updateWallet();
      showTransactionAnimation(`-${veg.farmPrice}`, false, document.querySelector(`.buy-btn[data-id="${id}"]`));
      playBuyingSound();
    } else {
      showNotification(langData[currentLang].notEnoughCoins);
    }
  } else {
    if (pi >= veg.piPrice) {
      pi -= veg.piPrice;
      inventory.push(`${veg.name[currentLang]} ${langData[currentLang].seedLabel || 'Seed'}`);
      savePlayerData();
      updateWallet();
      showTransactionAnimation(`-${veg.piPrice} PI`, false, document.querySelector(`.buy-pi-btn[data-id="${id}"]`));
      playBuyingSound();
    } else {
      showNotification(langData[currentLang].notEnoughPi);
    }
  }
}

// Render inventory
function renderInventory() {
  const inventoryContent = document.getElementById('inventory-content');
  inventoryContent.innerHTML = '';
  inventory.forEach((item, index) => {
    if (typeof item === 'string' && item.includes('Seed')) {
      const vegName = item.split(' ')[0];
      const veg = vegetables.find(v => v.name[currentLang] === vegName);
      const invItem = document.createElement('div');
      invItem.classList.add('inventory-item');
      invItem.innerHTML = `
        <img src="${veg ? veg.shopImage : 'assets/img/ui/seed.png'}" alt="${item}" class="shop-item-img">
        <h3>${item}</h3>
        <p>${langData[currentLang].quantityLabel || 'Quantity'}: 1</p>
      `;
      inventoryContent.appendChild(invItem);
    } else if (item && item.vegetable) {
      const invItem = document.createElement('div');
      invItem.classList.add('inventory-item');
      invItem.innerHTML = `
        <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img">
        <h3>${item.vegetable.name[currentLang]}</h3>
        <p>${langData[currentLang].quantityLabel || 'Quantity'}: ${item.quantity}</p>
      `;
      inventoryContent.appendChild(invItem);
    }
  });
}

// Render sell section
function renderSellSection() {
  const sellContent = document.getElementById('sell-content');
  sellContent.innerHTML = '';
  inventory.forEach((item, index) => {
    if (item && item.vegetable) {
      const sellItem = document.createElement('div');
      sellItem.classList.add('sell-item');
      const sellPrice = item.vegetable.sellPrice || Math.floor(item.vegetable.farmPrice * 0.5);
      sellItem.innerHTML = `
        <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
        <h3>${item.vegetable.name[currentLang]}</h3>
        <p>${langData[currentLang].quantityLabel || 'Quantity'}: ${item.quantity}</p>
        <p>${langData[currentLang].sellPriceLabel || 'Sell Price'}: ${sellPrice} ${langData[currentLang].coinLabel}</p>
        <button class="sell-btn" data-index="${index}">${langData[currentLang].sellLabel || 'Sell'}</button>
      `;
      sellContent.appendChild(sellItem);
    }
  });

  document.querySelectorAll('.sell-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      sellItem(index);
    });
    btn.addEventListener('touchstart', (e) => {
      const index = parseInt(e.target.getAttribute('data-index'));
      sellItem(index);
    });
  });
}

// Sell item
function sellItem(index) {
  const item = inventory[index];
  if (!item || !item.vegetable) return;

  const sellPrice = item.vegetable.sellPrice || Math.floor(item.vegetable.farmPrice * 0.5);
  farmCoins += sellPrice * item.quantity;
  xp += 10;
  checkLevelUp();
  inventory.splice(index, 1);
  savePlayerData();
  updateWallet();
  renderInventory();
  renderSellSection();
  showTransactionAnimation(`+${sellPrice * item.quantity}`, true, document.querySelector(`.sell-btn[data-index="${index}"]`));
  playCoinSound();
  checkCoinAchievement();
}

// Check level up
function checkLevelUp() {
  const xpRequired = level * 100;
  while (xp >= xpRequired) {
    xp -= xpRequired;
    level++;
    showNotification(`${langData[currentLang].levelUp} ${level}`);
  }
  updateWallet();
}

// Switch tabs
function switchTab(tab) {
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });

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

// Exchange PI to Farm Coins
function exchangePi() {
  const amount = parseFloat(document.getElementById('exchange-amount').value);
  if (isNaN(amount) || amount <= 0) {
    showNotification(langData[currentLang].invalidAmount || 'Invalid amount!');
    return;
  }

  if (pi >= amount) {
    pi -= amount;
    farmCoins += amount * piToFarmRate;
    updateWallet();
    showNotification(langData[currentLang].exchanged);
    playCoinSound();
    checkCoinAchievement();
    updateExchangeResult();
  } else {
    showNotification(langData[currentLang].notEnoughPi);
  }
}

// Update exchange result
function updateExchangeResult() {
  const amount = parseFloat(document.getElementById('exchange-amount').value) || 0;
  const farmCoinsResult = amount * piToFarmRate;
  document.getElementById('exchange-result').textContent = farmCoinsResult;
}

// Modal untuk daily reward
const rewardModal = document.getElementById('reward-modal');
const claimModalBtn = document.getElementById('claim-modal-btn');
const closeModal = document.getElementById('reward-modal-close');

document.getElementById('claim-reward-btn').addEventListener('click', () => {
  rewardModal.style.display = 'block';
  playMenuSound();
});
document.getElementById('claim-reward-btn').addEventListener('touchstart', () => {
  rewardModal.style.display = 'block';
  playMenuSound();
});

claimModalBtn.addEventListener('click', () => {
  farmCoins += 100;
  water += 50;
  console.log(`After claim: farmCoins = ${farmCoins}, water = ${water}`);
  localStorage.setItem('lastClaim', Date.now());
  const playerRef = ref(database, `players/${userId}`);
  set(playerRef, {
    farmCoins,
    pi,
    water,
    level,
    xp,
    inventory,
    harvestCount,
    lastClaim: Date.now(),
    musicVolume: parseInt(localStorage.getItem('musicVolume')) || 50,
    voiceVolume: parseInt(localStorage.getItem('voiceVolume')) || 50
  })
    .then(() => {
      console.log('Player data saved to Firebase after claim');
      updateWallet();
      showTransactionAnimation('+100 Coins, +50 Water', true, claimModalBtn);
      playCoinSound();
      rewardModal.style.display = 'none';
    })
    .catch(error => {
      console.log('Error saving player data to Firebase:', error.message);
      updateWallet();
      showTransactionAnimation('+100 Coins, +50 Water', true, claimModalBtn);
      playCoinSound();
      rewardModal.style.display = 'none';
      showNotification('Failed to save claim data, but rewards added.');
    });
});

closeModal.addEventListener('click', () => {
  rewardModal.style.display = 'none';
  playMenuSound();
});
closeModal.addEventListener('touchstart', () => {
  rewardModal.style.display = 'none';
  playMenuSound();
});

// Claim daily reward
function claimDailyReward() {
  const playerRef = ref(database, `players/${userId}/lastClaim`);
  onValue(playerRef, (snapshot) => {
    const lastClaim = snapshot.val() || parseInt(localStorage.getItem('lastClaim'));
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    if (lastClaim && now - lastClaim < oneDay) {
      const timeLeft = oneDay - (now - lastClaim);
      const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      showNotification(`${langData[currentLang].waitLabel || 'Wait'} ${hoursLeft}h ${minutesLeft}m ${langData[currentLang].toClaimAgain || 'to claim again!'}`);
      document.getElementById('claim-reward-btn').disabled = true;
    } else {
      rewardModal.style.display = 'block';
    }
  }, { onlyOnce: true });
}

// Check harvest achievement
function checkHarvestAchievement() {
  if (harvestCount >= 10) {
    const achievement = document.querySelector('.achievement[data-id="harvest"]');
    if (achievement && !achievement.classList.contains('completed')) {
      achievement.classList.add('completed');
      showNotification(langData[currentLang].achievementUnlocked);
      playCoinSound();
    }
  }
}

// Check coin achievement
function checkCoinAchievement() {
  if (farmCoins >= 1000) {
    const achievement = document.querySelector('.achievement[data-id="coins"]');
    if (achievement && !achievement.classList.contains('completed')) {
      achievement.classList.add('completed');
      showNotification(langData[currentLang].achievementUnlocked);
      playCoinSound();
    }
  }
}

// Render achievements
function renderAchievements() {
  const achievementsContent = document.getElementById('achievements-content');
  achievementsContent.innerHTML = `
    <div class="achievement ${harvestCount >= 10 ? 'completed' : ''}" data-id="harvest">
      <h3>${langData[currentLang].achievementHarvest}</h3>
      <p>${langData[currentLang].achievementHarvestDesc}</p>
    </div>
    <div class="achievement ${farmCoins >= 1000 ? 'completed' : ''}" data-id="coins">
      <h3>${langData[currentLang].achievementCoins}</h3>
      <p>${langData[currentLang].achievementCoinsDesc}</p>
    </div>
  `;
}

// Show notification
function showNotification(message) {
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => {
      notification.style.display = 'none';
    }, 2000);
  }
}

// Show transaction animation
function showTransactionAnimation(amount, isPositive, element) {
  const anim = document.createElement('div');
  anim.classList.add('transaction-animation');
  anim.classList.add(isPositive ? 'positive' : 'negative');
  anim.textContent = amount;
  const rect = element.getBoundingClientRect();
  anim.style.left = `${rect.left + rect.width / 2}px`;
  anim.style.top = `${rect.top - 20}px`;
  document.body.appendChild(anim);
  setTimeout(() => anim.remove(), 1000);
}

// Update UI text based on langData
function updateUIText() {
  document.getElementById('title').textContent = langData[currentLang].title || 'Harvest Pi';
  document.getElementById('start-text').textContent = langData[currentLang].startBtn || 'Start Game';
  document.getElementById('lang-toggle').textContent = langData[currentLang].switchLangLabel || 'Switch Language (EN/ID)';
  document.getElementById('game-lang-toggle').textContent = langData[currentLang].switchLangLabel || 'Switch Language (EN/ID)';
  document.getElementById('game-title').textContent = langData[currentLang].title || 'Harvest Pi';
  document.querySelector('.tab-btn[data-tab="farm"]').textContent = langData[currentLang].farmTab || 'Farm';
  document.querySelector('.tab-btn[data-tab="shop"]').textContent = langData[currentLang].shopTab || 'Shop';
  document.querySelector('.tab-btn[data-tab="upgrades"]').textContent = langData[currentLang].upgradesTab || 'Upgrades';
  document.querySelector('.tab-btn[data-tab="inventory"]').textContent = langData[currentLang].inventoryTab || 'Inventory';
  document.querySelector('.tab-btn[data-tab="exchange"]').textContent = langData[currentLang].exchangeTab || 'Exchange';
  document.querySelector('.tab-btn[data-tab="leaderboard"]').textContent = langData[currentLang].leaderboardTab || 'Leaderboard';
  document.querySelector('.tab-btn[data-tab="achievements"]').textContent = langData[currentLang].achievementsTab || 'Achievements';
  document.getElementById('claim-reward-btn').textContent = langData[currentLang].claimRewardBtn || 'Claim Reward';
  document.getElementById('upgrades-title').textContent = langData[currentLang].upgradesTab || 'Upgrades';
  document.getElementById('upgrades-content').textContent = langData[currentLang].comingSoon || 'Coming soon...';
  document.getElementById('leaderboard-title').textContent = langData[currentLang].leaderboardTab || 'Leaderboard';
  document.getElementById('leaderboard-content').textContent = langData[currentLang].comingSoon || 'Coming soon...';
  document.getElementById('exchange-title').textContent = langData[currentLang].exchangeTab || 'Exchange';
  document.getElementById('exchange-rate').textContent = langData[currentLang].exchangeRateLabel || `1 PI = ${piToFarmRate} Coins`;
  document.getElementById('exchange-amount').placeholder = langData[currentLang].enterPiAmount || 'Enter PI amount';
  document.getElementById('exchange-btn').textContent = langData[currentLang].exchangeBtn || 'Exchange';
  document.getElementById('sell-section-title').textContent = langData[currentLang].sellItemsLabel || 'Sell Items';
  document.getElementById('settings-title').textContent = langData[currentLang].settingsLabel || 'Settings';
  document.getElementById('music-volume-label').textContent = langData[currentLang].musicVolumeLabel || 'Music Volume:';
  document.getElementById('voice-volume-label').textContent = langData[currentLang].voiceVolumeLabel || 'Voice/SFX Volume:';
}

// Start game
function startGame() {
  alert('Start Game clicked!');
  document.getElementById('start-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  setTimeout(() => {
    playBgMusic();
    playBgVoice();
  }, 100);
  switchTab('farm');
}

// Exit game
function exitGame() {
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('start-screen').style.display = 'block';
  if (bgMusic) bgMusic.pause();
  if (bgVoice) bgVoice.pause();
}

// Toggle language
function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'id' : 'en';
  updateUIText();
  updateWallet();
  renderShop();
  renderInventory();
  renderSellSection();
  renderAchievements();
  playMenuSound();
}

// Open settings
function openSettings() {
  const modal = document.getElementById('settings-modal');
  modal.style.display = 'block';
  playMenuSound();
}

// Initialize settings
function initializeSettings() {
  const musicVolumeSlider = document.getElementById('music-volume');
  const voiceVolumeSlider = document.getElementById('voice-volume');
  const closeSettings = document.getElementById('close-settings');

  musicVolumeSlider.value = localStorage.getItem('musicVolume') || 50;
  voiceVolumeSlider.value = localStorage.getItem('voiceVolume') || 50;

  musicVolumeSlider.addEventListener('input', () => {
    localStorage.setItem('musicVolume', musicVolumeSlider.value);
    updateVolumes();
  });

  voiceVolumeSlider.addEventListener('input', () => {
    localStorage.setItem('voiceVolume', voiceVolumeSlider.value);
    updateVolumes();
  });

  closeSettings.addEventListener('click', () => {
    document.getElementById('settings-modal').style.display = 'none';
    playMenuSound();
  });
  closeSettings.addEventListener('touchstart', () => {
    document.getElementById('settings-modal').style.display = 'none';
    playMenuSound();
  });
}

// Check daily reward availability
function checkDailyReward() {
  const playerRef = ref(database, `players/${userId}/lastClaim`);
  onValue(playerRef, (snapshot) => {
    const lastClaim = snapshot.val() || parseInt(localStorage.getItem('lastClaim'));
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    if (lastClaim && now - lastClaim < oneDay) {
      document.getElementById('claim-reward-btn').disabled = true;
    }
  }, { onlyOnce: true });
}

// Initialize game
async function initializeGame() {
  console.log('Starting game initialization...');
  let loadingScreen, startScreen;
  
  try {
    console.log('Checking DOM elements...');
    loadingScreen = document.getElementById('loading-screen');
    startScreen = document.getElementById('start-screen');
    if (!loadingScreen || !startScreen) {
      console.log('DOM elements missing: loadingScreen =', loadingScreen, ', startScreen =', startScreen);
      throw new Error('Loading screen or start screen element not found in DOM');
    }

    console.log('Calling loadData()...');
    await loadData();
    console.log('loadData() completed.');

    console.log('Calling loadPlayerData()...');
    await loadPlayerData();
    console.log('loadPlayerData() completed.');

    console.log('Calling initializeSettings()...');
    initializeSettings();
    console.log('initializeSettings() completed.');

  } catch (error) {
    console.log('Error during game initialization:', error.message);
    alert('Error initializing game: ' + error.message);
  } finally {
    console.log('Hiding loading screen in finally block...');
    setTimeout(() => {
      loadingScreen = document.getElementById('loading-screen');
      startScreen = document.getElementById('start-screen');
      if (loadingScreen && startScreen) {
        console.log('Setting loadingScreen display to none...');
        loadingScreen.style.display = 'none';
        console.log('Setting startScreen display to block...');
        startScreen.style.display = 'block';
        console.log('Loading screen hidden, start screen shown.');
      } else {
        console.log('Error in finally block: loadingScreen =', loadingScreen, ', startScreen =', startScreen);
      }
    }, 1000);
  }
}

// DOM Content Loaded
document.addEventListener('DOMContentLoaded', () => {
  alert('main.js loaded successfully!');
  const startText = document.getElementById('start-text');
  if (startText) {
    startText.addEventListener('click', () => {
      alert('Click event triggered on Start Game');
      startGame();
    });
    startText.addEventListener('touchstart', (e) => {
      e.preventDefault();
      alert('Touch event triggered on Start Game');
      startGame();
    });
  } else {
    alert('start-text element not found');
  }

  document.getElementById('lang-toggle')?.addEventListener('click', toggleLanguage);
  document.getElementById('lang-toggle')?.addEventListener('touchstart', toggleLanguage);
  document.getElementById('settings-btn')?.addEventListener('click', openSettings);
  document.getElementById('settings-btn')?.addEventListener('touchstart', openSettings);
  document.getElementById('claim-reward-btn')?.addEventListener('click', claimDailyReward);
  document.getElementById('claim-reward-btn')?.addEventListener('touchstart', claimDailyReward);
  document.getElementById('game-lang-toggle')?.addEventListener('click', toggleLanguage);
  document.getElementById('game-lang-toggle')?.addEventListener('touchstart', toggleLanguage);
  document.getElementById('game-settings-btn')?.addEventListener('click', openSettings);
  document.getElementById('game-settings-btn')?.addEventListener('touchstart', openSettings);
  document.getElementById('exit-game-btn')?.addEventListener('click', exitGame);
  document.getElementById('exit-game-btn')?.addEventListener('touchstart', exitGame);
  document.getElementById('exchange-btn')?.addEventListener('click', exchangePi);
  document.getElementById('exchange-btn')?.addEventListener('touchstart', exchangePi);
  document.getElementById('exchange-amount')?.addEventListener('input', updateExchangeResult);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
    btn.addEventListener('touchstart', () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  initializeGame();
});
