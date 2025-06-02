import { initAudioControls, updateVolumes } from '/ui/volume-control.js';
import { loadData } from '/core/loader.js';
import { switchToLogin } from '/auth/login.js';

async function initializeGame() {
  try {
    initAudioControls();
    updateVolumes();
    await loadData();
    switchToLogin(); // tampilkan login screen
  } catch (e) {
    console.error('Init error:', e.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeGame();
});





// Ambil database dan auth dari firebase-config.js
import {
  auth, database, messaging,
  ref, onValue, set, update, get, push
} from '/firebase/firebase-config.js';

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ==== Global Element ====
const claimModalBtn = document.getElementById('claim-modal-btn');
const rewardModal = document.getElementById('reward-modal');

// ==== Helper: Tambahkan event click/touch dengan lock ====
export function addSafeClickListener(element, callback) {
  let isLocked = false;
  const handler = (e) => {
    if (isLocked) return;
    isLocked = true;
    callback(e);
    setTimeout(() => isLocked = false, 300);
  };
  element.addEventListener('click', handler);
  element.addEventListener('touchstart', handler);
}

// ==== Global State ====
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
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;

const plotCount = 4;
const piToFarmRate = 1000000;

// ==== Load Saldo Pi dan Farm Coin dari Firebase ====
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

// ==== Audio ====
const audioElements = {
  music: document.getElementById('bg-music'),
  voice: document.getElementById('bg-voice'),
  harvesting: document.getElementById('harvesting-sound'),
  watering: document.getElementById('watering-sound'),
  planting: document.getElementById('planting-sound'),
  menu: document.getElementById('menu-sound'),
  buying: document.getElementById('buying-sound'),
  coin: document.getElementById('coin-sound')
};

function tryPlay(audioKey) {
  const audio = audioElements[audioKey];
  if (audio) {
    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(e => console.warn(`${audioKey} sound failed:`, e.message));
    }
  }
}

// Fungsi-fungsi pemutar audio
function playBgMusic() {
  const music = audioElements.music;
  if (music && !isAudioPlaying) {
    const promise = music.play();
    if (promise !== undefined) {
      promise
        .then(() => {
          console.log('Background music started');
          isAudioPlaying = true;
        })
        .catch(e => {
          console.warn('BG Music failed:', e.message);
          setTimeout(() => music.play().catch(err => console.warn('Retry failed:', err.message)), 100);
        });
    }
  }
}

function playBgVoice() {
  const voice = audioElements.voice;
  if (voice && !isAudioPlaying) {
    const promise = voice.play();
    if (promise !== undefined) {
      promise.catch(e => {
        console.warn('BG Voice failed:', e.message);
        setTimeout(() => voice.play().catch(err => console.warn('Retry voice failed:', err.message)), 100);
      });
    }
  }
}

// Shortcut audio lainnya
const playHarvestingSound = () => tryPlay('harvesting');
const playWateringSound = () => tryPlay('watering');
const playPlantingSound = () => tryPlay('planting');
const playMenuSound = () => tryPlay('menu');
const playBuyingSound = () => tryPlay('buying');
const playCoinSound = () => tryPlay('coin');

// ==== Inisialisasi Slider Volume ====
function initAudioControls() {
  const musicSlider = document.getElementById('music-volume');
  const voiceSlider = document.getElementById('voice-volume');

  if (musicSlider) {
    musicSlider.value = localStorage.getItem('musicVolume') ?? 50;
    musicSlider.addEventListener('input', () => {
      localStorage.setItem('musicVolume', musicSlider.value);
      updateVolumes();
    });
  }

  if (voiceSlider) {
    voiceSlider.value = localStorage.getItem('voiceVolume') ?? 50;
    voiceSlider.addEventListener('input', () => {
      localStorage.setItem('voiceVolume', voiceSlider.value);
      updateVolumes();
    });
  }
}

// ==== Update Volume berdasarkan localStorage ====
function updateVolumes() {
  const musicVol = Math.min(Math.max((parseFloat(localStorage.getItem('musicVolume')) || 50) / 100, 0), 1);
  const voiceVol = Math.min(Math.max((parseFloat(localStorage.getItem('voiceVolume')) || 50) / 100, 0), 1);

  if (audioElements.music) audioElements.music.volume = musicVol;
  if (audioElements.voice) audioElements.voice.volume = voiceVol;

  ['harvesting', 'watering', 'planting', 'menu', 'buying', 'coin'].forEach(key => {
    if (audioElements[key]) audioElements[key].volume = voiceVol;
  });

  console.log('Updated Volumes:', { musicVol, voiceVol });
}

// ==== Panggil saat awal ====
initAudioControls();
updateVolumes();

// START loadData fix
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
// END loadData fix

// Document ready event listener
document.addEventListener('DOMContentLoaded', () => {
    const elementsWithHandlers = [
        { id: 'start-text', handler: startGame },
        { id: 'lang-toggle', handler: toggleLanguage },
        { id: 'game-lang-toggle', handler: toggleLanguage },
        { id: 'settings-btn', handler: showSettings },
        { id: 'game-settings-btn', handler: showSettings },
        { id: 'close-settings', handler: hideSettings },
        { id: 'reward-modal-close', handler: () => { if (rewardModal) rewardModal.style.display = 'none'; playMenuSound(); } },
        { id: 'fullscreen-toggle', handler: toggleFullScreen },
        { id: 'exit-game-btn', handler: () => { if (bgMusic) bgMusic.pause(); if (bgVoice) bgVoice.pause(); window.location.reload(); } },
        { id: 'exchange-btn', handler: handleExchange },
        { id: 'login-email-btn', handler: () => {} },
        { id: 'register-email-btn', handler: () => {} },
    ];

    elementsWithHandlers.forEach(({ id, handler }) => {
        const el = document.getElementById(id);
        if (el) addSafeClickListener(el, handler);
    });

    const musicVolumeSlider = document.getElementById('music-volume');
    if (musicVolumeSlider) {
        musicVolumeSlider.value = localStorage.getItem('musicVolume') || 50;
        musicVolumeSlider.addEventListener('input', () => {
            localStorage.setItem('musicVolume', musicVolumeSlider.value);
            updateVolumes();
        });
    }

    const voiceVolumeSlider = document.getElementById('voice-volume');
    if (voiceVolumeSlider) {
        voiceVolumeSlider.value = localStorage.getItem('voiceVolume') || 50;
        voiceVolumeSlider.addEventListener('input', () => {
            localStorage.setItem('voiceVolume', voiceVolumeSlider.value);
            updateVolumes();
        });
    }

    const exchangeAmountElement = document.getElementById('exchange-amount');
    if (exchangeAmountElement) exchangeAmountElement.addEventListener('input', updateExchangeResult);

    const directionSelect = document.getElementById('exchange-direction');
    if (directionSelect) directionSelect.addEventListener('change', updateExchangeResult);

    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        addSafeClickListener(btn, () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
        });
    });

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

    initializeGame();
});

// Show/hide settings modal
function showSettings() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.style.display = 'block';
        playMenuSound();
    }
}

function hideSettings() {
    const settingsModal = document.getElementById('settings-modal');
    if (settingsModal) {
        settingsModal.style.display = 'none';
        playMenuSound();
    }
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        enterFullScreen();
    } else {
        exitFullScreen();
    }
    playMenuSound();
}

// ========================
// UI Elements
// ========================
const registerEmailBtn = document.getElementById('register-email-btn');
const registerEmailInput = document.getElementById('register-email-input');
const registerPasswordInput = document.getElementById('register-password-input');
const registerUsernameInput = document.getElementById('register-username-input');
const registerError = document.getElementById('register-error');

const loginEmailBtn = document.getElementById('login-email-btn');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const verifyEmailMsg = document.getElementById('verify-status');

// ========================
// Helper Functions
// ========================
const encodeEmail = email =>
  email.replace('@', '_at_').replace(/\./g, '_dot_');

const resolveUserKey = (role, email, username) =>
  role === 'admin' ? encodeEmail(email) : username;

const switchToLogin = () => {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('register-screen').style.display = 'none';
};

const switchToRegister = () => {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('register-screen').style.display = 'flex';
};

// ========================
// DOM Ready
// ========================
document.addEventListener('DOMContentLoaded', () => {
  const registerLink = document.getElementById('register-link');
  const loginLink = document.getElementById('login-link');

  if (registerLink) addSafeClickListener(registerLink, switchToRegister);
  if (loginLink) addSafeClickListener(loginLink, switchToLogin);

  switchToLogin(); // Default ke login
  initializeGame(); // Jalankan game setelah UI siap
});

// ========================
// Login Handler
// ========================
if (loginEmailBtn) {
  addSafeClickListener(loginEmailBtn, async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      loginError.textContent = 'Please enter email and password.';
      loginError.style.display = 'block';
      return;
    }

    try {
      const { user } = await signInWithEmailAndPassword(auth, email, password);

      if (!user.emailVerified) {
        await sendEmailVerification(user);
        loginError.textContent = 'Please verify your email.';
        loginError.style.display = 'block';
        verifyEmailMsg.style.display = 'block';
        return;
      }

      const playersSnapshot = await get(ref(database, 'players'));
      const players = playersSnapshot.val() || {};
      const foundUsername = Object.keys(players).find(key => players[key].email === email);

      if (!foundUsername) throw new Error('User not found in players database.');

      const playerData = players[foundUsername];
      if (!playerData) throw new Error('Player data missing.');
      if (playerData.status !== 'approved') {
        throw new Error(`Account ${playerData.status}. Contact admin.`);
      }

      const role = playerData.role || 'user';
      const encodedEmail = encodeEmail(email);
      const userKey = resolveUserKey(role, email, foundUsername);

      // Simpan ke localStorage
      localStorage.setItem('username', foundUsername);
      localStorage.setItem('email', email);
      localStorage.setItem('role', role);
      localStorage.setItem('encodedEmail', encodedEmail);
      localStorage.setItem('userKey', userKey);

      // Notifikasi realtime
      onValue(ref(database, `notifications/${userKey}`), (snapshot) => {
        const data = snapshot.val();
        if (data) {
          Object.entries(data).forEach(([id, notif]) => {
            if (!notif.read) {
              showNotification(notif.message);
              update(ref(database, `notifications/${userKey}/${id}`), { read: true });
            }
          });
        }
      });

      showNotification(`Logged in as ${email}`);

      // Redirect berdasarkan role
      if (role === 'admin') {
        window.location.href = 'admin/admin.html';
      } else {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
      }

      loadPlayerData(userKey);
      updateReferralLink();

    } catch (error) {
      console.error('Login error:', error.message);
      loginError.textContent = error.message;
      loginError.style.display = 'block';
    }
  });
}

// ========================
// Notifikasi Realtime
// ========================
if (username) {
  const notifRef = ref(database, `notifications/${username}`);
  onValue(notifRef, (snapshot) => {
    const notifications = snapshot.val();
    if (notifications) {
      Object.entries(notifications).forEach(([id, notif]) => {
        if (!notif.read) {
          showNotification(notif.message);
          update(ref(database, `notifications/${username}/${id}`), { read: true });
        }
      });
    }
  });
}

// ========================
// Start Game Handler
// ========================
const startTextElement = document.getElementById('start-text');
if (startTextElement) {
  addSafeClickListener(startTextElement, () => {
    console.log('Start Text clicked, isDataLoaded:', isDataLoaded, 'username:', username);
    if (isDataLoaded && username) {
      showNotification('Game started!');
      const startScreenElement = document.getElementById('start-screen');
      const gameScreenElement = document.getElementById('game-screen');
      if (startScreenElement && gameScreenElement) {
        startScreenElement.style.display = 'none';
        startScreenElement.classList.remove('center-screen');
        gameScreenElement.style.display = 'flex';
        gameScreenElement.classList.add('fade-in');
        console.log('Game screen displayed');
      } else {
        console.error('Start or Game screen element not found');
      }
      isAudioPlaying = false;
      playBgMusic();
      playBgVoice();
      switchTab('farm');
      enterFullScreen();
    } else {
      showNotification('Please wait, loading player data or login first...');
      console.warn('Data not loaded yet or user not logged in');
    }
  });
}

// ========================
// Load Player Data
// ========================
function loadPlayerData(userKey) {
  if (!userKey) {
    showNotification('Login required.');
    return;
  }

  const playerRef = ref(database, `players/${userKey}`);
  onValue(playerRef, (snapshot) => {
    const data = snapshot.val();

    // Jika data tidak ada dan bukan admin, inisialisasi
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

      set(playerRef, init)
        .then(() => console.log('Initialized new user data:', userKey))
        .catch((err) => {
          console.error('Failed to init user data:', err.message);
          showNotification('Failed to init data');
        });
      return;
    }

    // Assign ke variabel global
    farmCoins = data.farmCoins || 0;
    piBalance = data.piBalance || 0;
    water = data.water || 0;
    level = data.level || 1;
    xp = data.xp || 0;
    inventory = data.inventory || [];
    farmPlots = data.farmPlots || [];
    harvestCount = data.harvestCount || 0;
    achievements = data.achievements || { harvest: false, coins: false };
    referralEarnings = data.referralEarnings || 0;

    isDataLoaded = true;
    updateWallet();
    initializePlots();
    renderShop();
    renderInventory();
    renderSellSection();
    renderAchievements();
    checkDailyReward();
    console.log('User data loaded for:', userKey);
  });
}

// ========================
// Referral Link Generator
// ========================
function generateReferralLink(username) {
  return `https://www.harvestpi.biz.id/?ref=${username}`;
}

// ======= Bagian 5: Register, Deposit, dan Referral =======

// Register dengan username dan email
if (registerEmailBtn) {
  addSafeClickListener(registerEmailBtn, async (e) => {
    e.preventDefault();

    const email = registerEmailInput.value.trim();
    const password = registerPasswordInput.value;
    const inputUsername = registerUsernameInput?.value.trim() || '';

    registerError.style.display = 'none';

    if (!email || !password || !inputUsername) {
      registerError.style.display = 'block';
      registerError.textContent = 'Please enter email, password, and username.';
      return;
    }

    try {
      // Validasi username (huruf dan angka minimal 3 karakter)
      const normalizedUsername = inputUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normalizedUsername.length < 3) {
        throw new Error('Username must be at least 3 characters and only use letters/numbers.');
      }

      // Cek duplikat username di database
      const playerRef = ref(database, `players/${normalizedUsername}`);
      const snapshot = await get(playerRef);
      if (snapshot.exists()) {
        throw new Error('Username already taken.');
      }

      // Daftar akun di Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Simpan data player awal ke Realtime Database
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

      // Kirim email verifikasi
      await sendEmailVerification(user);

      // Beri notifikasi sukses
      registerError.style.display = 'block';
      registerError.textContent = 'Registration successful! Please verify your email.';
      showNotification('Registration successful! Check your email for verification.');

      // Reset input dan kembali ke login
      registerEmailInput.value = '';
      registerPasswordInput.value = '';
      if (registerUsernameInput) registerUsernameInput.value = '';
      switchToLogin();

    } catch (error) {
      registerError.style.display = 'block';
      registerError.textContent = `Registration failed: ${error.message}`;
      console.error('Registration error:', error);
    }
  });
}

// Tombol deposit PI
const depositBtn = document.getElementById('deposit-btn');
if (depositBtn) {
  addSafeClickListener(depositBtn, async (e) => {
    e.preventDefault();

    const amountInput = document.getElementById('pi-amount');
    const amount = parseFloat(amountInput.value) || 0;

    if (amount <= 0) {
      alert('Please enter a valid amount!');
      return;
    }

    await handleDeposit(username, amount);
    amountInput.value = '';
  });
}

// Tombol salin referral link
const copyLinkBtn = document.getElementById('copy-link-btn');
if (copyLinkBtn) {
  addSafeClickListener(copyLinkBtn, () => {
    const referralLinkElement = document.getElementById('referral-link');
    if (referralLinkElement && referralLinkElement.textContent) {
      copyToClipboard(referralLinkElement.textContent);
      showNotification('Referral link copied!');
    } else {
      console.error('Referral link element not found or empty');
    }
  });
}

// Fungsi untuk menangani deposit
async function handleDeposit(username, amount) {
  if (!username || amount <= 0) return;

  const playerRef = ref(database, `players/${username}`);
  try {
    const snapshot = await get(playerRef);
    const playerData = snapshot.val() || {};
    const newBalance = (playerData.piBalance || 0) + amount;

    await update(playerRef, { piBalance: newBalance });
    console.log(`Deposit successful: ${amount} PI added to ${username}`);
    showNotification(`Deposit successful: ${amount} PI`);

    loadUserBalances(); // Refresh UI jika ada
  } catch (error) {
    console.error('Deposit error:', error);
    showNotification('Error depositing: ' + error.message);
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

    if (farmCoinsElement) farmCoinsElement.textContent = `${farmCoins} Farm Coins`;
    if (piCoinsElement) piCoinsElement.textContent = `${piBalance.toFixed(6)} PI`;
    if (waterElement) waterElement.textContent = `${water} Water`;
    if (levelElement) levelElement.textContent = `Level: ${level} | XP: ${xp}`;
    if (xpFillElement) xpFillElement.style.width = `${(xp / (level * 100)) * 100}%`;
    if (farmCoinBalanceElement) farmCoinBalanceElement.textContent = farmCoins;
    if (piCoinBalanceElement) piCoinBalanceElement.textContent = piBalance.toFixed(6);

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
        farmPlots = Array.from({ length: plotCount }, () => ({
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
                updateGrowingUI();

                const interval = setInterval(() => {
                    if (!plot.planted || plot.currentFrame >= plot.vegetable.frames) {
                        clearInterval(interval);
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

                            let img = plotContent.querySelector('.plant-img');
                            if (!img) {
                                img = document.createElement('img');
                                img.classList.add('plant-img');
                                plotContent.appendChild(img);
                            }

                            img.classList.remove('loaded');
                            img.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
                            img.onerror = () => { img.src = 'assets/img/ui/placeholder.png'; };

                            setTimeout(() => {
                                img.classList.add('loaded');
                            }, 50);

                            if (plot.currentFrame >= plot.vegetable.frames) {
                                plotElement.classList.add('ready');
                                if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
                                countdownFill.style.width = '100%';
                                clearInterval(interval);
                            } else {
                                if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                                countdownFill.style.width = '0%';
                            }
                        } else {
                            if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
                        }
                    } else {
                        if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                        countdownFill.style.width = '0%';
                        clearInterval(interval);
                    }

                    savePlayerData();
                }, 1000);

                function updateGrowingUI() {
                    if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
                    const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
                    if (countdownFill) countdownFill.style.width = `${progress}%`;
                }
            } else {
                if (plotStatus) plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                if (countdownFill) countdownFill.style.width = '0%';
            }
        }
    });

    updateUIText();
}

// Handle plot click with manual growth
function handlePlotClick(index) {
    const plot = farmPlots[index];
    const plotElement = document.querySelectorAll('.plot')[index];
    const plotContent = plotElement?.querySelector('.plot-content');
    const plotStatus = plotElement?.querySelector('.plot-status');
    const countdownFill = plotElement?.querySelector('.countdown-fill');

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

        harvestCount++;
        savePlayerData();
        checkHarvestAchievement();
        showNotification(langData[currentLang]?.harvested || 'Harvested!');
        playHarvestingSound();
        renderInventory();
        renderSellSection();
    }
}

// Fungsi paksa layout agar grid langsung kebentuk
function forceReflow(el) {
    void el.offsetHeight;
}

// ===================== SHOP RENDER =====================
function renderShop() {
    const shopContent = document.getElementById('shop-content');
    if (!shopContent) return console.error('shop-content element not found');

    forceReflow(shopContent);
    shopContent.style.display = 'grid';

    const lang = langData[currentLang] || {};
    if (!langData[currentLang]) {
        shopContent.innerHTML = `<p style="color:red;">Language data not loaded. Please reload.</p>`;
        return;
    }

    if (!Array.isArray(vegetables) || vegetables.length === 0) {
        shopContent.innerHTML = `<p>${lang.noItems || 'No items available in shop.'}</p>`;
        return;
    }

    shopContent.innerHTML = '';

    const createShopItem = (id, name, image, farmPrice, piPrice) => {
        const div = document.createElement('div');
        div.classList.add('shop-item');
        div.innerHTML = `
            <img src="${image}" alt="${name}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
            <h3>${name}</h3>
            <p>${lang.farmPriceLabel || 'Farm Price'}: ${farmPrice} Farm Coins</p>
            <p>${lang.piPriceLabel || 'PI Price'}: ${piPrice} PI</p>
            <button class="buy-btn" data-id="${id}">${lang.buyLabel || 'Buy'} (Farm)</button>
            <button class="buy-pi-btn" data-id="${id}">${lang.buyLabel || 'Buy'} (PI)</button>
        `;
        return div;
    };

    vegetables.forEach(veg => {
        const name = veg.name[currentLang] || 'Unknown';
        const farmPrice = typeof veg.farmPrice === 'number' ? veg.farmPrice : 0;
        const piPrice = typeof veg.piPrice === 'number' ? veg.piPrice : 0;
        const item = createShopItem(veg.id, name, veg.shopImage, farmPrice, piPrice);
        shopContent.appendChild(item);
    });

    // Water item
    const waterItem = createShopItem('water', lang.waterLabel || 'Water', 'assets/img/ui/water_icon.png', 100, 0.0001);
    shopContent.appendChild(waterItem);

    shopContent.style.display = 'flex';

    document.querySelectorAll('.buy-btn').forEach(btn => {
        addSafeClickListener(btn, () => buyVegetable(btn.dataset.id, 'farm'));
    });

    document.querySelectorAll('.buy-pi-btn').forEach(btn => {
        addSafeClickListener(btn, () => buyVegetable(btn.dataset.id, 'pi'));
    });
}

// ===================== ADD TO INVENTORY =====================
function addToInventory(type, veg, qty = 1) {
    if (!veg?.id) return;

    const index = inventory.findIndex(item =>
        item && item.type === type && item.vegetable?.id === veg.id
    );

    if (index !== -1) {
        inventory[index].quantity += qty;
    } else {
        inventory.push({ type, vegetable: veg, quantity: qty });
    }

    savePlayerData();
}

// ===================== BUY VEGETABLE / WATER =====================
let isSaving = false;

async function buyVegetable(id, currency) {
    if (isSaving) return;
    isSaving = true;

    try {
        const lang = langData[currentLang] || {};
        const btnSelector = currency === 'farm' ? `.buy-btn[data-id="${id}"]` : `.buy-pi-btn[data-id="${id}"]`;
        const button = document.querySelector(btnSelector);

        if (id === 'water') {
            const price = currency === 'farm' ? 100 : 0.0001;
            const hasEnough = currency === 'farm' ? farmCoins >= price : piBalance >= price;

            if (hasEnough) {
                if (currency === 'farm') farmCoins -= price;
                else piBalance -= price;

                water += 10;
                updateWallet();
                showTransactionAnimation(`-${price}${currency === 'pi' ? ' PI' : ''}`, false, button);
                playBuyingSound();
                await savePlayerData();
            } else {
                showNotification(currency === 'farm' ? lang.notEnoughCoins || 'Not Enough Coins!' : lang.notEnoughPi || 'Not Enough PI!');
            }

            isSaving = false;
            return;
        }

        const veg = vegetables.find(v => v.id === id);
        if (!veg) {
            console.warn(`Vegetable with id "${id}" not found`);
            isSaving = false;
            return;
        }

        const price = currency === 'farm' ? veg.farmPrice : veg.piPrice;
        const hasEnough = currency === 'farm' ? farmCoins >= price : piBalance >= price;

        if (hasEnough) {
            if (currency === 'farm') farmCoins -= price;
            else piBalance -= price;

            addToInventory('seed', veg, 1);
            updateWallet();
            renderInventory();
            showTransactionAnimation(`-${price}${currency === 'pi' ? ' PI' : ''}`, false, button);
            playBuyingSound();
            await savePlayerData();
        } else {
            showNotification(currency === 'farm' ? lang.notEnoughCoins || 'Not Enough Coins!' : lang.notEnoughPi || 'Not Enough PI!');
        }
    } catch (e) {
        console.error('Error in buyVegetable:', e.message);
        showNotification('Error during purchase');
    }

    isSaving = false;
}

// ===================== RENDER INVENTORY =====================
function renderInventory() {
    const invEl = document.getElementById('inventory-content');
    if (!invEl) return console.error('inventory-content element not found');

    const lang = langData[currentLang] || {};
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
            <p>${lang.quantityLabel || 'Quantity'}: ${item.quantity}</p>
        `;
        invEl.appendChild(div);
        hasItems = true;
    });

    if (!hasItems) {
        const noItem = document.createElement('p');
        noItem.textContent = lang.noInventory || 'No items in inventory.';
        invEl.appendChild(noItem);
    }

    const sellBtn = document.createElement('button');
    sellBtn.textContent = lang.sellToShop || 'Sell to Shop';
    sellBtn.classList.add('sell-to-shop-btn');
    addSafeClickListener(sellBtn, () => {
        openSellTab();
        playMenuSound();
    });

    invEl.appendChild(sellBtn);
}

// ===========================
// RENDER SELL SECTION
// ===========================
function renderSellSection() {
    const sellContentElement = document.getElementById('sell-content');
    if (!sellContentElement) {
        console.error('[renderSellSection] Element #sell-content not found');
        return;
    }

    const lang = langData[currentLang];
    if (!lang) {
        sellContentElement.innerHTML = '<p style="color:red;">Language data not loaded</p>';
        return;
    }

    sellContentElement.innerHTML = '';

    // Kelompokkan item hasil panen
    const groupedHarvest = {};
    inventory.forEach((item, index) => {
        if (item?.type === 'harvest') {
            const vegId = item.vegetable.id;
            if (!groupedHarvest[vegId]) {
                groupedHarvest[vegId] = { ...item, index };
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

    // Tampilkan setiap item panen yang bisa dijual
    harvestItems.forEach((item) => {
        const sellPrice = item.vegetable.sellPrice;
        if (typeof sellPrice !== 'number') {
            console.warn(`[renderSellSection] Missing sellPrice for ${item.vegetable.id}, skipping.`);
            return;
        }

        const sellDiv = document.createElement('div');
        sellDiv.className = 'sell-item';
        sellDiv.innerHTML = `
            <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img">
            <h3>${item.vegetable.name[currentLang]}</h3>
            <p>${lang.quantityLabel || 'Quantity'}: ${item.quantity}</p>
            <p>${lang.sellPriceLabel || 'Sell Price'}: ${sellPrice} Farm Coins</p>
            <button class="sell-btn" data-index="${item.index}">${lang.sellLabel || 'Sell'}</button>
        `;
        sellContentElement.appendChild(sellDiv);
    });

    // Tambahkan event listener ke tombol-tombol jual
    sellContentElement.querySelectorAll('.sell-btn').forEach(btn => {
        addSafeClickListener(btn, () => {
            const index = parseInt(btn.getAttribute('data-index'));
            if (!isNaN(index)) sellItem(index);
        });
    });
}

// ===========================
// SELL ITEM FUNCTION
// ===========================
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

    inventory.splice(index, 1); // Hapus dari inventori
    savePlayerData();
    updateWallet();
    renderInventory();
    renderSellSection();
    playCoinSound();
    checkLevelUp();
    checkCoinAchievement();
}

// ===========================
// BUKA TAB SELL SECARA LANGSUNG
// ===========================
function openSellTab() {
    switchTab('shop');

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
    }
}

// ===========================
// LEVEL UP CHECK
// ===========================
function checkLevelUp() {
    const lang = langData[currentLang] || {};
    while (xp >= level * 100) {
        xp -= level * 100;
        level++;
        showNotification(`${lang.levelUp || 'Level Up!'} ${level}`);
    }
    updateWallet();
}

// === Tab Navigation ===
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));

    const tabContent = document.getElementById(tab);
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
    if (tabContent && tabBtn) {
        tabContent.classList.add('active');
        tabBtn.classList.add('active');
    }

    switch (tab) {
        case 'shop': renderShop(); renderSellSection(); break;
        case 'inventory': renderInventory(); break;
        case 'achievements': renderAchievements(); break;
        case 'exchange': updateExchangeResult(); break;
    }

    playMenuSound();
}

// === Exchange System ===
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
    const amountRaw = document.getElementById("exchange-amount")?.value.replace(",", ".") || "0";
    const amount = parseFloat(amountRaw) || 0;
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
    if (resultDiv) {
        const shortDisplay = resultText.length > 25 ? resultText.substring(0, 25) + "…" : resultText;
        resultDiv.textContent = shortDisplay;
        resultDiv.title = resultText;
    }
}

async function handleExchange() {
    const amountRaw = document.getElementById("exchange-amount").value.replace(",", ".");
    const amount = parseFloat(amountRaw);
    const direction = document.getElementById("exchange-direction").value;

    if (isNaN(amount) || amount <= 0) return showNotification("Invalid amount!");

    const playerRef = ref(database, `players/${username}`);
    const snapshot = await get(playerRef);
    const data = snapshot.val();

    if (!data) return showNotification("Player data not found!");

    let pi = Number(data.piBalance || 0);
    let fc = Number(data.farmCoins || 0);
    let resultText = "";

    if (direction === "piToFc") {
        if (pi < amount) return showNotification("Not enough Pi!");
        const converted = Math.floor(amount * currentExchangeRate);
        pi -= amount;
        fc += converted;
        resultText = converted.toLocaleString();
    } else {
        if (fc < amount) return showNotification("Not enough FC!");
        const converted = amount / currentExchangeRate;
        fc -= amount;
        pi += converted;
        resultText = converted.toFixed(6);
    }

    pi = Math.round(pi * 1e6) / 1e6;
    fc = Math.floor(fc);

    document.getElementById("exchange-loading").style.display = "block";

    setTimeout(async () => {
        try {
            await update(playerRef, { piBalance: pi, farmCoins: fc });

            const piEl = document.getElementById("pi-balance");
            const fcEl = document.getElementById("fc-balance");
            if (piEl) piEl.textContent = pi.toLocaleString(undefined, { maximumFractionDigits: 6 });
            if (fcEl) fcEl.textContent = fc.toLocaleString();

            document.getElementById("exchange-amount").value = "";
            updateExchangeResult(resultText);
            try { await coinSound.play(); } catch (err) { console.warn("Sound error:", err); }

            showNotification("Exchange success!");
        } catch (err) {
            console.error("Exchange failed:", err.message);
            showNotification("Exchange failed: " + err.message);
        } finally {
            document.getElementById("exchange-loading").style.display = "none";
        }
    }, 3000);
}

const exchangeBtn = document.getElementById("exchange-btn");
const directionSelect = document.getElementById("exchange-direction");

directionSelect.addEventListener("change", () => {
    exchangeBtn.textContent = directionSelect.value === "piToFc" ? "Exchange to FC" : "Exchange to Pi";
});
directionSelect.dispatchEvent(new Event("change"));

// === Daily Reward Modal ===
if (claimModalBtn) {
    addSafeClickListener(document.getElementById('claim-reward-btn'), async () => {
        const playerRef = ref(database, `players/${username}/lastClaim`);
        try {
            const snapshot = await get(playerRef);
            lastClaim = snapshot.val();

            const today = new Date().toISOString().split('T')[0];
            const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;

            if (lastClaimDate === today) {
                const btn = document.getElementById('claim-reward-btn');
                if (btn) {
                    btn.classList.add('claimed');
                    btn.textContent = langData[currentLang]?.claimed || 'Claimed!';
                    btn.disabled = true;
                }
                claimedToday = true;
                return;
            }

            if (isClaiming) return;
            isClaiming = true;

            if (rewardModal) rewardModal.style.display = 'block';
            const rewardText = document.getElementById('daily-reward-text');
            if (rewardText) rewardText.textContent = `${langData[currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!'}`;
        } catch (err) {
            console.error("Check reward failed:", err.message);
            showNotification("Error checking daily reward.");
            isClaiming = false;
        }
    });

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

            const btn = document.getElementById('claim-reward-btn');
            if (btn) {
                btn.classList.add('claimed');
                btn.textContent = langData[currentLang]?.claimed || 'Claimed!';
                btn.disabled = true;
            }

            checkLevelUp();
            playCoinSound();
            showNotification(langData[currentLang]?.rewardClaimed || 'Reward Claimed!');
        } catch (err) {
            console.error("Claim reward failed:", err.message);
            showNotification("Error claiming reward: " + err.message);
        } finally {
            isClaiming = false;
        }
    });
}

// === Daily Reward Check ===
function checkDailyReward() {
    if (!username) return;
    const today = new Date().toISOString().split('T')[0];
    const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;

    const btn = document.getElementById('claim-reward-btn');
    if (!btn) return;

    if (lastClaimDate === today) {
        btn.classList.add('claimed');
        btn.textContent = langData[currentLang]?.claimed || 'Claimed!';
        btn.disabled = true;
        claimedToday = true;
    } else {
        btn.classList.remove('claimed');
        btn.textContent = langData[currentLang]?.claimDailyReward || 'Claim Daily Reward';
        btn.disabled = false;
        claimedToday = false;
    }
}

// === Notification Popup ===
function showNotification(message) {
    const el = document.getElementById('notification');
    if (!el) return;

    el.textContent = message;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 3000);
}

// === Floating Coin Animation ===
function showTransactionAnimation(amount, isPositive, buttonElement) {
    const anim = document.createElement('div');
    anim.classList.add('transaction-animation', isPositive ? 'positive' : 'negative');
    anim.textContent = amount;

    document.body.appendChild(anim);
    const rect = buttonElement?.getBoundingClientRect() || { left: 0, top: 0, width: 0 };
    anim.style.left = `${rect.left + rect.width / 2}px`;
    anim.style.top = `${rect.top - 20}px`;

    setTimeout(() => anim.remove(), 1000);
}

// === Achievements ===
function checkHarvestAchievement() {
    if (harvestCount >= 100 && !achievements.harvest) {
        achievements.harvest = true;
        farmCoins += 500;
        showNotification(langData[currentLang]?.harvestAchievement || 'Achievement Unlocked: Harvest Master! +500 Coins');
        updateWallet();
        renderAchievements();
    }
}

function checkCoinAchievement() {
    if (farmCoins >= 10000 && !achievements.coins) {
        achievements.coins = true;
        water += 100;
        showNotification(langData[currentLang]?.coinAchievement || 'Achievement Unlocked: Coin Collector! +100 Water');
        updateWallet();
        renderAchievements();
    }
}

function renderAchievements() {
    const container = document.getElementById('achievements-content');
    if (!container) return;

    container.innerHTML = ''; // clear

    if (achievements.harvest) {
        const el = document.createElement('div');
        el.className = 'achievement unlocked';
        el.textContent = langData[currentLang]?.harvestAchievement || 'Harvest Master';
        container.appendChild(el);
    }

    if (achievements.coins) {
        const el = document.createElement('div');
        el.className = 'achievement unlocked';
        el.textContent = langData[currentLang]?.coinAchievement || 'Coin Collector';
        container.appendChild(el);
    }

    // Tambahkan achievement lainnya di sini...
}

// Update UI text based on selected language
function updateUIText() {
    const lang = langData[currentLang];
    if (!lang) return;

    const mappings = [
        { selector: '#title', key: 'title', defaultText: 'Harvest Pi' },
        { selector: '#game-title', key: 'title', defaultText: 'Harvest Pi' },
        { selector: '#start-text', key: 'startGame', defaultText: 'Start Game' },
        { selector: '#lang-toggle', key: 'switchLang', defaultText: 'Switch Language (EN/ID)' },
        { selector: '#game-lang-toggle', key: 'switchLang', defaultText: 'Switch Language (EN/ID)' },
        { selector: '#upgrades-title', key: 'upgradesTitle', defaultText: 'Upgrades' },
        { selector: '#upgrades-content', key: 'comingSoon', defaultText: 'Coming soon...' },
        { selector: '#exchange-title', key: 'exchangeTitle', defaultText: 'Live Exchange' },
        { selector: '#exchange-rate', key: 'exchangeRate', defaultText: '1 PI = 1,000,000 Farm Coins' },
        { selector: '#exchange-amount', key: 'enterPiAmount', attr: 'placeholder', defaultText: 'Enter PI amount' },
        { selector: '#exchange-result-label', key: 'farmCoinsLabel', prefix: '', suffix: ': ', defaultText: 'Farm Coins: ' },
        { selector: '#exchange-btn', key: 'exchangeButton', defaultText: 'Exchange to Farm Coins' },
        { selector: '#leaderboard-title', key: 'leaderboardTitle', defaultText: 'Leaderboard' },
        { selector: '#leaderboard-content', key: 'comingSoon', defaultText: 'Coming soon...' },
        { selector: '#settings-title', key: 'settingsTitle', defaultText: 'Settings' },
        { selector: '#music-volume-label', key: 'musicVolumeLabel', defaultText: 'Music Volume:' },
        { selector: '#voice-volume-label', key: 'voiceVolumeLabel', defaultText: 'Voice/SFX Volume:' },
        { selector: '#exit-game-btn', key: 'exitGame', defaultText: 'Exit' },
        { selector: '#daily-reward-title', key: 'dailyRewardTitle', defaultText: 'Daily Reward' },
        { selector: '#claim-modal-btn', key: 'claimButton', defaultText: 'Claim' },
        { selector: '#shop-buy-tab', key: 'buyTab', defaultText: 'Buy' },
        { selector: '#shop-sell-tab', key: 'sellTab', defaultText: 'Sell' },
        { selector: '#sell-section-title', key: 'sellSectionTitle', defaultText: 'Sell Items' },
        { selector: '#finance-title', key: 'financeTitle', defaultText: 'Finance' },
    ];

    mappings.forEach(({ selector, key, attr, prefix = '', suffix = '', defaultText }) => {
        const element = document.querySelector(selector);
        const text = lang[key] || defaultText;
        if (element) {
            if (attr === 'placeholder') {
                element.placeholder = text;
            } else {
                element.textContent = prefix + text + suffix;
            }
        }
    });

    // Tab buttons with data-tab attribute
    const tabLangMap = {
        farm: 'farmTab',
        shop: 'shopTab',
        upgrades: 'upgradesTab',
        inventory: 'inventoryTab',
        exchange: 'exchangeTab',
        finance: 'financeTab',
        leaderboard: 'leaderboardTab',
        achievements: 'achievementsTab'
    };

    Object.entries(tabLangMap).forEach(([tab, key]) => {
        const tabElement = document.querySelector(`.tab-btn[data-tab="${tab}"]`);
        if (tabElement) {
            tabElement.textContent = lang[key] || tab.charAt(0).toUpperCase() + tab.slice(1);
        }
    });

    // Refresh dynamic components
    updateWallet();
    renderShop();
    renderInventory();
    renderSellSection();
    renderAchievements();
    checkDailyReward();
}

// ==== Fitur Deposit ====
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

if (
  !realDepositBtn || !realDepositMsg || !depositAmountInput || !depositPopup ||
  !popupAmount || !popupMemo || !popupUsername || !popupTransferAmount ||
  !popupTransferMemo || !popupWalletAddress || !countdownTimer ||
  !copyWalletBtn || !copyMemoBtn || !confirmDepositBtn || !cancelDepositBtn
) {
  console.error('❌ Salah satu elemen deposit tidak ditemukan.');
  return;
}

let countdownInterval = null;
const countdownDuration = 100;
const walletAddress = 'GCUPGJNSX6GQDI7MTNBVES6LHDCTP3QHZHPWJG4BKBQVG4L2CW6ZULPN';

// Reset semua listener agar tidak dobel jika diklik berkali-kali
copyWalletBtn.onclick = null;
copyMemoBtn.onclick = null;
confirmDepositBtn.onclick = null;
cancelDepositBtn.onclick = null;

// Tombol utama deposit
realDepositBtn.addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) {
    realDepositMsg.textContent = 'Please login first.';
    return;
  }

  const email = user.email;
  const encodedEmail = encodeEmail(email);
  const playersRef = ref(database, 'players');
  const snapshot = await get(playersRef);
  const playersData = snapshot.val() || {};

  let username = Object.keys(playersData).find(
    uname => playersData[uname].email === email
  );

  if (!username) {
    realDepositMsg.textContent = 'Username not found. Please register.';
    return;
  }

  const amount = parseFloat(depositAmountInput.value);
  if (!amount || amount < 1) {
    realDepositMsg.textContent = 'Minimum deposit is 1 PI.';
    return;
  }

  const today = new Date().toISOString().split('T')[0];
  const depositLimitRef = ref(database, `depositLimits/${encodedEmail}/${today}`);
  const depositSnapshot = await get(depositLimitRef);
  const depositData = depositSnapshot.val();
  let dailyTotal = depositData ? depositData.total : 0;

  if (dailyTotal + amount > 1000) {
    realDepositMsg.textContent = 'Daily deposit limit exceeded (1000 PI).';
    return;
  }

  const memo = `deposit_${username}_${Date.now()}`;

  // Tampilkan popup konfirmasi
  popupAmount.textContent = amount;
  popupMemo.textContent = memo;
  popupUsername.textContent = username;
  popupTransferAmount.textContent = amount;
  popupTransferMemo.textContent = memo;
  popupWalletAddress.textContent = walletAddress;
  depositPopup.style.display = 'block';

  realDepositMsg.textContent = '';
  realDepositBtn.disabled = true;
  depositAmountInput.disabled = true;

  // Mulai countdown timeout
  let timeLeft = countdownDuration;
  countdownTimer.textContent = `Time left: ${timeLeft}s`;

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    timeLeft--;
    countdownTimer.textContent = `Time left: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      depositPopup.style.display = 'none';
      realDepositMsg.textContent = 'Deposit request timed out.';
      realDepositBtn.disabled = false;
      depositAmountInput.disabled = false;
    }
  }, 1000);

  // Copy Wallet
  copyWalletBtn.onclick = () => {
    copyToClipboard(walletAddress, copyWalletBtn);
  };

  // Copy Memo
  copyMemoBtn.onclick = () => {
    copyToClipboard(memo, copyMemoBtn);
  };

  // Konfirmasi Deposit
  confirmDepositBtn.onclick = async () => {
    clearInterval(countdownInterval);
    depositPopup.style.display = 'none';

    try {
      const playerRef = ref(database, `players/${username}`);
      const snapshot = await get(playerRef);
      let totalDeposit = amount;

      if (!snapshot.exists()) {
        await set(playerRef, { totalDeposit: amount, piBalance: 0, farmCoins: 0 });
      } else {
        const playerData = snapshot.val();
        totalDeposit += playerData.totalDeposit || 0;
        await update(playerRef, { totalDeposit });
      }

      dailyTotal += amount;
      await set(depositLimitRef, { total: dailyTotal });

      const depositHistoryRef = ref(database, `depositHistory/${encodedEmail}`);
      await push(depositHistoryRef, {
        amount,
        timestamp: Date.now(),
        memo,
        status: 'pending'
      });

      realDepositMsg.textContent = 'Deposit request submitted. Awaiting confirmation...';
    } catch (error) {
      console.error('Deposit error:', error.message);
      realDepositMsg.textContent = 'Error: ' + error.message;
    } finally {
      realDepositBtn.disabled = false;
      depositAmountInput.disabled = false;
      depositAmountInput.value = '';
    }
  };

  // Batal Deposit
  cancelDepositBtn.onclick = () => {
    clearInterval(countdownInterval);
    depositPopup.style.display = 'none';
    realDepositMsg.textContent = 'Deposit request cancelled.';
    realDepositBtn.disabled = false;
    depositAmountInput.disabled = false;
  };
});

// ========================
// Fitur Withdraw
// ========================

const withdrawBtn = document.getElementById("withdraw-btn");
const withdrawAmountInput = document.getElementById("withdraw-amount");
const withdrawMsg = document.getElementById("withdraw-msg");
const withdrawPopup = document.getElementById("withdraw-popup");
const withdrawPopupAmount = document.getElementById("withdraw-popup-amount");
const withdrawPopupUsername = document.getElementById("withdraw-popup-username");
const withdrawPopupWallet = document.getElementById("withdraw-popup-wallet");
const withdrawWalletInput = document.getElementById("withdraw-wallet-input");
const withdrawCountdownTimer = document.getElementById("withdraw-countdown-timer");
const confirmWithdrawBtn = document.getElementById("confirm-withdraw");
const cancelWithdrawBtn = document.getElementById("cancel-withdraw");

let withdrawCountdownInterval = null;
const withdrawCountdownDuration = 100; // dalam detik

function resetWithdrawUI() {
  withdrawPopup.style.display = 'none';
  withdrawBtn.disabled = false;
  withdrawAmountInput.disabled = false;
  withdrawWalletInput.disabled = false;
  withdrawAmountInput.value = '';
  withdrawWalletInput.value = '';
}

withdrawBtn?.addEventListener('click', async () => {
  console.log('Tombol withdraw diklik');

  const user = auth.currentUser;
  if (!user) {
    withdrawMsg.textContent = 'Please login first.';
    return;
  }

  const email = user.email;
  const encodedEmail = encodeEmail(email);
  const playersRef = ref(database, 'players');
  const snapshot = await get(playersRef);
  const playersData = snapshot.val() || {};

  let username = null;
  for (const playerUsername in playersData) {
    if (playersData[playerUsername].email === email) {
      username = playerUsername;
      break;
    }
  }

  if (!username) {
    withdrawMsg.textContent = 'Username not found. Please register.';
    return;
  }

  const amount = parseFloat(withdrawAmountInput.value);
  if (!amount || amount < 1) {
    withdrawMsg.textContent = 'Minimum withdraw is 1 PI.';
    return;
  }

  const playerRef = ref(database, `players/${username}`);
  const playerSnapshot = await get(playerRef);
  if (!playerSnapshot.exists()) {
    withdrawMsg.textContent = 'Player data not found.';
    return;
  }

  const playerData = playerSnapshot.val();
  const piBalance = playerData.piBalance || 0;

  if (amount > piBalance) {
    withdrawMsg.textContent = 'Insufficient PI balance.';
    return;
  }

  const walletAddress = withdrawWalletInput.value.trim();
  if (!walletAddress) {
    withdrawMsg.textContent = 'Please enter a valid wallet address.';
    return;
  }

  // Tampilkan popup konfirmasi
  withdrawMsg.textContent = '';
  withdrawBtn.disabled = true;
  withdrawAmountInput.disabled = true;
  withdrawWalletInput.disabled = true;

  withdrawPopupAmount.textContent = amount;
  withdrawPopupUsername.textContent = username;
  withdrawPopupWallet.textContent = walletAddress;
  withdrawPopup.style.display = 'block';

  // Jalankan countdown
  let timeLeft = withdrawCountdownDuration;
  withdrawCountdownTimer.textContent = `Time left: ${timeLeft}s`;
  clearInterval(withdrawCountdownInterval);
  withdrawCountdownInterval = setInterval(() => {
    timeLeft--;
    withdrawCountdownTimer.textContent = `Time left: ${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(withdrawCountdownInterval);
      resetWithdrawUI();
      withdrawMsg.textContent = 'Withdraw request timed out.';
    }
  }, 1000);

  // Set event handler hanya sekali
  confirmWithdrawBtn.onclick = async () => {
    clearInterval(withdrawCountdownInterval);
    withdrawPopup.style.display = 'none';

    try {
      const updatedPiBalance = piBalance - amount;
      await update(playerRef, { piBalance: updatedPiBalance });

      const withdrawHistoryRef = ref(database, `withdrawHistory/${encodedEmail}`);
      await push(withdrawHistoryRef, {
        amount,
        walletAddress,
        timestamp: Date.now(),
        status: 'pending'
      });

      withdrawMsg.textContent = 'Withdraw request submitted. Awaiting confirmation...';
      console.log('Withdraw request submitted:', { amount, walletAddress });
    } catch (error) {
      console.error('Error submitting withdraw:', error.message);
      withdrawMsg.textContent = 'Error submitting withdraw: ' + error.message;
    } finally {
      resetWithdrawUI();
    }
  };

  cancelWithdrawBtn.onclick = () => {
    clearInterval(withdrawCountdownInterval);
    resetWithdrawUI();
    withdrawMsg.textContent = 'Withdraw request cancelled.';
  };
});
