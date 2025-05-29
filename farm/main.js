//PART 1 //
import { auth, database, ref, onValue, set, update, get, push } from '../firebase/firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { showNotification, updateWallet } from './ui.js';

let username = localStorage.getItem('username');

function encodeEmail(email) {
  return email.replace('@', '_at_').replace(/\./g, '_dot_');
}

function resolveUserKey(role, email, username) {
  return role === 'admin' ? encodeEmail(email) : username;
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email-input').value.trim();
  const password = document.getElementById('password-input').value.trim();
  const loginError = document.getElementById('login-error');
  const verifyEmailMsg = document.getElementById('verify-status');

  if (!email || !password) {
    loginError.textContent = 'Please enter email and password.';
    loginError.style.display = 'block';
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (!user.emailVerified) {
      await sendEmailVerification(user);
      loginError.textContent = 'Please verify your email.';
      loginError.style.display = 'block';
      verifyEmailMsg.style.display = 'block';
      return;
    }

    const playersSnapshot = await get(ref(database, 'players'));
    const players = playersSnapshot.val() || {};
    let foundUsername = null;
    for (const key in players) {
      if (players[key].email === email) {
        foundUsername = key;
        break;
      }
    }

    if (!foundUsername) throw new Error('User not found in players database.');

    const playerData = players[foundUsername];
    if (!playerData) throw new Error('Player data missing.');
    if (playerData.status !== 'approved') {
      throw new Error(`Account ${playerData.status}. Contact admin.`);
    }

    const role = playerData.role || 'user';
    const encodedEmail = encodeEmail(email);
    const userKey = resolveUserKey(role, email, foundUsername);

    username = foundUsername;
    localStorage.setItem('username', username);
    localStorage.setItem('email', email);
    localStorage.setItem('role', role);
    localStorage.setItem('encodedEmail', encodedEmail);
    localStorage.setItem('userKey', userKey);

    onValue(ref(database, `notifications/${userKey}`), (snapshot) => {
      const data = snapshot.val();
      if (data) {
        for (const id in data) {
          if (!data[id].read) {
            showNotification(data[id].message);
            update(ref(database, `notifications/${userKey}/${id}`), { read: true });
          }
        }
      }
    });

    showNotification('Logged in as ' + email);

    if (role === 'admin') {
      window.location.href = 'admin/admin.html';
    } else {
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('start-screen').style.display = 'flex';
    }

    loadPlayerData(userKey);
  } catch (error) {
    console.error('Login error:', error.message);
    loginError.textContent = error.message;
    loginError.style.display = 'block';
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('register-email-input').value;
  const password = document.getElementById('register-password-input').value;
  const inputUsername = document.getElementById('register-username-input').value;
  const registerError = document.getElementById('register-error');

  if (!email || !password || !inputUsername) {
    registerError.style.display = 'block';
    registerError.textContent = 'Please enter email, password, and username.';
    return;
  }

  try {
    const normalizedUsername = inputUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!normalizedUsername || normalizedUsername.length < 3) {
      throw new Error('Username must be at least 3 characters and use letters/numbers only.');
    }

    const playerRef = ref(database, `players/${normalizedUsername}`);
    const snapshot = await get(playerRef);
    if (snapshot.exists()) {
      throw new Error('Username already taken.');
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await set(playerRef, {
      email,
      username: normalizedUsername,
      role: 'user',
      status: 'pending',
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
      referralEarnings: 0
    });

    await sendEmailVerification(user);
    registerError.style.display = 'block';
    registerError.textContent = 'Registration successful! Please verify your email.';
    showNotification('Registration successful! Check your email for verification.');
    document.getElementById('register-email-input').value = '';
    document.getElementById('register-password-input').value = '';
    document.getElementById('register-username-input').value = '';
    switchToLogin();
  } catch (error) {
    registerError.style.display = 'block';
    registerError.textContent = 'Registration failed: ' + error.message;
    console.error('Registration error:', error.message);
  }
}

function switchToLogin() {
  const loginScreen = document.getElementById('login-screen');
  const registerScreen = document.getElementById('register-screen');
  if (loginScreen && registerScreen) {
    loginScreen.style.display = 'flex';
    registerScreen.style.display = 'none';
  }
}

function switchToRegister() {
  const loginScreen = document.getElementById('login-screen');
  const registerScreen = document.getElementById('register-screen');
  if (loginScreen && registerScreen) {
    loginScreen.style.display = 'none';
    registerScreen.style.display = 'flex';
  }
}

function handleReferral() {
  const urlParams = new URLSearchParams(window.location.search);
  const referralUsername = urlParams.get('ref');
  if (referralUsername && username && referralUsername !== username) {
    const referrerRef = ref(database, `players/${referralUsername}`);
    get(referrerRef).then((snapshot) => {
      if (snapshot.exists()) {
        const referrerData = snapshot.val();
        const newReferralEarnings = (referrerData.referralEarnings || 0) + 100;
        update(referrerRef, { referralEarnings: newReferralEarnings })
          .then(() => showNotification('Referral bonus given to referrer!'))
          .catch(err => console.error('Error updating referral earnings:', err));
      }
    }).catch(err => console.error('Error fetching referrer data:', err));
  }
}

function loadPlayerData(userKey) {
  if (!userKey) {
    showNotification('Login required.');
    return;
  }

  const playerRef = ref(database, `players/${userKey}`);
  onValue(playerRef, (snapshot) => {
    const data = snapshot.val();
    if (!data) {
      const role = localStorage.getItem('role');
      if (role === 'admin') {
        console.warn('Skip initializing admin data');
        return;
      }

      const init = {
        farmCoins: 0,
        piBalance: 0,
        water: 0,
        level: 1,
        xp: 0,
        inventory: [],
        farmPlots: [],
        harvestCount: 0,
        achievements: { harvest: false, coins: false },
        totalDeposit: 0,
        claimedToday: false,
        referralEarnings: 0,
        email: localStorage.getItem('email'),
        username: localStorage.getItem('username'),
        status: 'approved',
        role: 'user'
      };
      set(playerRef, init).then(() => console.log('Initialized new user data:', userKey))
        .catch(err => showNotification('Failed to init data'));
      return;
    }

    window.farmCoins = data.farmCoins || 0;
    window.piBalance = data.piBalance || 0;
    window.water = data.water || 0;
    window.level = data.level || 1;
    window.xp = data.xp || 0;
    window.inventory = data.inventory || [];
    window.farmPlots = data.farmPlots || [];
    window.harvestCount = data.harvestCount || 0;
    window.achievements = data.achievements || { harvest: false, coins: false };
    window.referralEarnings = data.referralEarnings || 0;
    window.isDataLoaded = true;

    updateWallet();
  });
}

export { handleLogin, handleRegister, switchToLogin, switchToRegister, handleReferral, loadPlayerData, encodeEmail };

// PART 2 //
import { addSafeClickListener } from './utils.js';

const bgMusic = document.getElementById('bg-music');
const bgVoice = document.getElementById('bg-voice');
const harvestingSound = document.getElementById('harvesting-sound');
const wateringSound = document.getElementById('watering-sound');
const plantingSound = document.getElementById('planting-sound');
const menuSound = document.getElementById('menu-sound');
const buyingSound = document.getElementById('buying-sound');
const coinSound = document.getElementById('coin-sound');

function playBgMusic() {
  if (bgMusic && !window.isAudioPlaying) {
    bgMusic.play().then(() => {
      console.log('Background music started');
      window.isAudioPlaying = true;
    }).catch(e => {
      console.log('BG Music failed:', e.message);
      setTimeout(() => bgMusic.play().catch(err => console.log('Retry BG Music failed:', err.message)), 100);
    });
  }
}

function playBgVoice() {
  if (bgVoice && !window.isAudioPlaying) {
    bgVoice.play().then(() => console.log('Background voice started'))
      .catch(e => {
        console.log('BG Voice failed:', e.message);
        setTimeout(() => bgVoice.play().catch(err => console.log('Retry BG Voice failed:', err.message)), 100);
      });
  }
}

function playSound(sound) {
  if (sound) {
    sound.play().catch(e => console.log(`${sound.id} failed:`, e.message));
  }
}

function updateVolumes() {
  const musicVolume = parseFloat(localStorage.getItem('musicVolume') ?? 50) / 100;
  const voiceVolume = parseFloat(localStorage.getItem('voiceVolume') ?? 50) / 100;

  if (bgMusic) bgMusic.volume = musicVolume;
  if (bgVoice) bgVoice.volume = voiceVolume;
  if (harvestingSound) harvestingSound.volume = voiceVolume;
  if (wateringSound) wateringSound.volume = voiceVolume;
  if (plantingSound) plantingSound.volume = voiceVolume;
  if (menuSound) menuSound.volume = voiceVolume;
  if (buyingSound) buyingSound.volume = voiceVolume;
  if (coinSound) coinSound.volume = voiceVolume;

  console.log('Updated Volumes:', { musicVolume, voiceVolume });
}

function initAudioControls() {
  const musicVolumeSlider = document.getElementById('music-volume');
  const voiceVolumeSlider = document.getElementById('voice-volume');

  if (musicVolumeSlider) {
    musicVolumeSlider.value = localStorage.getItem('musicVolume') || 50;
    musicVolumeSlider.addEventListener('input', () => {
      localStorage.setItem('musicVolume', musicVolumeSlider.value);
      updateVolumes();
    });
  }

  if (voiceVolumeSlider) {
    voiceVolumeSlider.value = localStorage.getItem('voiceVolume') || 50;
    voiceVolumeSlider.addEventListener('input', () => {
      localStorage.setItem('voiceVolume', voiceVolumeSlider.value);
      updateVolumes();
    });
  }

  updateVolumes();
}

export { playBgMusic, playBgVoice, playSound, initAudioControls, harvestingSound, wateringSound, plantingSound, menuSound, buyingSound, coinSound };

// PART 3 //
import { renderShop, renderSellSection } from './shop.js';
import { renderInventory } from './inventory.js';
import { renderAchievements } from './achievements.js';
import { checkDailyReward } from './achievements.js';
import { addSafeClickListener } from './utils.js';
import { database, ref, onValue, update } from '../firebase/firebase-config.js';

function showNotification(message) {
  const notification = document.getElementById('notification');
  if (notification) {
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 3000);
  }
}

function updateWallet() {
  const farmCoinsElement = document.getElementById('farm-coins');
  const piCoinsElement = document.getElementById('pi-coins');
  const waterElement = document.getElementById('water');
  const levelElement = document.getElementById('level');
  const xpFillElement = document.getElementById('xp-fill');
  const farmCoinBalanceElement = document.getElementById('farm-coin-balance');
  const piCoinBalanceElement = document.getElementById('pi-coin-balance');

  if (farmCoinsElement) farmCoinsElement.textContent = `${window.farmCoins} Farm Coins`;
  if (piCoinsElement) piCoinsElement.textContent = `${window.piBalance.toFixed(6)} PI`;
  if (waterElement) waterElement.textContent = `${window.water} Water`;
  if (levelElement) levelElement.textContent = `Level: ${window.level} | XP: ${window.xp}`;
  if (xpFillElement) xpFillElement.style.width = `${(window.xp / (window.level * 100)) * 100}%`;
  if (farmCoinBalanceElement) farmCoinBalanceElement.textContent = window.farmCoins;
  if (piCoinBalanceElement) piCoinBalanceElement.textContent = window.piBalance.toFixed(6);

  savePlayerData();
}

async function savePlayerData() {
  if (!window.username || !window.isDataLoaded) return;
  const playerRef = ref(database, `players/${window.username}`);
  const data = {
    farmCoins: window.farmCoins,
    piBalance: window.piBalance,
    water: window.water,
    level: window.level,
    xp: window.xp,
    inventory: window.inventory,
    farmPlots: window.farmPlots,
    harvestCount: window.harvestCount,
    achievements: window.achievements,
    lastClaim: window.lastClaim,
    claimedToday: window.claimedToday
  };
  try {
    await update(playerRef, data);
    console.log('Player data saved');
  } catch (error) {
    console.error('Error saving player data:', error.message);
    showNotification('Error saving data');
  }
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

  import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
}

function updateUIText() {
  if (!window.langData[window.currentLang]) return;
  const elements = {
    'title': 'title',
    'game-title': 'title',
    'start-text': 'startGame',
    '.tab-btn[data-tab="farm"]': 'farmTab',
    '.tab-btn[data-tab="shop"]': 'shopTab',
    '.tab-btn[data-tab="upgrades"]': 'upgradesTab',
    '.tab-btn[data-tab="inventory"]': 'inventoryTab',
    '.tab-btn[data-tab="exchange"]': 'exchangeTab',
    '.tab-btn[data-tab="finance"]': 'financeTab',
    '.tab-btn[data-tab="leaderboard"]': 'leaderboardTab',
    '.tab-btn[data-tab="achievements"]': 'achievementsTab',
    'lang-toggle': 'switchLang',
    'game-lang-toggle': 'switchLang',
    'upgrades-title': 'upgradesTitle',
    'upgrades-content': 'comingSoon',
    'exchange-title': 'exchangeTitle',
    'exchange-rate': 'exchangeRate',
    'exchange-amount': 'enterPiAmount',
    'exchange-result-label': 'farmCoinsLabel',
    'exchange-btn': 'exchangeButton',
    'leaderboard-title': 'leaderboardTitle',
    'leaderboard-content': 'comingSoon',
    'settings-title': 'settingsTitle',
    'music-volume-label': 'musicVolumeLabel',
    'voice-volume-label': 'voiceVolumeLabel',
    'exit-game-btn': 'exitGame',
    'daily-reward-title': 'dailyRewardTitle',
    'claim-modal-btn': 'claimButton',
    'shop-buy-tab': 'buyTab',
    'shop-sell-tab': 'sellTab',
    'sell-section-title': 'sellSectionTitle',
    'finance-title': 'financeTitle'
  };

  Object.entries(elements).forEach(([selector, key]) => {
    const el = selector.startsWith('.') ? document.querySelector(selector) : document.getElementById(selector);
    if (el) {
      if (selector === 'exchange-amount') {
        el.placeholder = window.langData[window.currentLang][key] || key;
      } else {
        el.textContent = window.langData[window.currentLang][key] || key;
      }
    }
  });

  updateWallet();
  renderShop();
  renderInventory();
  renderSellSection();
  renderAchievements();
  checkDailyReward();
}

function toggleLanguage() {
  window.currentLang = window.currentLang === 'en' ? 'id' : 'en';
  localStorage.setItem('language', window.currentLang);
  updateUIText();
}

export { showNotification, updateWallet, savePlayerData, switchTab, updateUIText, toggleLanguage };

// PART 4 //
import { loadData } from './utils.js';
import { switchToLogin } from './auth.js';
import { playBgMusic, playBgVoice } from './audio.js';
import { switchTab } from './ui.js';

async function initializeGame() {
  try {
    await loadData();
    import('./ui.js').then(({ updateUIText }) => updateUIText());
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      const loginScreen = document.getElementById('login-screen');
      if (loadingScreen && loginScreen) {
        loadingScreen.style.display = 'none';
        switchToLogin();
      }
    }, 1000);
  } catch (error) {
    console.error('Error initializing game:', error.message);
    import('./ui.js').then(({ showNotification }) => showNotification('Error initializing game. Please reload.'));
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      const loginScreen = document.getElementById('login-screen');
      if (loadingScreen && loginScreen) {
        loadingScreen.style.display = 'none';
        switchToLogin();
      }
    }, 1000);
  }
}

function startGame() {
  if (!window.username) {
    console.warn('Please login first!');
    return;
  }
  const startScreen = document.getElementById('start-screen');
  const gameScreen = document.getElementById('game-screen');
  const exitGameBtn = document.getElementById('exit-game-btn');
  if (startScreen && gameScreen && exitGameBtn) {
    startScreen.style.display = 'none';
    startScreen.classList.remove('center-screen');
    gameScreen.style.display = 'flex';
    gameScreen.classList.add('fade-in');
    exitGameBtn.style.display = 'block';
  }
  window.isAudioPlaying = false;
  playBgMusic();
  playBgVoice();
  switchTab('farm');
  enterFullScreen();
}

function enterFullScreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) elem.requestFullscreen();
  else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
  else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
  else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
}

function exitFullScreen() {
  if (document.exitFullscreen) document.exitFullscreen();
  else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  else if (document.msExitFullscreen) document.msExitFullscreen();
}

export { initializeGame, startGame, enterFullScreen, exitFullScreen };

// PART 5 //
import { addSafeClickListener } from './utils.js';
import { updateWallet, showNotification } from './ui.js';
import { playSound, harvestingSound, wateringSound, plantingSound } from './audio.js';
import { addToInventory, renderInventory, renderSellSection } from './inventory.js';
import { checkHarvestAchievement } from './achievements.js';

function initializePlots() {
  const farmArea = document.getElementById('farm-area');
  if (!farmArea) {
    showNotification('farm-area element not found');
    return;
  }

  farmArea.innerHTML = '';
  if (!window.farmPlots || window.farmPlots.length === 0) {
    window.farmPlots = Array(4).fill().map(() => ({
      planted: false,
      vegetable: null,
      progress: 0,
      watered: false,
      currentFrame: 1,
      countdown: 0,
      totalCountdown: 0
    }));
  }

  window.farmPlots.forEach((plot, i) => {
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
    plotStatus.innerHTML = window.langData[window.currentLang]?.readyToHarvest || 'Ready to Harvest';
    countdownFill.style.width = '100%';
  } else if (plot.watered) {
    plotStatus.innerHTML = window.langData[window.currentLang]?.growing || 'Growing';
    const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
    countdownFill.style.width = `${progress}%`;

    const interval = setInterval(() => {
      if (!plot.planted || plot.currentFrame >= plot.vegetable.frames) {
        clearInterval(interval);
        countdownFill.style.width = plot.currentFrame >= plot.vegetable.frames ? '100%' : '0%';
        plotElement.classList.toggle('ready', plot.currentFrame >= plot.vegetable.frames);
        plotStatus.innerHTML = plot.currentFrame >= plot.vegetable.frames
          ? window.langData[window.currentLang]?.readyToHarvest || 'Ready to Harvest'
          : '';
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
          plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
          plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
          setTimeout(() => plantImg.classList.add('loaded'), 50);
          plotStatus.innerHTML = plot.currentFrame >= plot.vegetable.frames
            ? window.langData[window.currentLang]?.readyToHarvest || 'Ready to Harvest'
            : window.langData[window.currentLang]?.needsWater || 'Needs Water';
          countdownFill.style.width = plot.currentFrame >= plot.vegetable.frames ? '100%' : '0%';
          plotElement.classList.toggle('ready', plot.currentFrame >= plot.vegetable.frames);
        } else {
          plotStatus.innerHTML = window.langData[window.currentLang]?.growing || 'Growing';
        }
      } else {
        plotStatus.innerHTML = window.langData[window.currentLang]?.needsWater || 'Needs Water';
        clearInterval(interval);
        countdownFill.style.width = '0%';
      }
      import('./ui.js').then(({ savePlayerData }) => savePlayerData());
    }, 1000);
  } else {
    plotStatus.innerHTML = window.langData[window.currentLang]?.needsWater || 'Needs Water';
    countdownFill.style.width = '0%';
  }

  const plantImg = document.createElement('img');
  plantImg.classList.add('plant-img');
  plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
  plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
  plotContent.appendChild(plantImg);
  plantImg.classList.add('loaded');
}

function handlePlotClick(index) {
  const plot = window.farmPlots[index];
  const plotElement = document.querySelectorAll('.plot')[index];
  const plotContent = plotElement.querySelector('.plot-content');
  const plotStatus = plotElement.querySelector('.plot-status');
  const countdownFill = plotElement.querySelector('.countdown-fill');

  if (!plot.planted) {
    const seedIndex = window.inventory.findIndex(item => item && item.type === 'seed' && item.quantity > 0);
    if (seedIndex === -1) {
      showNotification(window.langData[window.currentLang]?.noSeeds || 'No Seeds in inventory!');
      return;
    }

    const seed = window.inventory[seedIndex];
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
      plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
      plotContent.appendChild(plantImg);
      plantImg.classList.add('loaded');
    }, 800);

    plotStatus.innerHTML = window.langData[window.currentLang]?.needsWater || 'Needs Water';
    countdownFill.style.width = '0%';

    window.inventory[seedIndex].quantity -= 1;
    if (window.inventory[seedIndex].quantity <= 0) window.inventory.splice(seedIndex, 1);

    import('./ui.js').then(({ savePlayerData }) => savePlayerData());
    renderInventory();
    showNotification(window.langData[window.currentLang]?.planted || 'Planted!');
    playSound(plantingSound);
  } else if (plot.planted && !plot.watered && plot.currentFrame < plot.vegetable.frames) {
    const waterNeeded = plot.vegetable.waterNeeded || 1;
    if (window.water >= waterNeeded) {
      window.water -= waterNeeded;
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
      showNotification(window.langData[window.currentLang]?.watered || 'Watered!');
      playSound(wateringSound);
      updatePlotUI(plot, plotElement, index);
    } else {
      showNotification(window.langData[window.currentLang]?.notEnoughWater || 'Not Enough Water!');
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
    flyImage.src = plot.vegetable?.shopImage || 'assets/img/ui/placeholder.png';
    flyImage.classList.add('plant-fly');
    flyImage.style.width = '60px';
    document.body.appendChild(flyImage);

    const rect = plotContent.getBoundingClientRect();
    flyImage.style.left = `${rect.left + rect.width / 2 - 30}px`;
    flyImage.style.top = `${rect.top}px`;

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

    window.harvestCount++;
    import('./ui.js').then(({ savePlayerData }) => savePlayerData());
    checkHarvestAchievement();
    showNotification(window.langData[window.currentLang]?.harvested || 'Harvested!');
    playSound(harvestingSound);
    renderInventory();
    renderSellSection();
  }
}

export { initializePlots, handlePlotClick };

// PART 6 //
import { addSafeClickListener } from './utils.js';
import { showNotification, updateWallet } from './ui.js';
import { playSound, buyingSound } from './audio.js';
import { addToInventory, renderInventory } from './inventory.js';

function renderShop() {
  const shopContent = document.getElementById('shop-content');
  if (!shopContent) {
    console.error('shop-content not found');
    return;
  }

  shopContent.style.display = 'grid';
  shopContent.innerHTML = '';

  if (!window.langData[window.currentLang] || !Array.isArray(window.vegetables) || window.vegetables.length === 0) {
    shopContent.innerHTML = `<p>${window.langData[window.currentLang]?.noItems || 'No items available in shop.'}</p>`;
    return;
  }

  window.vegetables.forEach(veg => {
    const vegItem = document.createElement('div');
    vegItem.classList.add('shop-item');
    const farmPrice = typeof veg.farmPrice === 'number' ? veg.farmPrice : 0;
    const piPrice = typeof veg.piPrice === 'number' ? veg.piPrice : 0;
    vegItem.innerHTML = `
      <img src="${veg.shopImage}" alt="${veg.name[window.currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${veg.name[window.currentLang]}</h3>
      <p>${window.langData[window.currentLang]?.farmPriceLabel || 'Farm Price'}: ${farmPrice} Farm Coins</p>
      <p>${window.langData[window.currentLang]?.piPriceLabel || 'PI Price'}: ${piPrice} PI</p>
      <button class="buy-btn" data-id="${veg.id}">${window.langData[window.currentLang]?.buyLabel || 'Buy'} (Farm)</button>
      <button class="buy-pi-btn" data-id="${veg.id}">${window.langData[window.currentLang]?.buyLabel || 'Buy'} (PI)</button>
    `;
    shopContent.appendChild(vegItem);
  });

  const waterItem = document.createElement('div');
  waterItem.classList.add('shop-item');
  waterItem.innerHTML = `
    <img src="assets/img/ui/water_icon.png" alt="${window.langData[window.currentLang]?.waterLabel || 'Water'}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
    <h3>${window.langData[window.currentLang]?.waterLabel || 'Water'}</h3>
    <p>${window.langData[window.currentLang]?.farmPriceLabel || 'Farm Price'}: 100 Farm Coins</p>
    <p>${window.langData[window.currentLang]?.piPriceLabel || 'PI Price'}: 0.0001 PI</p>
    <button class="buy-btn" data-id="water">${window.langData[window.currentLang]?.buyLabel || 'Buy'} (Farm)</button>
    <button class="buy-pi-btn" data-id="water">${window.langData[window.currentLang]?.buyLabel || 'Buy'} (PI)</button>
  `;
  shopContent.appendChild(waterItem);

  shopContent.style.display = 'flex';

  document.querySelectorAll('.buy-btn').forEach(btn => {
    addSafeClickListener(btn, () => buyVegetable(btn.getAttribute('data-id'), 'farm'));
  });

  document.querySelectorAll('.buy-pi-btn').forEach(btn => {
    addSafeClickListener(btn, () => buyVegetable(btn.getAttribute('data-id'), 'pi'));
  });
}

async function buyVegetable(id, currency) {
  if (window.isSaving) return;
  window.isSaving = true;

  try {
    if (id === 'water') {
      if (currency === 'farm' && window.farmCoins >= 100) {
        window.farmCoins -= 100;
        window.water += 10;
        showTransactionAnimation('-100', false, document.querySelector(`.buy-btn[data-id="water"]`));
      } else if (currency === 'pi' && window.piBalance >= 0.0001) {
        window.piBalance -= 0.0001;
        window.water += 10;
        showTransactionAnimation('-0.0001 PI', false, document.querySelector(`.buy-pi-btn[data-id="water"]`));
      } else {
        showNotification(window.langData[window.currentLang]?.[`notEnough${currency === 'farm' ? 'Coins' : 'Pi'}`] || 'Not Enough!');
        window.isSaving = false;
        return;
      }
      updateWallet();
      playSound(buyingSound);
      await import('./ui.js').then(({ savePlayerData }) => savePlayerData());
      window.isSaving = false;
      return;
    }

    const veg = window.vegetables.find(v => v.id === id);
    if (!veg) {
      console.warn(`Vegetable ${id} not found`);
      window.isSaving = false;
      return;
    }

    let canBuy = false;
    if (currency === 'farm' && window.farmCoins >= veg.farmPrice) {
      window.farmCoins -= veg.farmPrice;
      canBuy = true;
      showTransactionAnimation(`-${veg.farmPrice}`, false, document.querySelector(`.buy-btn[data-id="${id}"]`));
    } else if (currency === 'pi' && window.piBalance >= veg.piPrice) {
      window.piBalance -= veg.piPrice;
      canBuy = true;
      showTransactionAnimation(`-${veg.piPrice} PI`, false, document.querySelector(`.buy-pi-btn[data-id="${id}"]`));
    } else {
      showNotification(window.langData[window.currentLang]?.[`notEnough${currency === 'farm' ? 'Coins' : 'Pi'}`] || 'Not Enough!');
    }

    if (canBuy) {
      addToInventory('seed', veg, 1);
      updateWallet();
      renderInventory();
      playSound(buyingSound);
      await import('./ui.js').then(({ savePlayerData }) => savePlayerData());
    }
  } catch (error) {
    console.error('Error in buyVegetable:', error.message);
    showNotification('Error during purchase');
  }
  window.isSaving = false;
}

function renderSellSection() {
  const sellContent = document.getElementById('sell-content');
  if (!sellContent) {
    console.error('sell-content not found');
    return;
  }

  if (!window.langData[window.currentLang]) {
    sellContent.innerHTML = '<p style="color:red;">Language data not loaded</p>';
    return;
  }

  sellContent.innerHTML = '';
  const groupedHarvest = {};
  window.inventory.forEach((item, index) => {
    if (item && item.type === 'harvest') {
      const vegId = item.vegetable.id;
      if (!groupedHarvest[vegId]) groupedHarvest[vegId] = { ...item, index };
      else groupedHarvest[vegId].quantity += item.quantity;
    }
  });

  let hasItems = false;
  Object.values(groupedHarvest).forEach(item => {
    const sellPrice = item.vegetable.sellPrice;
    if (typeof sellPrice !== 'number') {
      console.warn(`Missing sellPrice for ${item.vegetable.id}`);
      return;
    }

    const sellDiv = document.createElement('div');
    sellDiv.classList.add('sell-item');
    sellDiv.innerHTML = `
      <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[window.currentLang]}" class="shop-item-img">
      <h3>${item.vegetable.name[window.currentLang]}</h3>
      <p>${window.langData[window.currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
      <p>${window.langData[window.currentLang]?.sellPriceLabel || 'Sell Price'}: ${sellPrice} Farm Coins</p>
      <button class="sell-btn" data-index="${item.index}">${window.langData[window.currentLang]?.sellLabel || 'Sell'}</button>
    `;
    sellContent.appendChild(sellDiv);
    hasItems = true;
  });

  if (!hasItems) {
    sellContent.innerHTML = `<p>${window.langData[window.currentLang]?.noSellableItems || 'No items to sell.'}</p>`;
  }

  document.querySelectorAll('.sell-btn').forEach(btn => {
    addSafeClickListener(btn, () => sellItem(parseInt(btn.getAttribute('data-index'))));
  });
}

function showTransactionAnimation(amount, isPositive, buttonElement) {
  const animation = document.createElement('div');
  animation.classList.add('transaction-animation', isPositive ? 'positive' : 'negative');
  animation.textContent = amount;
  document.body.appendChild(animation);

  const rect = buttonElement ? buttonElement.getBoundingClientRect() : { left: 0, top: 0, width: 0 };
  animation.style.left = `${rect.left + rect.width / 2}px`;
  animation.style.top = `${rect.top - 20}px`;

  setTimeout(() => animation.remove(), 1000);
}

export { renderShop, buyVegetable, renderSellSection, showTransactionAnimation };

// PART 7 //
import { addSafeClickListener } from './utils.js';
import { showNotification, updateWallet } from './ui.js';
import { playSound, coinSound } from './audio.js';
import { checkLevelUp, checkCoinAchievement } from './achievements.js';
import { switchTab } from './ui.js';

function addToInventory(type, veg, qty = 1) {
  if (!veg || !veg.id) return;

  const existingIndex = window.inventory.findIndex(item =>
    item && item.type === type && item.vegetable && item.vegetable.id === veg.id
  );

  if (existingIndex !== -1) {
    window.inventory[existingIndex].quantity += qty;
  } else {
    window.inventory.push({ type, vegetable: veg, quantity: qty });
  }

  import('./ui.js').then(({ savePlayerData }) => savePlayerData());
}

function renderInventory() {
  const inventoryContent = document.getElementById('inventory-content');
  if (!inventoryContent) {
    showNotification('inventory-content not found');
    return;
  }

  if (!window.langData[window.currentLang]) return;

  inventoryContent.innerHTML = '';
  let hasItems = false;

  window.inventory.forEach(item => {
    if (!item || !item.vegetable) return;
    const veg = item.vegetable;
    const invItem = document.createElement('div');
    invItem.classList.add('inventory-item');
    const isSeed = item.type === 'seed';
    const title = isSeed ? `${veg.name[window.currentLang]} Seed` : veg.name[window.currentLang];
    invItem.innerHTML = `
      <img src="${veg.shopImage}" alt="${title}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
      <h3>${title}</h3>
      <p>${window.langData[window.currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
    `;
    inventoryContent.appendChild(invItem);
    hasItems = true;
  });

  if (!hasItems) {
    const noItemText = document.createElement('p');
    noItemText.textContent = window.langData[window.currentLang]?.noInventory || 'No items in inventory.';
    inventoryContent.appendChild(noItemText);
  }

  const sellButton = document.createElement('button');
  sellButton.textContent = window.langData[window.currentLang]?.sellToShop || 'Sell to Shop';
  sellButton.classList.add('sell-to-shop-btn');
  addSafeClickListener(sellButton, () => {
    openSellTab();
    import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
  });
  inventoryContent.appendChild(sellButton);
}

function sellItem(index) {
  const item = window.inventory[index];
  if (!item || item.type !== 'harvest') return;

  const sellPrice = item.vegetable.sellPrice;
  if (typeof sellPrice !== 'number') {
    showNotification('Cannot sell: Missing sellPrice data.');
    return;
  }

  const totalGain = sellPrice * item.quantity;
  window.farmCoins += totalGain;
  window.xp += 10;

  const btnElement = document.querySelector(`.sell-btn[data-index="${index}"]`);
  if (btnElement) {
    import('./shop.js').then(({ showTransactionAnimation }) => showTransactionAnimation(`+${totalGain}`, true, btnElement));
  }

  window.inventory.splice(index, 1);
  import('./ui.js').then(({ savePlayerData }) => savePlayerData());
  updateWallet();
  renderInventory();
  import('./shop.js').then(({ renderSellSection }) => renderSellSection());
  playSound(coinSound);
  checkLevelUp();
  checkCoinAchievement();
}

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
    import('./shop.js').then(({ renderSellSection }) => renderSellSection());
  }
}

export { addToInventory, renderInventory, sellItem, openSellTab };

// PART 8 //
import { database, ref, onValue, update, get } from '../firebase/firebase-config.js';
import { showNotification, updateWallet } from './ui.js';
import { playSound, coinSound } from './audio.js';

let currentExchangeRate = 1000000;

function loadExchangeRate() {
  const rateRef = ref(database, 'exchangeRate/liveRate');
  onValue(rateRef, (snapshot) => {
    currentExchangeRate = snapshot.val() || currentExchangeRate;
    const rateEl = document.getElementById('live-rate');
    if (rateEl) rateEl.textContent = `1 Pi = ${currentExchangeRate.toLocaleString()} FC`;
    updateExchangeResult();
  });
}

function updateExchangeResult() {
  const rawAmount = document.getElementById('exchange-amount').value.replace(',', '.');
  const amount = parseFloat(rawAmount) || 0;
  const direction = document.getElementById('exchange-direction').value;
  const result = direction === 'piToFc' ? Math.floor(amount * currentExchangeRate) : amount / currentExchangeRate;
  const resultText = `You will get: ${direction === 'piToFc' ? result.toLocaleString() : result.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
  const resultDiv = document.getElementById('exchange-result');
  resultDiv.textContent = resultText.length > 25 ? resultText.substring(0, 25) + '…' : resultText;
  resultDiv.title = resultText;
}

async function handleExchange() {
  const rawAmount = document.getElementById('exchange-amount').value.replace(',', '.');
  const amount = parseFloat(rawAmount);
  const direction = document.getElementById('exchange-direction').value;
  const playerRef = ref(database, `players/${window.username}`);
  const snapshot = await get(playerRef);
  const data = snapshot.val();

  if (!data) return showNotification('Player data not found!');
  if (isNaN(amount) || amount <= 0) return showNotification('Invalid amount!');

  let piBalance = Number(data.piBalance || 0);
  let farmCoins = Number(data.farmCoins || 0);
  let resultText = '';

  if (direction === 'piToFc') {
    if (piBalance < amount) return showNotification('Not enough Pi!');
    const converted = Math.floor(amount * currentExchangeRate);
    piBalance -= amount;
    farmCoins += converted;
    resultText = converted.toLocaleString();
  } else {
    if (farmCoins < amount) return showNotification('Not enough FC!');
    const converted = amount / currentExchangeRate;
    farmCoins -= amount;
    piBalance += converted;
    resultText = converted.toFixed(6);
  }

  piBalance = Math.round(piBalance * 1000000) / 1000000;
  farmCoins = Math.floor(farmCoins);

  document.getElementById('exchange-loading').style.display = 'block';

  setTimeout(async () => {
    try {
      await update(playerRef, { piBalance, farmCoins });
      document.getElementById('pi-balance').textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
      document.getElementById('fc-balance').textContent = farmCoins.toLocaleString();
      document.getElementById('exchange-amount').value = '';
      updateExchangeResult(resultText);
      playSound(coinSound);
      showNotification('Exchange success!');
    } catch (error) {
      console.error('Exchange failed:', error.message);
      showNotification('Exchange failed: ' + error.message);
    } finally {
      document.getElementById('exchange-loading').style.display = 'none';
    }
  }, 3000);
}

function initExchangeControls() {
  const exchangeBtn = document.getElementById('exchange-btn');
  const directionSelect = document.getElementById('exchange-direction');
  if (directionSelect) {
    directionSelect.addEventListener('change', () => {
      exchangeBtn.textContent = directionSelect.value === 'piToFc' ? 'Exchange to FC' : 'Exchange to Pi';
      updateExchangeResult();
    });
    directionSelect.dispatchEvent(new Event('change'));
  }
}

export { loadExchangeRate, updateExchangeResult, handleExchange, initExchangeControls };

// PART 9 //
import { showNotification, updateWallet } from './ui.js';
import { playSound, coinSound } from './audio.js';

function checkLevelUp() {
  const xpRequired = window.level * 100;
  while (window.xp >= xpRequired) {
    window.xp -= xpRequired;
    window.level++;
    showNotification(`${window.langData[window.currentLang]?.levelUp || 'Level Up!'} ${window.level}`);
  }
  updateWallet();
}

function checkHarvestAchievement() {
  if (window.harvestCount >= 100 && !window.achievements.harvest) {
    window.achievements.harvest = true;
    window.farmCoins += 500;
    showNotification(window.langData[window.currentLang]?.harvestAchievement || 'Achievement Unlocked: Harvest Master! +500 Coins');
    updateWallet();
    renderAchievements();
  }
}

function checkCoinAchievement() {
  if (window.farmCoins >= 10000 && !window.achievements.coins) {
    window.achievements.coins = true;
    window.water += 100;
    showNotification(window.langData[window.currentLang]?.coinAchievement || 'Achievement Unlocked: Coin Collector! +100 Water');
    updateWallet();
    renderAchievements();
  }
}

function renderAchievements() {
  const achievementsContent = document.getElementById('achievements-content');
  if (!achievementsContent) return;

  achievementsContent.innerHTML = '';
  const achievements = [
    {
      title: window.langData[window.currentLang]?.harvestAchievementTitle || 'Harvest Master',
      desc: window.langData[window.currentLang]?.harvestAchievementDesc || 'Harvest 10 crops',
      status: window.achievements.harvest
    },
    {
      title: window.langData[window.currentLang]?.coinAchievementTitle || 'Coin Collector',
      desc: window.langData[window.currentLang]?.coinAchievementDesc || 'Collect 1000 Farm Coins',
      status: window.achievements.coins
    }
  ];

  achievements.forEach(ach => {
    const achievement = document.createElement('div');
    achievement.classList.add('achievement');
    achievement.innerHTML = `
      <h3>${ach.title}</h3>
      <p>${ach.desc}</p>
      <p>${window.langData[window.currentLang]?.statusLabel || 'Status'}: ${ach.status ? window.langData[window.currentLang]?.unlocked || 'Unlocked' : window.langData[window.currentLang]?.locked || 'Locked'}</p>
    `;
    achievementsContent.appendChild(achievement);
  });

  import('./ui.js').then(({ savePlayerData }) => savePlayerData());
}

async function checkDailyReward() {
  if (!window.username) return;
  const today = new Date().toISOString().split('T')[0];
  const lastClaimDate = window.lastClaim ? new Date(window.lastClaim).toISOString().split('T')[0] : null;
  const claimRewardBtn = document.getElementById('claim-reward-btn');
  if (claimRewardBtn) {
    if (lastClaimDate === today) {
      claimRewardBtn.classList.add('claimed');
      claimRewardBtn.textContent = window.langData[window.currentLang]?.claimed || 'Claimed!';
      claimRewardBtn.disabled = true;
      window.claimedToday = true;
    } else {
      claimRewardBtn.classList.remove('claimed');
      claimRewardBtn.textContent = window.langData[window.currentLang]?.claimDailyReward || 'Claim Daily Reward';
      claimRewardBtn.disabled = false;
      window.claimedToday = false;
    }
  }
}

async function claimDailyReward() {
  if (!window.username || window.isClaiming) return;
  window.isClaiming = true;

  window.farmCoins += 100;
  window.water += 50;
  window.xp += 10;
  window.lastClaim = new Date().toISOString();
  window.claimedToday = true;

  const playerRef = import('../firebase/firebase-config.js').then(({ ref, database }) => ref(database, `players/${window.username}`));
  try {
    await import('../firebase/firebase-config.js').then(({ update }) => update(playerRef, {
      farmCoins: window.farmCoins,
      water: window.water,
      xp: window.xp,
      lastClaim: window.lastClaim,
      claimedToday: window.claimedToday
    }));
    updateWallet();
    document.getElementById('reward-modal').style.display = 'none';
    const claimRewardBtn = document.getElementById('claim-reward-btn');
    if (claimRewardBtn) {
      claimRewardBtn.classList.add('claimed');
      claimRewardBtn.textContent = window.langData[window.currentLang]?.claimed || 'Claimed!';
      claimRewardBtn.disabled = true;
    }
    checkLevelUp();
    playSound(coinSound);
    showNotification(window.langData[window.currentLang]?.rewardClaimed || 'Reward Claimed!');
  } catch (error) {
    console.error('Error claiming reward:', error.message);
    showNotification('Error claiming reward: ' + error.message);
  } finally {
    window.isClaiming = false;
  }
}

export { checkLevelUp, checkHarvestAchievement, checkCoinAchievement, renderAchievements, checkDailyReward, claimDailyReward };

// PART 10 //
import { auth, database, ref, onValue } from '../firebase/firebase-config.js';
import { addSafeClickListener } from './utils.js';
import { handleLogin, handleRegister, switchToLogin, switchToRegister, handleReferral, loadPlayerData } from './auth.js';
import { initializeGame, startGame, enterFullScreen, exitFullScreen } from './game.js';
import { initAudioControls } from './audio.js';
import { switchTab, showNotification, toggleLanguage } from './ui.js';
import { loadExchangeRate, initExchangeControls, handleExchange } from './exchange.js';
import { handleDeposit, handleWithdraw } from './finance.js';
import { claimDailyReward, checkDailyReward } from './achievements.js';
import { initializePlots } from './farm.js';
import { renderShop, renderSellSection } from './shop.js';
import { renderInventory } from './inventory.js';

// Initialize global state
window.isDataLoaded = false;
window.piInitialized = false;
window.referralEarnings = 0;
window.farmCoins = 0;
window.piBalance = 0;
window.water = 0;
window.level = 1;
window.xp = 0;
window.inventory = [];
window.vegetables = [];
window.langData = {};
window.currentLang = localStorage.getItem('language') || 'en';
window.farmPlots = [];
window.harvestCount = 0;
window.achievements = { harvest: false, coins: false };
window.username = localStorage.getItem('username');
window.lastClaim = null;
window.claimedToday = false;
window.isClaiming = false;
window.isAudioPlaying = false;
window.isSaving = false;

// DOMContentLoaded event listener
document.addEventListener('DOMContentLoaded', () => {
  // Map of element IDs to their click/touch handlers
  const elements = {
    'start-text': () => startGame(),
    'lang-toggle': () => toggleLanguage(),
    'game-lang-toggle': () => toggleLanguage(),
    'settings-btn': () => {
      document.getElementById('settings-modal').style.display = 'block';
      import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
    },
    'game-settings-btn': () => {
      document.getElementById('settings-modal').style.display = 'block';
      import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
    },
    'close-settings': () => {
      document.getElementById('settings-modal').style.display = 'none';
      import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
    },
    'reward-modal-close': () => {
      document.getElementById('reward-modal').style.display = 'none';
      import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
    },
    'fullscreen-toggle': () => {
      document.fullscreenElement ? exitFullScreen() : enterFullScreen();
      import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
    },
    'exit-game-btn': () => {
      import('./audio.js').then(({ bgMusic, bgVoice }) => {
        if (bgMusic) bgMusic.pause();
        if (bgVoice) bgVoice.pause();
      });
      window.location.reload();
    },
    'exchange-btn': () => handleExchange(),
    'claim-reward-btn': () => {
      document.getElementById('reward-modal').style.display = 'block';
      document.getElementById('daily-reward-text').textContent =
        window.langData[window.currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!';
    },
    'claim-modal-btn': () => claimDailyReward(),
    'shop-buy-tab': () => {
      document.getElementById('shop-buy-tab').classList.add('active');
      document.getElementById('shop-sell-tab').classList.remove('active');
      document.getElementById('shop-content').style.display = 'block';
      document.getElementById('sell-section').style.display = 'none';
      renderShop();
      import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
    },
    'shop-sell-tab': () => {
      document.getElementById('shop-sell-tab').classList.add('active');
      document.getElementById('shop-buy-tab').classList.remove('active');
      document.getElementById('shop-content').style.display = 'none';
      document.getElementById('sell-section').style.display = 'block';
      renderSellSection();
      import('./audio.js').then(({ playSound, menuSound }) => playSound(menuSound));
    },
    'login-email-btn': (e) => handleLogin(e),
    'register-email-btn': (e) => handleRegister(e),
    'register-link': () => switchToRegister(),
    'login-link': () => switchToLogin(),
    'exchange-amount': () => import('./exchange.js').then(({ updateExchangeResult }) => updateExchangeResult()),
    'copy-link-btn': () => {
      const referralLink = document.getElementById('referral-link');
      if (referralLink) {
        navigator.clipboard.writeText(referralLink.textContent).then(() => {
          const btn = document.getElementById('copy-link-btn');
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = 'Copy', 2000);
        });
      }
    },
  };

  // Attach event listeners
  Object.entries(elements).forEach(([id, callback]) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'exchange-amount') {
        el.addEventListener('input', callback);
      } else {
        addSafeClickListener(el, callback);
      }
    }
  });

  // Tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    addSafeClickListener(btn, () => switchTab(btn.getAttribute('data-tab')));
  });

  // Initialize components
  initAudioControls();
  initializeGame();
  initializePlots();
  loadExchangeRate();
  initExchangeControls();
  handleDeposit();
  handleWithdraw();
  checkDailyReward();

  // Handle auth state changes
  auth.onAuthStateChanged(user => {
    if (user && window.username) {
      const userKey = localStorage.getItem('userKey');
      if (userKey) loadPlayerData(userKey);
      handleReferral();
    } else {
      switchToLogin();
    }
  });
});
