// Ambil database dari firebase-config.js
import { database, ref, onValue, set, update, get, push } from '/firebase/firebase-config.js';

// Deklarasi claimModalBtn dan rewardModal sebagai global
const claimModalBtn = document.getElementById('claim-modal-btn');
const rewardModal = document.getElementById('reward-modal');

// START addSafeClickListener helper
function addSafeClickListener(element, callback) {
  let isLocked = false;
  element.addEventListener('click', (e) => {
    if (isLocked) return;
    isLocked = true;
    callback(e);
    setTimeout(() => isLocked = false, 300);
  });
  element.addEventListener('touchstart', (e) => {
    if (isLocked) return;
    isLocked = true;
    callback(e);
    setTimeout(() => isLocked = false, 300);
  });
}
// END addSafeClickListener helper

// Global variables
let isDataLoaded = false;
let piInitialized = false;
let referralEarnings = 0;
let farmCoins = 0;
let piBalance = 0;
let water = 0;
let level = 1;
let xp = 0;
let inventory = [];
let vegetables = [];
let langData = {};
let currentLang = 'en';
let farmPlots = [];
let harvestCount = 0;
let achievements = { harvest: false, coins: false };
let username = null;
let lastClaim = null;
const plotCount = 4;
const piToFarmRate = 1000000;
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;

// Load user balances
function loadUserBalances() {
  const playerRef = ref(database, `players/${username}`);
  onValue(playerRef, (snapshot) => {
    const data = snapshot.val() || {};
    piBalance = data.piBalance || 0;
    farmCoins = data.farmCoins || 0;
    const piBalanceElement = document.getElementById('pi-balance');
    const fcBalanceElement = document.getElementById('fc-balance');
    if (piBalanceElement) piBalanceElement.textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
    if (fcBalanceElement) fcBalanceElement.textContent = farmCoins.toLocaleString();
    updateWallet();
  });
}

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
    const playPromise = bgMusic.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Background music started successfully');
          isAudioPlaying = true;
        })
        .catch(e => {
          console.log('BG Music failed to start:', e.message);
          setTimeout(() => {
            bgMusic.play().catch(err => console.log('Retry BG Music failed:', err.message));
          }, 100);
        });
    }
  }
}

function playBgVoice() {
  if (bgVoice && !isAudioPlaying) {
    const playPromise = bgVoice.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log('Background voice started successfully');
        })
        .catch(e => {
          console.log('BG Voice failed to start:', e.message);
          setTimeout(() => {
            bgVoice.play().catch(err => console.log('Retry BG Voice failed:', err.message));
          }, 100);
        });
    }
  }
}

function playHarvestingSound() {
  if (harvestingSound) {
    const playPromise = harvestingSound.play();
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

function playPlantingSound() {
  if (plantingSound) {
    const playPromise = plantingSound.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.log('Planting sound failed:', e.message));
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

// Set posisi awal slider dari localStorage
const musicVolumeSlider = document.getElementById('music-volume');
if (musicVolumeSlider) {
  musicVolumeSlider.value = localStorage.getItem('musicVolume') ?? 50;
}
const voiceVolumeSlider = document.getElementById('voice-volume');
if (voiceVolumeSlider) {
  voiceVolumeSlider.value = localStorage.getItem('voiceVolume') ?? 50;
}

// Listener untuk simpan dan update volume real-time
if (musicVolumeSlider) {
  musicVolumeSlider.addEventListener('input', function () {
    localStorage.setItem('musicVolume', this.value);
    updateVolumes();
  });
}
if (voiceVolumeSlider) {
  voiceVolumeSlider.addEventListener('input', function () {
    localStorage.setItem('voiceVolume', this.value);
    updateVolumes();
  });
}

// Update audio volumes
function updateVolumes() {
  const musicVolume = parseFloat(localStorage.getItem('musicVolume') ?? 50);
  const voiceVolume = parseFloat(localStorage.getItem('voiceVolume') ?? 50);
  const musicVol = Math.min(Math.max(musicVolume / 100, 0), 1);
  const voiceVol = Math.min(Math.max(voiceVolume / 100, 0), 1);
  if (bgMusic) bgMusic.volume = musicVol;
  if (bgVoice) bgVoice.volume = voiceVol;
  if (harvestingSound) harvestingSound.volume = voiceVol;
  if (wateringSound) wateringSound.volume = voiceVol;
  if (plantingSound) plantingSound.volume = voiceVol;
  if (menuSound) menuSound.volume = voiceVol;
  if (buyingSound) buyingSound.volume = voiceVol;
  if (coinSound) coinSound.volume = voiceVol;
  console.log('Updated Volumes:', { musicVol, voiceVol });
}

// Panggil update pertama kali
updateVolumes();

// START loadData
async function loadData() {
  try {
    const langRes = await fetch('/data/lang.json');
    langData = await langRes.json();
    console.log('Language data loaded:', langData);
    const vegRes = await fetch('/data/vegetables.json');
    const vegJson = await vegRes.json();
    vegetables = vegJson.vegetables;
    console.log('Vegetables data loaded:', vegetables);
  } catch (error) {
    console.error('Error loading data:', error.message);
    showNotification('Error loading game data.');
  }
}
// END loadData

// Cek apakah di Pi Browser
function isPiBrowser() {
  return navigator.userAgent.includes('PiBrowser');
}

// Document ready event listener
document.addEventListener('DOMContentLoaded', () => {
  if (!isPiBrowser()) {
    const notificationElement = document.getElementById('notification');
    if (notificationElement) {
      notificationElement.textContent = 'Please open this game in Pi Browser!';
      notificationElement.style.display = 'block';
    }
    return; // Hentikan inisialisasi jika bukan Pi Browser
  }

  const startTextElement = document.getElementById('start-text');
  if (startTextElement) addSafeClickListener(startTextElement, startGame);

  const langToggleElement = document.getElementById('lang-toggle');
  if (langToggleElement) addSafeClickListener(langToggleElement, toggleLanguage);

  const gameLangToggleElement = document.getElementById('game-lang-toggle');
  if (gameLangToggleElement) addSafeClickListener(gameLangToggleElement, toggleLanguage);

  const settingsBtnElement = document.getElementById('settings-btn');
  if (settingsBtnElement) {
    addSafeClickListener(settingsBtnElement, () => {
      const settingsModalElement = document.getElementById('settings-modal');
      if (settingsModalElement) {
        settingsModalElement.style.display = 'block';
        playMenuSound();
      }
    });
  }

  const gameSettingsBtnElement = document.getElementById('game-settings-btn');
  if (gameSettingsBtnElement) {
    addSafeClickListener(gameSettingsBtnElement, () => {
      const settingsModalElement = document.getElementById('settings-modal');
      if (settingsModalElement) {
        settingsModalElement.style.display = 'block';
        playMenuSound();
      }
    });
  }

  const closeSettingsElement = document.getElementById('close-settings');
  if (closeSettingsElement) {
    addSafeClickListener(closeSettingsElement, () => {
      const settingsModalElement = document.getElementById('settings-modal');
      if (settingsModalElement) {
        settingsModalElement.style.display = 'none';
        playMenuSound();
      }
    });
  }

  const rewardModalCloseElement = document.getElementById('reward-modal-close');
  if (rewardModalCloseElement) {
    addSafeClickListener(rewardModalCloseElement, () => {
      if (rewardModal) rewardModal.style.display = 'none';
      playMenuSound();
    });
  }

  const fullscreenToggleElement = document.getElementById('fullscreen-toggle');
  if (fullscreenToggleElement) {
    addSafeClickListener(fullscreenToggleElement, () => {
      if (!document.fullscreenElement) {
        enterFullScreen();
      } else {
        exitFullScreen();
      }
      playMenuSound();
    });
  }

  if (musicVolumeSlider) {
    musicVolumeSlider.addEventListener('input', () => {
      localStorage.setItem('musicVolume', musicVolumeSlider.value);
      updateVolumes();
    });
  }

  if (voiceVolumeSlider) {
    voiceVolumeSlider.addEventListener('input', () => {
      localStorage.setItem('voiceVolume', voiceVolumeSlider.value);
      updateVolumes();
    });
  }

  const exitGameBtnElement = document.getElementById('exit-game-btn');
  if (exitGameBtnElement) {
    addSafeClickListener(exitGameBtnElement, () => {
      if (bgMusic) bgMusic.pause();
      if (bgVoice) bgVoice.pause();
      window.location.reload();
    });
  }

  const exchangeBtnElement = document.getElementById('exchange-btn');
  if (exchangeBtnElement) addSafeClickListener(exchangeBtnElement, handleExchange);

  const exchangeAmountElement = document.getElementById('exchange-amount');
  if (exchangeAmountElement) exchangeAmountElement.addEventListener('input', updateExchangeResult);

  const tabButtons = document.querySelectorAll('.tab-btn');
  if (tabButtons) {
    tabButtons.forEach(btn => {
      addSafeClickListener(btn, () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });
  }

  const directionSelect = document.getElementById("exchange-direction");
  if (directionSelect) {
    directionSelect.addEventListener("change", updateExchangeResult);
  }

  const buyTabElement = document.getElementById('shop-buy-tab');
  const sellTabElement = document.getElementById('shop-sell-tab');
  const shopContentElement = document.getElementById('shop-content');
  const sellContentElement = document.getElementById('sell-section');

  if (buyTabElement) {
    addSafeClickListener(buyTabElement, () => {
      buyTabElement.classList.add('active');
      if (sellTabElement) sellTabElement.classList.remove('active');
      if (shopContentElement) shopContentElement.style.display = 'block';
      if (sellContentElement) sellContentElement.style.display = 'none';
      renderShop();
      playMenuSound();
    });
  }

  if (sellTabElement) {
    addSafeClickListener(sellTabElement, () => {
      sellTabElement.classList.add('active');
      if (buyTabElement) buyTabElement.classList.remove('active');
      if (shopContentElement) shopContentElement.style.display = 'none';
      if (sellContentElement) sellContentElement.style.display = 'block';
      renderSellSection();
      playMenuSound();
    });
  }

  // Login with Pi
  const piLoginBtn = document.getElementById('pi-login-btn');
  if (piLoginBtn) {
    addSafeClickListener(piLoginBtn, async () => {
      try {
        const loginError = document.getElementById('login-error');
        loginError.style.display = 'none';

        if (!piInitialized) {
          await Pi.init({ version: "2.0" });
          piInitialized = true;
        }

        const user = await Pi.authenticate(['username'], (response) => {
          console.log('Pi Auth Response:', response);
        });

        username = user.accessToken ? user.user.username : null;
        if (!username) {
          loginError.style.display = 'block';
          loginError.textContent = 'Failed to retrieve username from Pi Network.';
          return;
        }

        localStorage.setItem('username', username);

        const playerRef = ref(database, `players/${username}`);
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
            referralEarnings: 0,
            username: username
          };
          await set(playerRef, playerData);
        }

        loadPlayerData();
        updateReferralLink();

        const loginScreenElement = document.getElementById('login-screen');
        const startScreenElement = document.getElementById('start-screen');
        if (loginScreenElement && startScreenElement) {
          loginScreenElement.style.display = 'none';
          startScreenElement.style.display = 'flex';
        }

        showNotification('Logged in with Pi Network!');
      } catch (error) {
        console.error('Pi Login failed:', error.message);
        const loginError = document.getElementById('login-error');
        loginError.style.display = 'block';
        loginError.textContent = 'Login failed: ' + error.message;
      }
    });
  }

  initializeGame();
});

// Update referral link
function updateReferralLink() {
  const referralLinkElement = document.getElementById('referral-link');
  const copyReferralBtn = document.getElementById('copy-referral-btn');
  if (referralLinkElement && username) {
    const link = generateReferralLink(username);
    referralLinkElement.textContent = link;
    if (copyReferralBtn) {
      addSafeClickListener(copyReferralBtn, () => {
        copyToClipboard(link, copyReferralBtn);
        showNotification('Referral link copied!');
      });
    }
  } else {
    console.warn('Referral link element or username not found');
  }
}

// Generate referral link
function generateReferralLink(username) {
  return `https://www.harvestpi.biz.id/?ref=${username}`;
}

// Load player data
function loadPlayerData() {
  try {
    if (!username) {
      console.warn('No username, please login first!');
      showNotification('Please login first.');
      return;
    }
    console.log('Loading data for username:', username);
    const playerRef = ref(database, `players/${username}`);
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
        referralEarnings = data.referralEarnings || 0;
        console.log('Player data loaded:', data);
      } else {
        console.log('No data found, initializing new data...');
        const initialData = {
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
          referralEarnings: 0,
          username: username
        };
        set(playerRef, initialData).catch(err => {
          console.error('Initial set failed:', err);
          showNotification('Error initializing player data.');
        });
      }
      isDataLoaded = true;
      console.log('Data loading completed, isDataLoaded:', isDataLoaded);
      updateWallet();
      initializePlots();
      renderShop();
      renderInventory();
      renderSellSection();
      renderAchievements();
      checkDailyReward();
    }, (error) => {
      console.error('OnValue error:', error.message);
      showNotification('Failed to load data: ' + error.message);
    }, { onlyOnce: false });
  } catch (error) {
    console.error('Error in loadPlayerData:', error.message);
    showNotification('Failed to connect to Firebase: ' + error.message);
    isDataLoaded = false;
  }
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
    farmPlots = [];
    for (let i = 0; i < plotCount; i++) {
      farmPlots.push({
        planted: false,
        vegetable: null,
        progress: 0,
        watered: false,
        currentFrame: 1,
        countdown: 0,
        totalCountdown: 0
      });
    }
  }
  farmPlots.forEach((plot, i) => {
    const plotElement = document.createElement('div');
    plotElement.classList.add('plot');
    plotElement.innerHTML = `
      <div class="plot-content"></div>
      <div class="countdown-bar">
        <div class="countdown-fill"></div>
      </div>
      <div class="plot-status"></div>
    `;
    addSafeClickListener(plotElement, () => handlePlotClick(i));
    farmAreaElement.appendChild(plotElement);
    if (plot.planted && plot.vegetable) {
      const plotContent = plotElement.querySelector('.plot-content');
      const plotStatus = plotElement.querySelector('.plot-status');
      const countdownFill = plotElement.querySelector('.countdown-fill');
      const plantImg = document.createElement('img');
      plantImg.classList.add('plant-img');
      plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
      plantImg.onerror = () => { plantImg.src = 'assets/img/ui/placeholder.png'; };
      plotContent.appendChild(plantImg);
      plantImg.classList.add('loaded');
      if (plot.currentFrame >= plot.vegetable.frames) {
        plotElement.classList.add('ready');
        if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
        if (countdownFill) countdownFill.style.width = '100%';
      } else if (plot.watered) {
        if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
        const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
        if (countdownFill) countdownFill.style.width = `${progress}%`;
        const countdownInterval = setInterval(() => {
          if (!plot.planted) {
            clearInterval(countdownInterval);
            if (countdownFill) countdownFill.style.width = '0%';
            return;
          }
          if (plot.currentFrame >= plot.vegetable.frames) {
            clearInterval(countdownInterval);
            if (countdownFill) countdownFill.style.width = '100%';
            plotElement.classList.add('ready');
            if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
            return;
          }
          if (plot.watered) {
            plot.countdown--;
            const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
            if (countdownFill) countdownFill.style.width = `${progress}%`;
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
              plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
              plantImg.onerror = () => { plantImg.src = 'assets/img/ui/placeholder.png'; };
              setTimeout(() => {
                plantImg.classList.add('loaded');
              }, 50);
              if (plot.currentFrame >= plot.vegetable.frames) {
                plotElement.classList.add('ready');
                if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
                clearInterval(countdownInterval);
                if (countdownFill) countdownFill.style.width = '100%';
              } else {
                if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                if (countdownFill) countdownFill.style.width = '0%';
              }
            } else {
              if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
            }
          } else {
            if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
            clearInterval(countdownInterval);
            if (countdownFill) countdownFill.style.width = '0%';
          }
          savePlayerData();
        }, 1000);
      } else {
        if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
        if (countdownFill) countdownFill.style.width = '0%';
      }
    }
  });
  updateUIText();
}

// Handle plot click
function handlePlotClick(index) {
  const plot = farmPlots[index];
  const plotElement = document.querySelectorAll('.plot')[index];
  const plotContent = plotElement ? plotElement.querySelector('.plot-content') : null;
  const plotStatus = plotElement ? plotElement.querySelector('.plot-status') : null;
  const countdownFill = plotElement ? plotElement.querySelector('.countdown-fill') : null;
  if (!plot.planted) {
    const seedIndex = inventory.findIndex(item => item && item.type === 'seed' && item.quantity > 0);
    if (seedIndex !== -1) {
      const seed = inventory[seedIndex];
      const vegetable = seed.vegetable;
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
      if (plotContent) plotContent.appendChild(flyImage);
      const amountText = document.createElement('div');
      amountText.textContent = '-1';
      amountText.classList.add('amount-text', 'negative');
      if (plotContent) plotContent.appendChild(amountText);
      setTimeout(() => {
        if (flyImage.parentNode) flyImage.remove();
        if (amountText.parentNode) amountText.remove();
        if (plotContent) plotContent.innerHTML = '';
        const plantImg = document.createElement('img');
        plantImg.classList.add('plant-img');
        plantImg.src = `${vegetable.baseImage}${plot.currentFrame}.png`;
        plantImg.onerror = () => { plantImg.src = 'assets/img/ui/placeholder.png'; };
        if (plotContent) plotContent.appendChild(plantImg);
        setTimeout(() => {
          plantImg.classList.add('loaded');
        }, 50);
      }, 800);
      if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
      if (countdownFill) countdownFill.style.width = '0%';
      inventory[seedIndex].quantity -= 1;
      if (inventory[seedIndex].quantity <= 0) {
        inventory.splice(seedIndex, 1);
      }
      savePlayerData();
      renderInventory();
      showNotification(langData[currentLang]?.planted || 'Planted!');
      playPlantingSound();
      return;
    } else {
      showNotification(langData[currentLang]?.noSeeds || 'No Seeds in inventory!');
    }
  } else if (plot.planted && !plot.watered && plot.currentFrame < plot.vegetable.frames) {
    const waterNeeded = plot.vegetable.waterNeeded || 1;
    if (water >= waterNeeded) {
      water -= waterNeeded;
      plot.watered = true;
      const waterImage = document.createElement('img');
      waterImage.src = 'assets/img/ui/water_icon.png';
      waterImage.onerror = () => { waterImage.src = 'assets/img/ui/placeholder.png'; };
      waterImage.classList.add('water-fly');
      waterImage.style.width = '40px';
      waterImage.style.top = '-40px';
      if (plotContent) plotContent.appendChild(waterImage);
      const amountText = document.createElement('div');
      amountText.textContent = `-${waterNeeded}`;
      amountText.classList.add('amount-text', 'negative');
      if (plotContent) plotContent.appendChild(amountText);
      setTimeout(() => {
        if (waterImage.parentNode) waterImage.remove();
        if (amountText.parentNode) amountText.remove();
      }, 800);
      updateWallet();
      showNotification(langData[currentLang]?.watered || 'Watered!');
      playWateringSound();
      const countdownInterval = setInterval(() => {
        if (!plot.planted) {
          clearInterval(countdownInterval);
          if (countdownFill) countdownFill.style.width = '0%';
          return;
        }
        if (plot.currentFrame >= plot.vegetable.frames) {
          clearInterval(countdownInterval);
          if (countdownFill) countdownFill.style.width = '100%';
          plotElement.classList.add('ready');
          if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
          return;
        }
        if (plot.watered) {
          plot.countdown--;
          const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
          if (countdownFill) countdownFill.style.width = `${progress}%`;
          if (plot.countdown <= 0) {
            plot.currentFrame++;
            plot.watered = false;
            plot.countdown = plot.vegetable.growthTime;
            plot.totalCountdown = plot.vegetable.growthTime;
            let plantImg = plotContent ? plotContent.querySelector('.plant-img') : null;
            if (!plantImg) {
              plantImg = document.createElement('img');
              plantImg.classList.add('plant-img');
              if (plotContent) plotContent.appendChild(plantImg);
            }
            plantImg.classList.remove('loaded');
            plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
            plantImg.onerror = () => { plantImg.src = 'assets/img/ui/placeholder.png'; };
            setTimeout(() => {
              plantImg.classList.add('loaded');
            }, 50);
            if (plot.currentFrame >= plot.vegetable.frames) {
              plotElement.classList.add('ready');
              if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
              clearInterval(countdownInterval);
              if (countdownFill) countdownFill.style.width = '100%';
            } else {
              if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
              if (countdownFill) countdownFill.style.width = '0%';
            }
          } else {
            if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
          }
        } else {
          if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
          clearInterval(countdownInterval);
          if (countdownFill) countdownFill.style.width = '0%';
        }
        savePlayerData();
      }, 1000);
    } else {
      showNotification(langData[currentLang]?.notEnoughWater || 'Not Enough Water!');
    }
  } else if (plot.currentFrame >= plot.vegetable.frames || plotElement.classList.contains('ready')) {
    const yieldAmount = plot.vegetable.yield;
    addToInventory('harvest', plot.vegetable, yieldAmount);
    plot.planted = false;
    plot.vegetable = null;
    plot.progress = 0;
    plot.watered = false;
    plot.currentFrame = 1;
    plot.countdown = 0;
    plot.totalCountdown = 0;
    const flyImage = document.createElement('img');
    const imageSrc = plot.vegetable?.shopImage ? plot.vegetable.shopImage : 'assets/img/ui/placeholder.png';
    flyImage.src = imageSrc;
    flyImage.onerror = () => {
      console.log(`Failed to load fly image: ${imageSrc}, using placeholder`);
      flyImage.src = 'assets/img/ui/placeholder.png';
    };
    flyImage.classList.add('plant-fly');
    flyImage.style.width = '60px';
    document.body.appendChild(flyImage);
    const rect = plotContent ? plotContent.getBoundingClientRect() : { left: 0, top: 0, width: 0 };
    flyImage.style.left = `${rect.left + rect.width / 2 - 30}px`;
    flyImage.style.top = `${rect.top}px`;
    const amountText = document.createElement('div');
    amountText.textContent = `+${yieldAmount}`;
    amountText.classList.add('amount-text', 'positive');
    if (plotContent) plotContent.appendChild(amountText);
    setTimeout(() => {
      if (flyImage.parentNode) flyImage.remove();
      if (amountText.parentNode) amountText.remove();
      if (plotContent) plotContent.innerHTML = '';
      if (plotStatus) plotStatus.innerHTML = '';
      if (countdownFill) countdownFill.style.width = '0%';
      plotElement.classList.remove('ready');
    }, 800);
    harvestCount++;
    savePlayerData();
    checkHarvestAchievement();
    showNotification(langData[currentLang]?.harvested || 'Harvested!');
    playHarvestingSound();
    renderInventory();
    renderSellSection();
  }
}

// Fungsi paksa layout
function forceReflow(el) {
  void el.offsetHeight;
}

// Render shop
function renderShop() {
  const shopContentElement = document.getElementById('shop-content');
  if (!shopContentElement) {
    console.error('shop-content element not found');
    return;
  }
  forceReflow(shopContentElement);
  shopContentElement.style.display = 'grid';
  if (!langData[currentLang]) {
    console.warn('Language data missing, skipping renderShop');
    shopContentElement.innerHTML = `<p style="color:red;">Language data not loaded. Please reload.</p>`;
    return;
  }
  if (!Array.isArray(vegetables) || vegetables.length === 0) {
    console.warn('Vegetables not loaded or invalid');
    shopContentElement.innerHTML = `<p>${langData[currentLang]?.noItems || 'No items available in shop.'}</p>`;
    return;
  }
  shopContentElement.innerHTML = '';
  vegetables.forEach(veg => {
    const vegItem = document.createElement('div');
    vegItem.classList.add('shop-item');
    const farmPrice = typeof veg.farmPrice === 'number' ? veg.farmPrice : 0;
    const piPrice = typeof veg.piPrice === 'number' ? veg.piPrice : 0;
    vegItem.innerHTML = `
      <img src="${veg.shopImage}" alt="${veg.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${veg.name[currentLang]}</h3>
      <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: ${farmPrice} Farm Coins</p>
      <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: ${piPrice} PI</p>
      <button class="buy-btn" data-id="${veg.id}">${langData[currentLang]?.buyLabel || 'Buy'} (Farm)</button>
      <button class="buy-pi-btn" data-id="${veg.id}">${langData[currentLang]?.buyLabel || 'Buy'} (PI)</button>
    `;
    shopContentElement.appendChild(vegItem);
  });
  const waterItem = document.createElement('div');
  waterItem.classList.add('shop-item');
  waterItem.innerHTML = `
    <img src="assets/img/ui/water_icon.png" alt="${langData[currentLang]?.waterLabel || 'Water'}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
    <h3>${langData[currentLang]?.waterLabel || 'Water'}</h3>
    <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: 100 Farm Coins</p>
    <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: 0.0001 PI</p>
    <button class="buy-btn" data-id="water">${langData[currentLang]?.buyLabel || 'Buy'} (Farm)</button>
    <button class="buy-pi-btn" data-id="water">${langData[currentLang]?.buyLabel || 'Buy'} (PI)</button>
  `;
  shopContentElement.appendChild(waterItem);
  shopContentElement.style.display = 'flex';
  const buyButtons = document.querySelectorAll('.buy-btn');
  if (buyButtons) {
    buyButtons.forEach(btn => {
      addSafeClickListener(btn, () => {
        const id = btn.getAttribute('data-id');
        buyVegetable(id, 'farm');
      });
    });
  }
  const buyPiButtons = document.querySelectorAll('.buy-pi-btn');
  if (buyPiButtons) {
    buyPiButtons.forEach(btn => {
      addSafeClickListener(btn, () => {
        const id = btn.getAttribute('data-id');
        buyVegetable(id, 'pi');
      });
    });
  }
}

// Tambah ke inventory
function addToInventory(type, veg, qty = 1) {
  if (!veg || !veg.id) return;
  const existingIndex = inventory.findIndex(item =>
    item && item.type === type && item.vegetable && item.vegetable.id === veg.id
  );
  if (existingIndex !== -1) {
    inventory[existingIndex].quantity += qty;
  } else {
    inventory.push({
      type: type,
      vegetable: veg,
      quantity: qty
    });
  }
  savePlayerData();
}

// Buy vegetable or water
let isSaving = false;
async function buyVegetable(id, currency) {
  if (isSaving) return;
  isSaving = true;
  try {
    if (id === 'water') {
      if (currency === 'farm') {
        if (farmCoins >= 100) {
          farmCoins -= 100;
          water += 10;
          updateWallet();
          showTransactionAnimation(`-100`, false, document.querySelector(`.buy-btn[data-id="water"]`));
          playBuyingSound();
          await savePlayerData();
        } else {
          showNotification(langData[currentLang]?.notEnoughCoins || 'Not Enough Coins!');
        }
      } else {
        if (piBalance >= 0.0001) {
          piBalance -= 0.0001;
          water += 10;
          updateWallet();
          showTransactionAnimation(`-0.0001 PI`, false, document.querySelector(`.buy-pi-btn[data-id="water"]`));
          playBuyingSound();
          await savePlayerData();
        } else {
          showNotification(langData[currentLang]?.notEnoughPi || 'Not Enough PI!');
        }
      }
      isSaving = false;
      return;
    }
    const veg = vegetables.find(v => v.id === id);
    if (!veg) {
      console.warn(`Vegetable with id ${id} not found`);
      isSaving = false;
      return;
    }
    let canBuy = false;
    if (currency === 'farm') {
      if (farmCoins >= veg.farmPrice) {
        farmCoins -= veg.farmPrice;
        canBuy = true;
        showTransactionAnimation(`-${veg.farmPrice}`, false, document.querySelector(`.buy-btn[data-id="${id}"]`));
      } else {
        showNotification(langData[currentLang]?.notEnoughCoins || 'Not Enough Coins!');
      }
    } else {
      if (piBalance >= veg.piPrice) {
        piBalance -= veg.piPrice;
        canBuy = true;
        showTransactionAnimation(`-${veg.piPrice} PI`, false, document.querySelector(`.buy-pi-btn[data-id="${id}"]`));
      } else {
        showNotification(langData[currentLang]?.notEnoughPi || 'Not Enough PI!');
      }
    }
    if (canBuy) {
      addToInventory('seed', veg, 1);
      updateWallet();
      renderInventory();
      playBuyingSound();
      await savePlayerData();
    }
  } catch (error) {
    console.error('Error in buyVegetable:', error.message);
    showNotification('Error during purchase');
  }
  isSaving = false;
}

// Render inventory
function renderInventory() {
  const inventoryContentElement = document.getElementById('inventory-content');
  if (!inventoryContentElement) {
    console.error('inventory-content element not found');
    showNotification('inventory-content element not found');
    return;
  }
  if (!langData[currentLang]) {
    console.error('Language data not loaded');
    return;
  }
  inventoryContentElement.innerHTML = '';
  let hasItems = false;
  inventory.forEach(item => {
    if (!item || !item.vegetable) return;
    const veg = item.vegetable;
    const invItem = document.createElement('div');
    invItem.classList.add('inventory-item');
    const isSeed = item.type === 'seed';
    const title = isSeed ? `${veg.name[currentLang]} Seed` : veg.name[currentLang];
    invItem.innerHTML = `
      <img src="${veg.shopImage}" alt="${title}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${title}</h3>
      <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
    `;
    inventoryContentElement.appendChild(invItem);
    hasItems = true;
  });
  if (!hasItems) {
    const noItemText = document.createElement('p');
    noItemText.textContent = langData[currentLang]?.noInventory || 'No items in inventory.';
    inventoryContentElement.appendChild(noItemText);
  }
  const sellButton = document.createElement('button');
  sellButton.textContent = langData[currentLang]?.sellToShop || 'Sell to Shop';
  sellButton.classList.add('sell-to-shop-btn');
  addSafeClickListener(sellButton, () => {
    openSellTab();
    playMenuSound();
  });
  inventoryContentElement.appendChild(sellButton);
}

// Render sell section
function renderSellSection() {
  const sellContentElement = document.getElementById('sell-content');
  if (!sellContentElement) {
    console.error('sell-content element not found');
    return;
  }
  if (!langData[currentLang]) {
    console.warn('Language data missing');
    sellContentElement.innerHTML = '<p style="color:red;">Language data not loaded</p>';
    return;
  }
  sellContentElement.innerHTML = '';
  let hasItems = false;
  const groupedHarvest = {};
  inventory.forEach((item, index) => {
    if (item && item.type === 'harvest') {
      const vegId = item.vegetable.id;
      if (!groupedHarvest[vegId]) {
        groupedHarvest[vegId] = { ...item, index: index };
      } else {
        groupedHarvest[vegId].quantity += item.quantity;
      }
    }
  });
  Object.values(groupedHarvest).forEach((item) => {
    const sellDiv = document.createElement('div');
    sellDiv.classList.add('sell-item');
    const sellPrice = item.vegetable.sellPrice;
    const isSellable = typeof sellPrice === 'number';
    if (!isSellable) {
      console.warn(`Missing sellPrice for ${item.vegetable.id}, skipping.`);
      return;
    }
    sellDiv.innerHTML = `
      <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img">
      <h3>${item.vegetable.name[currentLang]}</h3>
      <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
      <p>${langData[currentLang]?.sellPriceLabel || 'Sell Price'}: ${sellPrice} Farm Coins</p>
      <button class="sell-btn" data-index="${item.index}">${langData[currentLang]?.sellLabel || 'Sell'}</button>
    `;
    sellContentElement.appendChild(sellDiv);
    hasItems = true;
  });
  if (!hasItems) {
    sellContentElement.innerHTML = `<p>${langData[currentLang]?.noSellableItems || 'No items to sell.'}</p>`;
  }
  const sellButtons = document.querySelectorAll('.sell-btn');
  if (sellButtons) {
    sellButtons.forEach(btn => {
      addSafeClickListener(btn, () => {
        const index = parseInt(btn.getAttribute('data-index'));
        sellItem(index);
      });
    });
  }
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
  const totalGain = sellPrice * item.quantity;
  farmCoins += totalGain;
  xp += 10;
  const btnElement = document.querySelector(`.sell-btn[data-index="${index}"]`);
  if (btnElement) {
    showTransactionAnimation(`+${totalGain}`, true, btnElement);
  }
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
  const buyTabElement = document.getElementById('shop-buy-tab');
  const sellTabElement = document.getElementById('shop-sell-tab');
  const shopContentElement = document.getElementById('shop-content');
  const sellContentElement = document.getElementById('sell-section');
  if (sellTabElement && buyTabElement && shopContentElement && sellContentElement) {
    sellTabElement.classList.add('active');
    buyTabElement.classList.remove('active');
    shopContentElement.style.display = 'none';
    sellContentElement.style.display = 'block';
    renderSellSection();
  }
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

// Switch tabs
function switchTab(tab) {
  const tabContents = document.querySelectorAll('.tab-content');
  if (tabContents) {
    tabContents.forEach(content => {
      content.classList.remove('active');
    });
  }
  const tabButtons = document.querySelectorAll('.tab-btn');
  if (tabButtons) {
    tabButtons.forEach(btn => {
      btn.classList.remove('active');
    });
  }
  const tabContentElement = document.getElementById(tab);
  const tabBtnElement = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
  if (tabContentElement && tabBtnElement) {
    tabContentElement.classList.add('active');
    tabBtnElement.classList.add('active');
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
let currentExchangeRate = 1000000;
function loadExchangeRate() {
  const rateRef = ref(database, "exchangeRate/liveRate");
  onValue(rateRef, (snapshot) => {
    currentExchangeRate = snapshot.val() || currentExchangeRate;
    const rateEl = document.getElementById("live-rate");
    if (rateEl) rateEl.textContent = `1 Pi = ${currentExchangeRate.toLocaleString()} FC`;
    updateExchangeResult();
  });
}
loadExchangeRate();

function updateExchangeResult() {
  const rawAmount = document.getElementById("exchange-amount").value.replace(",", ".");
  const amount = parseFloat(rawAmount) || 0;
  const direction = document.getElementById("exchange-direction").value;
  const result = (direction === "piToFc")
    ? Math.floor(amount * currentExchangeRate)
    : amount / currentExchangeRate;
  const resultText = `You will get: ${
    direction === "piToFc"
      ? result.toLocaleString()
      : result.toLocaleString(undefined, { maximumFractionDigits: 6 })
  }`;
  const resultDiv = document.getElementById("exchange-result");
  const shortDisplay = resultText.length > 25 ? resultText.substring(0, 25) + "…" : resultText;
  resultDiv.textContent = shortDisplay;
  resultDiv.title = resultText;
}

async function handleExchange() {
  const rawAmount = document.getElementById("exchange-amount").value.replace(",", ".");
  const amount = parseFloat(rawAmount);
  const direction = document.getElementById("exchange-direction").value;
  const playerRef = ref(database, `players/${username}`);
  const snapshot = await get(playerRef);
  const data = snapshot.val();
  if (!data) return showNotification("Player data not found!");
  if (isNaN(amount) || amount <= 0) return showNotification("Invalid amount!");
  let piBalance = Number(data.piBalance || 0);
  let fc = Number(data.farmCoins || 0);
  let resultText = "";
  if (direction === "piToFc") {
    if (piBalance < amount) return showNotification("Not enough Pi!");
    const converted = Math.floor(amount * currentExchangeRate);
    piBalance -= amount;
    fc += converted;
    resultText = converted.toLocaleString();
  } else {
    if (fc < amount) return showNotification("Not enough FC!");
    const converted = amount / currentExchangeRate;
    fc -= amount;
    piBalance += converted;
    resultText = converted.toFixed(6);
  }
  piBalance = Math.round(piBalance * 1000000) / 1000000;
  fc = Math.floor(fc);
  document.getElementById("exchange-loading").style.display = "block";
  setTimeout(() => {
    (async () => {
      try {
        await update(playerRef, {
          piBalance: piBalance,
          farmCoins: fc
        });
        const piElem = document.getElementById("pi-balance");
        const fcElem = document.getElementById("fc-balance");
        if (piElem) piElem.textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
        if (fcElem) fcElem.textContent = fc.toLocaleString();
        document.getElementById("exchange-amount").value = "";
        updateExchangeResult(resultText);
        try {
          await coinSound.play();
        } catch (err) {
          console.error("Error playing sound:", err);
        }
        showNotification("Exchange success!");
      } catch (error) {
        console.error("Exchange failed:", error.message);
        showNotification("Exchange failed: " + error.message);
      } finally {
        document.getElementById("exchange-loading").style.display = "none";
      }
    })();
  }, 3000);
}

const exchangeBtn = document.getElementById("exchange-btn");
const directionSelect = document.getElementById("exchange-direction");
directionSelect.addEventListener("change", () => {
  const direction = directionSelect.value;
  if (direction === "piToFc") {
    exchangeBtn.textContent = "Exchange to FC";
  } else {
    exchangeBtn.textContent = "Exchange to Pi";
  }
});
directionSelect.dispatchEvent(new Event("change"));

// Modal untuk daily reward
if (claimModalBtn) {
  addSafeClickListener(document.getElementById('claim-reward-btn'), async () => {
    const playerRef = ref(database, `players/${username}/lastClaim`);
    try {
      const snapshot = await get(playerRef);
      lastClaim = snapshot.val();
      const today = new Date().toISOString().split('T')[0];
      const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;
      if (lastClaimDate === today) {
        const claimRewardBtnElement = document.getElementById('claim-reward-btn');
        if (claimRewardBtnElement) {
          claimRewardBtnElement.classList.add('claimed');
          claimRewardBtnElement.textContent = langData[currentLang]?.claimed || 'Claimed!';
          claimRewardBtnElement.disabled = true;
        }
        claimedToday = true;
        return;
      }
      if (isClaiming) return;
      isClaiming = true;
      if (rewardModal) rewardModal.style.display = 'block';
      const dailyRewardTextElement = document.getElementById('daily-reward-text');
      if (dailyRewardTextElement) {
        dailyRewardTextElement.textContent = `${langData[currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!'}`;
      }
    } catch (error) {
      console.error('Error checking last claim:', error.message);
      showNotification('Error checking daily reward.');
      isClaiming = false;
    }
  });
}

// Claim daily reward
if (claimModalBtn) {
  addSafeClickListener(claimModalBtn, async () => {
    if (!username) return;
    farmCoins += 100;
    water += 50;
    xp += 10;
    const today = new Date().toISOString();
    lastClaim = today;
    claimedToday = true;
    const playerRef = ref(database, `players/${username}`);
    try {
      await update(playerRef, { farmCoins, water, xp, lastClaim, claimedToday });
      updateWallet();
      if (rewardModal) rewardModal.style.display = 'none';
      const claimRewardBtnElement = document.getElementById('claim-reward-btn');
      if (claimRewardBtnElement) {
        claimRewardBtnElement.classList.add('claimed');
        claimRewardBtnElement.textContent = langData[currentLang]?.claimed || 'Claimed!';
        claimRewardBtnElement.disabled = true;
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
  });
}

// Check daily reward
function checkDailyReward() {
  if (!username) return;
  const today = new Date().toISOString().split('T')[0];
  const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;
  const claimRewardBtnElement = document.getElementById('claim-reward-btn');
  if (claimRewardBtnElement) {
    if (lastClaimDate === today) {
      claimRewardBtnElement.classList.add('claimed');
      claimRewardBtnElement.textContent = langData[currentLang]?.claimed || 'Claimed!';
      claimRewardBtnElement.disabled = true;
      claimedToday = true;
    } else {
      claimRewardBtnElement.classList.remove('claimed');
      claimRewardBtnElement.textContent = langData[currentLang]?.claimDailyReward || 'Claim Daily Reward';
      claimRewardBtnElement.disabled = false;
      claimedToday = false;
    }
  }
}

// Save player data to Firebase
async function savePlayerData() {
  if (!username || !isDataLoaded) return;
  const playerRef = ref(database, `players/${username}`);
  const dataToSave = {
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
    claimedToday
  };
  try {
    await update(playerRef, dataToSave);
    console.log('Player data saved');
  } catch (error) {
    console.error('Error saving player data:', error.message);
    showNotification('Error saving data');
  }
}

// Update wallet UI
function updateWallet() {
  const farmCoinsElement = document.getElementById('farm-coins');
  const piCoinsElement = document.getElementById('pi-coins');
  const waterElement = document.getElementById('water');
  const levelElement = document.getElementById('level');
  const xpFillElement = document.getElementById('xp-fill');
  const farmCoinBalanceElement = document.getElementById('farm-coin-balance');
  const piCoinBalanceElement = document.getElementById('pi-coin-balance');
  if (farmCoinsElement) {
    farmCoinsElement.textContent = `${farmCoins} Farm Coins`;
  }
  if (piCoinsElement) {
    piCoinsElement.textContent = `${piBalance.toFixed(6)} PI`;
  }
  if (waterElement) {
    waterElement.textContent = `${water} Water`;
  }
  if (levelElement) {
    levelElement.textContent = `Level: ${level} | XP: ${xp}`;
  }
  if (xpFillElement) {
    const xpPercentage = (xp / (level * 100)) * 100;
    xpFillElement.style.width = `${xpPercentage}%`;
  }
  if (farmCoinBalanceElement) {
    farmCoinBalanceElement.textContent = farmCoins;
  }
  if (piCoinBalanceElement) {
    piCoinBalanceElement.textContent = piBalance.toFixed(6);
  }
  savePlayerData();
}

// Handle deposit
const realDepositBtn = document.getElementById("real-deposit-btn");
const realDepositMsg = document.getElementById("real-deposit-msg");
const depositAmountInput = document.getElementById("deposit-amount");
const depositPopup = document.getElementById("deposit-popup");
const popupAmount = document.getElementById("popup-amount");
const popupMemo = document.getElementById("popup-memo");
const popupUsername = document.getElementById("popup-username");
const popupTransferAmount = document.getElementById("popup-transfer-amount");
const popupTransferMemo = document.getElementById("popup-transfer-memo");
const popupWalletAddress = document.getElementById("popup-wallet-address");
const countdownTimer = document.getElementById("countdown-timer");
const copyWalletBtn = document.getElementById("copy-wallet-btn");
const copyMemoBtn = document.getElementById("copy-memo-btn");
const confirmDepositBtn = document.getElementById("confirm-deposit");
const cancelDepositBtn = document.getElementById("cancel-deposit");

if (realDepositBtn) {
  addSafeClickListener(realDepositBtn, async () => {
    console.log('Tombol deposit diklik');
    if (!username) {
      realDepositMsg.textContent = 'Please login first.';
      console.log('Validasi gagal: User belum login');
      return;
    }
    const amount = parseFloat(depositAmountInput.value);
    if (!amount || amount < 1) {
      realDepositMsg.textContent = 'Minimum deposit is 1 PI.';
      console.log('Validasi gagal: Jumlah deposit invalid');
      return;
    }
    try {
      const memo = `Deposit_${username}_${Date.now()}`;
      const walletAddress = 'GCUPGJNSX6GQDI7MTNBVES6LHDCTP3QHZHPWJG4BKBQVG4L2CW6ZULPN'; // Ganti dengan wallet address asli
      const timeLimit = 100; // Detik
      let timeLeft = timeLimit;

      popupAmount.textContent = amount;
      popupMemo.textContent = memo;
      popupUsername.textContent = username;
      popupTransferAmount.textContent = amount;
      popupTransferMemo.textContent = memo;
      popupWalletAddress.textContent = walletAddress;
      countdownTimer.textContent = timeLeft;

      depositPopup.style.display = 'block';
      realDepositMsg.textContent = '';

      const countdownInterval = setInterval(() => {
        timeLeft--;
        countdownTimer.textContent = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          depositPopup.style.display = 'none';
          realDepositMsg.textContent = 'Deposit time expired.';
        }
      }, 1000);

      addSafeClickListener(cancelDepositBtn, () => {
        clearInterval(countdownInterval);
        depositPopup.style.display = 'none';
        realDepositMsg.textContent = 'Deposit cancelled.';
        playMenuSound();
      });

      addSafeClickListener(copyWalletBtn, () => {
        copyToClipboard(walletAddress, copyWalletBtn);
        showNotification('Wallet address copied!');
      });

      addSafeClickListener(copyMemoBtn, () => {
        copyToClipboard(memo, copyMemoBtn);
        showNotification('Memo copied!');
      });

      addSafeClickListener(confirmDepositBtn, async () => {
        clearInterval(countdownInterval);
        depositPopup.style.display = 'none';
        try {
          const playerRef = ref(database, `players/${username}`);
          const snapshot = await get(playerRef);
          const playerData = snapshot.val();
          const currentTotalDeposit = playerData.totalDeposit || 0;
          piBalance += amount;
          const newTotalDeposit = currentTotalDeposit + amount;
          await update(playerRef, {
            piBalance,
            totalDeposit: newTotalDeposit
          });
          const depositHistoryRef = ref(database, `depositHistory/${username}`);
          await push(depositHistoryRef, {
            amount,
            memo,
            timestamp: Date.now(),
            status: 'completed'
          });
          updateWallet();
          realDepositMsg.textContent = `Successfully deposited ${amount} PI!`;
          showNotification(`Deposited ${amount} PI!`);
          playCoinSound();
        } catch (error) {
          console.error('Deposit error:', error.message);
          realDepositMsg.textContent = 'Deposit failed: ' + error.message;
          showNotification('Deposit failed.');
        }
      });
    } catch (error) {
      console.error('Deposit setup error:', error.message);
      realDepositMsg.textContent = 'Error setting up deposit.';
    }
  });
}

// Handle withdraw
const withdrawBtn = document.getElementById("withdraw-btn");
const realWithdrawMsg = document.getElementById("real-withdraw-msg");
const withdrawAmountInput = document.getElementById("withdraw-amount");
const withdrawWalletInput = document.getElementById("withdraw-wallet-input");
const withdrawPopup = document.getElementById("withdraw-popup");
const withdrawPopupAmount = document.getElementById("withdraw-popup-amount");
const withdrawPopupUsername = document.getElementById("withdraw-popup-username");
const withdrawPopupWallet = document.getElementById("withdraw-popup-wallet");
const withdrawCountdownTimer = document.getElementById("withdraw-countdown-timer");
const confirmWithdrawBtn = document.getElementById("confirm-withdraw");
const cancelWithdrawBtn = document.getElementById("cancel-withdraw");

if (withdrawBtn) {
  addSafeClickListener(withdrawBtn, async () => {
    console.log('Tombol withdraw diklik');
    if (!username) {
      realWithdrawMsg.textContent = 'Please login first.';
      return;
    }
    const amount = parseFloat(withdrawAmountInput.value);
    const walletAddress = withdrawWalletInput.value.trim();
    if (!amount || amount <= 0) {
      realWithdrawMsg.textContent = 'Please enter a valid amount.';
      return;
    }
    if (!walletAddress) {
      realWithdrawMsg.textContent = 'Please enter a wallet address.';
      return;
    }
    const playerRef = ref(database, `players/${username}`);
    const snapshot = await get(playerRef);
    const playerData = snapshot.val();
    if (!playerData) {
      realWithdrawMsg.textContent = 'Player data not found.';
      return;
    }
    const totalDeposit = playerData.totalDeposit || 0;
    if (level < 10 || farmCoins < 10000000 || totalDeposit < 10) {
      realWithdrawMsg.textContent = 'Withdraw requirements not met.';
      return;
    }
    if (piBalance < amount) {
      realWithdrawMsg.textContent = 'Insufficient PI balance.';
      return;
    }
    try {
      const timeLimit = 100; // Detik
      let timeLeft = timeLimit;

      withdrawPopupAmount.textContent = amount;
      withdrawPopupUsername.textContent = username;
      withdrawPopupWallet.textContent = walletAddress;
      withdrawCountdownTimer.textContent = timeLeft;

      withdrawPopup.style.display = 'block';
      realWithdrawMsg.textContent = '';

      const countdownInterval = setInterval(() => {
        timeLeft--;
        withdrawCountdownTimer.textContent = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(countdownInterval);
          withdrawPopup.style.display = 'none';
          realWithdrawMsg.textContent = 'Withdraw time expired.';
        }
      }, 1000);

      addSafeClickListener(cancelWithdrawBtn, () => {
        clearInterval(countdownInterval);
        withdrawPopup.style.display = 'none';
        realWithdrawMsg.textContent = 'Withdraw cancelled.';
        playMenuSound();
      });

      addSafeClickListener(confirmWithdrawBtn, async () => {
        clearInterval(countdownInterval);
        withdrawPopup.style.display = 'none';
        try {
          piBalance -= amount;
          await update(playerRef, { piBalance });
          const withdrawHistoryRef = ref(database, `depositHistory/${username}`);
          await push(withdrawHistoryRef, {
            amount: -amount,
            walletAddress,
            timestamp: Date.now(),
            status: 'completed'
          });
          updateWallet();
          realWithdrawMsg.textContent = `Successfully withdrew ${amount} PI!`;
          showNotification(`Withdrew ${amount} PI!`);
          playCoinSound();
        } catch (error) {
          console.error('Withdraw error:', error.message);
          realWithdrawMsg.textContent = 'Withdraw failed: ' + error.message;
          showNotification('Withdraw failed.');
        }
      });
    } catch (error) {
      console.error('Withdraw setup error:', error.message);
      realWithdrawMsg.textContent = 'Error setting up withdraw.';
    }
  });
}

// Copy to clipboard
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    if (button) {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => {
        button.textContent = originalText;
      }, 2000);
    }
  }).catch(err => {
    console.error('Failed to copy:', err);
    showNotification('Failed to copy to clipboard.');
  });
}

// Show transaction animation
function showTransactionAnimation(amountText, isPositive, sourceElement) {
  const animation = document.createElement('div');
  animation.textContent = amountText;
  animation.classList.add('amount-text', isPositive ? 'positive' : 'negative');
  document.body.appendChild(animation);
  const rect = sourceElement ? sourceElement.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
  animation.style.left = `${rect.left + rect.width / 2}px`;
  animation.style.top = `${rect.top}px`;
  setTimeout(() => {
    animation.remove();
  }, 800);
}

// Show notification
function showNotification(message) {
  const notificationElement = document.getElementById('notification');
  if (notificationElement) {
    notificationElement.textContent = message;
    notificationElement.style.display = 'block';
    setTimeout(() => {
      notificationElement.style.display = 'none';
    }, 3000);
  } else {
    console.warn('Notification element not found');
  }
}

// Update UI text
function updateUIText() {
  const titleElement = document.getElementById('title');
  const startTextElement = document.getElementById('start-text');
  const gameTitleElement = document.getElementById('game-title');
  const claimRewardBtnElement = document.getElementById('claim-reward-btn');
  const dailyRewardTitleElement = document.getElementById('daily-reward-text');
  const settingsTitleElement = document.getElementById('settings-title');
  const musicVolumeLabelElement = document.getElementById('music-volume-label');
  const voiceVolumeLabelElement = document.getElementById('voice-volume-label');
  const shopBuyTabElement = document.getElementById('shop-buy-tab');
  const shopSellTabElement = document.getElementById('shop-sell-tab');
  const sellSectionTitleElement = document.getElementById('sell-section-title');
  const financeTitleElement = document.getElementById('finance-title');
  const withdrawNoteElement = document.getElementById('withdraw-note');
  const leaderboardTitleElement = document.getElementById('leaderboard-title');
  const upgradesTitleElement = document.getElementById('upgrades-title');
  const referralTitleElement = document.getElementById('referral-title');

  if (titleElement) titleElement.textContent = langData[currentLang]?.title || 'Harvest Pi';
  if (startTextElement) startTextElement.textContent = langData[currentLang]?.startGame || 'Start Game';
  if (gameTitleElement) gameTitleElement.textContent = langData[currentLang]?.title || 'Harvest Pi';
  if (claimRewardBtnElement && !claimedToday) {
    claimRewardBtnElement.textContent = langData[currentLang]?.claimDailyReward || 'Claim Daily Reward';
  }
  if (dailyRewardTitleElement) {
    dailyRewardTitleElement.textContent = langData[currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!';
  }
  if (settingsTitleElement) settingsTitleElement.textContent = langData[currentLang]?.settings || 'Settings';
  if (musicVolumeLabelElement) musicVolumeLabelElement.textContent = langData[currentLang]?.musicVolume || 'Music Volume:';
  if (voiceVolumeLabelElement) voiceVolumeLabelElement.textContent = langData[currentLang]?.voiceVolume || 'Voice/SFX Volume:';
  if (shopBuyTabElement) shopBuyTabElement.textContent = langData[currentLang]?.buyLabel || 'Buy';
  if (shopSellTabElement) shopSellTabElement.textContent = langData[currentLang]?.sellLabel || 'Sell';
  if (sellSectionTitleElement) sellSectionTitleElement.textContent = langData[currentLang]?.sellSectionTitle || 'Sell Items';
  if (financeTitleElement) financeTitleElement.textContent = langData[currentLang]?.finance || 'Finance';
  if (withdrawNoteElement) {
    withdrawNoteElement.innerHTML = langData[currentLang]?.withdrawNote || 'This feature will unlock when you reach: <br>- Level 10<br>- Farm Coin ≥ 10.000.000<br>- Total Deposit ≥ 10 PI';
  }
  if (leaderboardTitleElement) leaderboardTitleElement.textContent = langData[currentLang]?.leaderboard || 'Leaderboard';
  if (upgradesTitleElement) upgradesTitleElement.textContent = langData[currentLang]?.upgrades || 'Upgrades';
  if (referralTitleElement) referralTitleElement.textContent = langData[currentLang]?.referral || 'Referral Program';
}

// Toggle language
function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'id' : 'en';
  localStorage.setItem('language', currentLang);
  console.log('Language toggled to:', currentLang);
  updateUIText();
  renderShop();
  renderSellSection();
  renderInventory();
  renderAchievements();
  checkDailyReward();
}

// Fullscreen functions
function enterFullScreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
  }
}

function exitFullScreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen().catch(err => console.error('Exit fullscreen error:', err));
  }
}

// Start game
function startGame() {
  if (!isDataLoaded) {
    showNotification(langData[currentLang]?.loadingData || 'Loading data, please wait...');
    return;
  }
  const startScreenElement = document.getElementById('start-screen');
  const gameScreenElement = document.getElementById('game-screen');
  if (startScreenElement && gameScreenElement) {
    startScreenElement.style.display = 'none';
    gameScreenElement.style.display = 'block';
    playBgMusic();
    playBgVoice();
  }
  updateWallet();
  initializePlots();
  renderShop();
  renderInventory();
  renderSellSection();
  renderAchievements();
  checkDailyReward();
}

// Initialize game
async function initializeGame() {
  const savedLang = localStorage.getItem('language') || 'en';
  currentLang = ['en', 'id'].includes(savedLang) ? savedLang : 'en';
  console.log('Initializing game with language:', currentLang);
  await loadData();
  updateUIText();
  const loadingScreenElement = document.getElementById('loading-screen');
  const loginScreenElement = document.getElementById('login-screen');
  if (loadingScreenElement && loginScreenElement) {
    loadingScreenElement.classList.remove('active');
    loginScreenElement.classList.add('active');
    loginScreenElement.style.display = 'flex';
  }
}

// Check coin achievement
function checkCoinAchievement() {
  if (farmCoins >= 10000 && !achievements.coins) {
    achievements.coins = true;
    farmCoins += 500;
    xp += 50;
    showNotification(langData[currentLang]?.coinAchievement || 'Achievement Unlocked: Coin Collector! +500 Farm Coins & +50 XP');
    savePlayerData();
    updateWallet();
    renderAchievements();
    checkLevelUp();
  }
}

// Check harvest achievement
function checkHarvestAchievement() {
  if (harvestCount >= 10 && !achievements.harvest) {
    achievements.harvest = true;
    farmCoins += 1000;
    xp += 100;
    showNotification(langData[currentLang]?.harvestAchievement || 'Achievement Unlocked: Master Farmer! +1000 Farm Coins & +100 XP');
    savePlayerData();
    updateWallet();
    renderAchievements();
    checkLevelUp();
  }
}

// Render achievements
function renderAchievements() {
  const achievementsContentElement = document.getElementById('achievements-content');
  if (!achievementsContentElement) {
    console.error('achievements-content element not found');
    return;
  }
  if (!langData[currentLang]) {
    console.warn('Language data missing');
    return;
  }
  achievementsContentElement.innerHTML = '';
  const harvestAchievement = document.createElement('div');
  harvestAchievement.classList.add('achievement-item');
  harvestAchievement.innerHTML = `
    <h3>${langData[currentLang]?.harvestAchievementTitle || 'Master Farmer'}</h3>
    <p>${langData[currentLang]?.harvestAchievementDesc || 'Harvest 10 crops'}</p>
    <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.harvest ? (langData[currentLang]?.unlocked || 'Unlocked') : (langData[currentLang]?.locked || 'Locked')}</p>
  `;
  achievementsContentElement.appendChild(harvestAchievement);
  const coinAchievement = document.createElement('div');
  coinAchievement.classList.add('achievement-item');
  coinAchievement.innerHTML = `
    <h3>${langData[currentLang]?.coinAchievementTitle || 'Coin Collector'}</h3>
    <p>${langData[currentLang]?.coinAchievementDesc || 'Earn 10,000 Farm Coins'}</p>
    <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.coins ? (langData[currentLang]?.unlocked || 'Unlocked') : (langData[currentLang]?.locked || 'Locked')}</p>
  `;
  achievementsContentElement.appendChild(coinAchievement);
}
