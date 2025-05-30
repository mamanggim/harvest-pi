// PART 1 //
import { auth, database, ref, onValue } from '../firebase/firebase-config.js';
import { addSafeClickListener } from './utils.js';
import { handleLogin, handleRegister, switchToLogin, switchToRegister, loadPlayerData, handleReferral } from './auth.js';
import { initializeGame, startGame, enterFullScreen, exitFullScreen } from './game.js';
import { initAudioControls, playMenuSound } from './audio.js';
import { switchTab, toggleLanguage } from './ui.js';
import { loadExchangeRate, handleExchange, updateExchangeResult } from './exchange.js';
import { handleDeposit } from './finance.js';
import { checkDailyReward } from './achievements.js';
import { initializePlots } from './farm-logic.js';
import { renderShop, renderSellSection } from './shop.js';
import { renderInventory } from './inventory.js';

// Variabel global
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
let currentLang = localStorage.getItem('language') || 'en';
let farmPlots = [];
let harvestCount = 0;
let achievements = { harvest: false, coins: false };
let username = localStorage.getItem('username');
let lastClaim = null;
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;

document.addEventListener('DOMContentLoaded', () => {
    const elements = {
        'start-text': () => startGame(),
        'lang-toggle': () => toggleLanguage(),
        'game-lang-toggle': () => toggleLanguage(),
        'settings-btn': () => { document.getElementById('settings-modal').style.display = 'block'; playMenuSound(); },
        'game-settings-btn': () => { document.getElementById('settings-modal').style.display = 'block'; playMenuSound(); },
        'close-settings': () => { document.getElementById('settings-modal').style.display = 'none'; playMenuSound(); },
        'reward-modal-close': () => { document.getElementById('reward-modal').style.display = 'none'; playMenuSound(); },
        'fullscreen-toggle': () => { document.fullscreenElement ? exitFullScreen() : enterFullScreen(); playMenuSound(); },
        'exit-game-btn': () => { if (bgMusic) bgMusic.pause(); if (bgVoice) bgVoice.pause(); window.location.reload(); },
        'exchange-btn': () => handleExchange(),
        'claim-reward-btn': () => {
            document.getElementById('reward-modal').style.display = 'block';
            document.getElementById('daily-reward-text').textContent = langData[currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!';
        },
        'shop-buy-tab': () => {
            document.getElementById('shop-buy-tab').classList.add('active');
            document.getElementById('shop-sell-tab').classList.remove('active');
            document.getElementById('shop-content').style.display = 'block';
            document.getElementById('sell-section').style.display = 'none';
            renderShop();
            playMenuSound();
        },
        'shop-sell-tab': () => {
            document.getElementById('shop-sell-tab').classList.add('active');
            document.getElementById('shop-buy-tab').classList.remove('active');
            document.getElementById('shop-content').style.display = 'none';
            document.getElementById('sell-section').style.display = 'block';
            renderSellSection();
            playMenuSound();
        },
        'login-email-btn': (e) => handleLogin(e),
        'register-email-btn': (e) => handleRegister(e),
        'register-link': () => switchToRegister(),
        'login-link': () => switchToLogin(),
        'copy-link-btn': () => {
            const referralLink = document.getElementById('referral-link');
            if (referralLink) copyToClipboard(referralLink.textContent, document.getElementById('copy-link-btn'));
        },
    };

    Object.entries(elements).forEach(([id, callback]) => {
        const el = document.getElementById(id);
        if (el) addSafeClickListener(el, callback);
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
        addSafeClickListener(btn, () => switchTab(btn.getAttribute('data-tab')));
    });

    const exchangeAmount = document.getElementById('exchange-amount');
    if (exchangeAmount) exchangeAmount.addEventListener('input', updateExchangeResult);

    const directionSelect = document.getElementById('exchange-direction');
    if (directionSelect) directionSelect.addEventListener('change', updateExchangeResult);

    initAudioControls();
    initializeGame();
    initializePlots();
    loadExchangeRate();
    handleDeposit();
    checkDailyReward();

    auth.onAuthStateChanged(user => {
        if (user && username) {
            loadPlayerData(username);
            handleReferral();
        } else {
            switchToLogin();
        }
    });
});

// PART 2 //
export async function loadData() {
    try {
        const langRes = await fetch('../data/lang.json');
        langData = await langRes.json();
        console.log('Language data loaded:', langData);
        const vegRes = await fetch('../data/vegetables.json');
        vegetables = (await vegRes.json()).vegetables;
        console.log('Vegetables data loaded:', vegetables);
    } catch (error) {
        console.error('Error loading data:', error.message);
        showNotification('Error loading game data.');
    }
}

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

export function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        button.textContent = 'Copied!';
        setTimeout(() => button.textContent = 'Copy', 2000);
    }).catch(err => console.error('Gagal copy:', err));
}

// PART 3 //
import { auth, database, ref, onValue, set, update, get } from '../firebase/firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { showNotification } from './ui.js';
import { updateWallet, savePlayerData } from './game.js';
import { initializePlots } from './farm-logic.js';
import { renderShop, renderSellSection } from './shop.js';
import { renderInventory } from './inventory.js';
import { renderAchievements, checkDailyReward } from './achievements.js';

export function encodeEmail(email) {
    return email.replace('@', '_at_').replace(/\./g, '_dot_');
}

export function resolveUserKey(role, email, username) {
    return role === 'admin' ? encodeEmail(email) : username;
}

export function switchToLogin() {
    const loginScreen = document.getElementById('login-screen');
    const registerScreen = document.getElementById('register-screen');
    if (loginScreen && registerScreen) {
        loginScreen.style.display = 'flex';
        registerScreen.style.display = 'none';
    }
}

export function switchToRegister() {
    const loginScreen = document.getElementById('login-screen');
    const registerScreen = document.getElementById('register-screen');
    if (loginScreen && registerScreen) {
        loginScreen.style.display = 'none';
        registerScreen.style.display = 'flex';
    }
}

export async function handleLogin(e) {
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
        if (playerData.status !== 'approved') throw new Error(`Account ${playerData.status}. Contact admin.`);

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
            window.location.href = '../admin/admin.html';
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

export async function handleRegister(e) {
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
        if (snapshot.exists()) throw new Error('Username already taken.');

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await set(playerRef, {
            email, username: normalizedUsername, role: 'user', status: 'pending',
            farmCoins: 0, piBalance: 0, water: 0, level: 1, xp: 0,
            inventory: [], farmPlots: [], harvestCount: 0,
            achievements: { harvest: false, coins: false }, lastClaim: null,
            claimedToday: false, totalDeposit: 0, referralEarnings: 0
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

export function loadPlayerData(userKey) {
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
                farmCoins: 0, piBalance: 0, water: 0, level: 1, xp: 0,
                inventory: [], farmPlots: [], harvestCount: 0,
                achievements: { harvest: false, coins: false }, totalDeposit: 0,
                claimedToday: false, referralEarnings: 0, email: localStorage.getItem('email'),
                username: localStorage.getItem('username'), status: 'approved', role: 'user'
            };
            set(playerRef, init).then(() => console.log('Initialized new user data:', userKey))
                .catch(err => {
                    console.error('Failed to init user data:', err.message);
                    showNotification('Failed to init data');
                });
            return;
        }

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

export function handleReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralUsername = urlParams.get('referral');
    if (referralUsername && username && referralUsername !== username) {
        const referrerRef = ref(database, `players/${referralUsername}`);
        get(referrerRef).then((snapshot) => {
            if (snapshot.exists()) {
                const referrerData = snapshot.val();
                const newReferralEarnings = (referrerData.referralEarnings || 0) + 100;
                update(referrerRef, { referralEarnings: newReferralEarnings })
                    .then(() => {
                        console.log(`Referral bonus given to ${referralUsername}`);
                        showNotification('Referral bonus given to referrer!');
                    })
                    .catch(err => console.error('Error updating referral earnings:', err));
            }
        }).catch(err => console.error('Error fetching referrer data:', err));
    }
}

// PART 4 //
import { loadData } from './utils.js';
import { showNotification, updateUIText } from './ui.js';
import { ref, update } from '../firebase/firebase-config.js';

export async function savePlayerData() {
    if (!username || !isDataLoaded) return;
    const playerRef = ref(database, `players/${username}`);
    const dataToSave = {
        farmCoins, piBalance, water, level, xp, inventory,
        farmPlots, harvestCount, achievements, lastClaim, claimedToday
    };
    try {
        await update(playerRef, dataToSave);
        console.log('Player data saved');
    } catch (error) {
        console.error('Error saving player data:', error.message);
        showNotification('Error saving data');
    }
}

export function updateWallet() {
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
    if (xpFillElement) {
        const xpPercentage = (xp / (level * 100)) * 100;
        xpFillElement.style.width = `${xpPercentage}%`;
    }
    if (farmCoinBalanceElement) farmCoinBalanceElement.textContent = farmCoins;
    if (piCoinBalanceElement) piCoinBalanceElement.textContent = piBalance.toFixed(6);

    savePlayerData();
}

export async function initializeGame() {
    try {
        await loadData();
        updateUIText();
        setTimeout(() => {
            const loadingScreenElement = document.getElementById('loading-screen');
            const loginScreenElement = document.getElementById('login-screen');
            if (loadingScreenElement && loginScreenElement) {
                console.log('Hiding loading screen, showing login screen');
                loadingScreenElement.style.display = 'none';
                switchToLogin();
            } else {
                console.error('Loading or Login screen element not found');
            }
        }, 1000);
    } catch (error) {
        console.error('Error initializing game:', error.message);
        showNotification('Error initializing game. Please reload.');
        setTimeout(() => {
            const loadingScreenElement = document.getElementById('loading-screen');
            const loginScreenElement = document.getElementById('login-screen');
            if (loadingScreenElement && loginScreenElement) {
                loadingScreenElement.style.display = 'none';
                switchToLogin();
            }
        }, 1000);
    }
}

export function startGame() {
    if (!username) {
        console.warn('Please login with Email first!');
        return;
    }
    console.log('Starting game...');
    const startScreenElement = document.getElementById('start-screen');
    const gameScreenElement = document.getElementById('game-screen');
    const exitGameBtnElement = document.getElementById('exit-game-btn');
    if (startScreenElement && gameScreenElement && exitGameBtnElement) {
        startScreenElement.style.display = 'none';
        startScreenElement.classList.remove('center-screen');
        gameScreenElement.style.display = 'flex';
        gameScreenElement.classList.add('fade-in');
        exitGameBtnElement.style.display = 'block';
    }
    isAudioPlaying = false;
    playBgMusic();
    playBgVoice();
    switchTab('farm');
    enterFullScreen();
}

export function enterFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.mozRequestFullScreen) elem.mozRequestFullScreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
}

export function exitFullScreen() {
    if (document.exitFullscreen) document.exitFullscreen();
    else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    else if (document.msExitFullscreen) document.msExitFullscreen();
}

// PART 5 //
const bgMusic = document.getElementById('bg-music');
const bgVoice = document.getElementById('bg-voice');
const harvestingSound = document.getElementById('harvesting-sound');
const wateringSound = document.getElementById('watering-sound');
const plantingSound = document.getElementById('planting-sound');
const menuSound = document.getElementById('menu-sound');
const buyingSound = document.getElementById('buying-sound');
const coinSound = document.getElementById('coin-sound');

export function playBgMusic() {
    if (bgMusic && !isAudioPlaying) {
        const playPromise = bgMusic.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                console.log('Background music started successfully');
                isAudioPlaying = true;
            }).catch(e => {
                console.log('BG Music failed to start:', e.message);
                setTimeout(() => bgMusic.play().catch(err => console.log('Retry BG Music failed:', err.message)), 100);
            });
        }
    }
}

export function playBgVoice() {
    if (bgVoice && !isAudioPlaying) {
        const playPromise = bgVoice.play();
        if (playPromise !== undefined) {
            playPromise.then(() => console.log('Background voice started successfully'))
                .catch(e => {
                    console.log('BG Voice failed to start:', e.message);
                    setTimeout(() => bgVoice.play().catch(err => console.log('Retry BG Voice failed:', err.message)), 100);
                });
        }
    }
}

export function playHarvestingSound() {
    if (harvestingSound) harvestingSound.play().catch(e => console.log('Harvest sound failed:', e.message));
}

export function playWateringSound() {
    if (wateringSound) wateringSound.play().catch(e => console.log('Watering sound failed:', e.message));
}

export function playPlantingSound() {
    if (plantingSound) plantingSound.play().catch(e => console.log('Planting sound failed:', e.message));
}

export function playMenuSound() {
    if (menuSound) menuSound.play().catch(e => console.log('Menu sound failed:', e.message));
}

export function playBuyingSound() {
    if (buyingSound) buyingSound.play().catch(e => console.log('Buying sound failed:', e.message));
}

export function playCoinSound() {
    if (coinSound) coinSound.play().catch(e => console.log('Coin sound failed:', e.message));
}

export function initAudioControls() {
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

function updateVolumes() {
    const musicVolume = parseFloat(localStorage.getItem('musicVolume') || 50);
    const voiceVolume = parseFloat(localStorage.getItem('voiceVolume') || 50);
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

// PART 6 //
import { renderShop, renderSellSection } from './shop.js';
import { renderInventory } from './inventory.js';
import { renderAchievements } from './achievements.js';
import { updateExchangeResult } from './exchange.js';
import { playMenuSound } from './audio.js';

export function switchTab(tab) {
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => btn.classList.remove('active'));

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

export function showNotification(message) {
    const notificationElement = document.getElementById('notification');
    if (!notificationElement) return;
    notificationElement.textContent = message;
    notificationElement.style.display = 'block';
    setTimeout(() => notificationElement.style.display = 'none', 3000);
}

export function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'id' : 'en';
    localStorage.setItem('language', currentLang);
    updateUIText();
}

export function updateUIText() {
    if (!langData[currentLang]) return;
    const elements = {
        'title': 'title', 'game-title': 'title', 'start-text': 'startGame',
        '.tab-btn[data-tab="farm"]': 'farmTab', '.tab-btn[data-tab="shop"]': 'shopTab',
        '.tab-btn[data-tab="upgrades"]': 'upgradesTab', '.tab-btn[data-tab="inventory"]': 'inventoryTab',
        '.tab-btn[data-tab="exchange"]': 'exchangeTab', '.tab-btn[data-tab="finance"]': 'financeTab',
        '.tab-btn[data-tab="leaderboard"]': 'leaderboardTab', '.tab-btn[data-tab="achievements"]': 'achievementsTab',
        'lang-toggle': 'switchLang', 'game-lang-toggle': 'switchLang', 'upgrades-title': 'upgradesTitle',
        'upgrades-content': 'comingSoon', 'exchange-title': 'exchangeTitle', 'exchange-rate': 'exchangeRate',
        'exchange-amount': { attr: 'placeholder', key: 'enterPiAmount' }, 'exchange-result-label': 'farmCoinsLabel',
        'exchange-btn': 'exchangeButton', 'leaderboard-title': 'leaderboardTitle', 'leaderboard-content': 'comingSoon',
        'settings-title': 'settingsTitle', 'music-volume-label': 'musicVolumeLabel', 'voice-volume-label': 'voiceVolumeLabel',
        'exit-game-btn': 'exitGame', 'daily-reward-title': 'dailyRewardTitle', 'claim-modal-btn': 'claimButton',
        'shop-buy-tab': 'buyTab', 'shop-sell-tab': 'sellTab', 'sell-section-title': 'sellSectionTitle',
        'finance-title': 'financeTitle'
    };

    Object.entries(elements).forEach(([selector, key]) => {
        const el = typeof key === 'string' ? document.querySelector(selector) : document.getElementById(selector);
        if (el) {
            if (typeof key === 'object') {
                el[key.attr] = langData[currentLang]?.[key.key] || '';
            } else {
                el.textContent = langData[currentLang]?.[key] || '';
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

// PART 7 //
import { ref, onValue, update, get } from '../firebase/firebase-config.js';
import { showNotification } from './ui.js';
import { playCoinSound } from './audio.js';

let currentExchangeRate = 1000000;

export function loadExchangeRate() {
    const rateRef = ref(database, 'exchangeRate/liveRate');
    onValue(rateRef, (snapshot) => {
        currentExchangeRate = snapshot.val() || currentExchangeRate;
        const rateEl = document.getElementById('live-rate');
        if (rateEl) rateEl.textContent = `1 Pi = ${currentExchangeRate.toLocaleString()} FC`;
        updateExchangeResult();
    });
}

export function updateExchangeResult() {
    const rawAmount = document.getElementById('exchange-amount').value.replace(',', '.');
    const amount = parseFloat(rawAmount) || 0;
    const direction = document.getElementById('exchange-direction').value;
    const result = direction === 'piToFc' ? Math.floor(amount * currentExchangeRate) : amount / currentExchangeRate;
    const resultText = `You will get: ${direction === 'piToFc' ? result.toLocaleString() : result.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
    const resultDiv = document.getElementById('exchange-result');
    resultDiv.textContent = resultText.length > 25 ? resultText.substring(0, 25) + '…' : resultText;
    resultDiv.title = resultText;
}

export async function handleExchange() {
    const rawAmount = document.getElementById('exchange-amount').value.replace(',', '.');
    const amount = parseFloat(rawAmount) || 0;
    const direction = document.getElementById('exchange-direction').value;
    const playerRef = ref(database, `players/${username}`);
    const snapshot = await get(playerRef);
    const data = snapshot.val();

    if (!data) return showNotification('Player data not found!');
    if (isNaN(amount) || amount <= 0) return showNotification('Invalid amount!');

    let piBalance = Number(data.piBalance || 0);
    let fcBalance = Number(data.farmCoins || 0);
    let resultText = '';

    if (direction === 'piToFc') {
        if (piBalance < amount) return showNotification('Not enough PI!');
        const converted = Math.floor(amount * currentExchangeRate);
        piBalance -= amount;
        fcBalance += converted;
        resultText = converted.toLocaleString();
    } else {
        if (fcBalance < amount) return showNotification('Not enough FC!');
        const converted = amount / currentExchangeRate;
        fcBalance -= amount;
        piBalance += converted;
        resultText = converted.toFixed(6);
    }

    piBalance = Math.round(piBalance * 1000000) / 1000000;
    fcBalance = Math.floor(fcBalance);

    document.getElementById('exchange-loading').style.display = 'block';
    setTimeout(async () => {
        try {
            await update(playerRef, { piBalance, farmCoins: fcBalance });
            const piElem = document.getElementById('pi-balance');
            const fcElem = document.getElementById('fc-balance');
            if (piElem) piElem.textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
            if (fcElem) fcElem.textContent = fcBalance.toLocaleString();
            document.getElementById('exchange-amount').value = '';
            updateExchangeResult();
            playCoinSound();
            showNotification('Exchange succeeded!');
        } catch (error) {
            console.error('Exchange failed:', error.message);
            showNotification('Exchange failed: ' + error.message);
        } finally {
            document.getElementById('exchange-loading').style.display = 'none';
        }
    }, 1000);
}

const exchangeBtn = document.getElementById('exchange-btn');
const directionSelect = document.getElementById('exchange-direction');
if (directionSelect) {
    directionSelect.addEventListener('change', () => {
        exchangeBtn.textContent = directionSelect.value === 'piToFc' ? 'Exchange to FC' : 'Exchange to Pi';
    });
    directionSelect.dispatchEvent(new Event('change'));
}

// PART 8 //
import { auth, database, ref, get, update, push } from '../firebase/firebase-config.js';
import { encodeEmail } from './auth.js';
import { showNotification } from './ui.js';
import { copyToClipboard } from './utils.js';

export async function handleDeposit() {
    const depositBtn = document.getElementById('real-deposit-btn');
    const message = document.getElementById('real-deposit-message');
    const amountInput = document.getElementById('deposit-amount');
    const depositPopup = document.getElementById('deposit-popup');
    const popupAmount = document.getElementById('popup-amount');
    const popupMemo = document.getElementById('popup-memo');
    const popupUsername = document.getElementById('popup-username');
    const popupTransferAmount = document.getElementById('popup-transfer-amount');
    const popupTransferMemo = document.getElementById('popup-transfer-memo');
    const popupWallet = document.getElementById('popup-wallet-address');
    const countdownTimer = document.getElementById('countdown-timer');
    const copyWalletBtn = document.getElementById('copy-wallet-btn');
    const copyMemoBtn = document.getElementById('copy-memo-btn');
    const confirmBtn = document.getElementById('confirm-deposit');
    const cancelBtn = document.getElementById('cancel-deposit');

    if (!depositBtn || !message || !amountInput || !depositPopup || !popupAmount || !popupMemo || !popupUsername ||
        !popupTransferAmount || !popupTransferMemo || !popupWallet || !countdownTimer || !copyWalletBtn || !copyMemoBtn ||
        !confirmBtn || !cancelBtn) {
        console.error('Deposit element missing.');
        return;
    }

    depositBtn.addEventListener('click', async () => {
        const user = auth.currentUser;
        if (!user) {
            message.textContent = 'Please login first.';
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
            message.textContent = 'Username not found. Please register.';
            return;
        }

        const amount = parseFloat(amountInput.value);
        if (!amount || amount < 1) {
            message.textContent = 'Minimum deposit is 1 PI.';
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const depositLimitRef = ref(database, `depositLimits/${encodedEmail}/${today}`);
        const depositSnapshot = await get(depositLimitRef);
        const dailyTotal = depositSnapshot.val()?.total || 0;
        if (dailyTotal + amount > 1000) {
            message.textContent = 'Daily deposit limit exceeded (1000 PI).';
            return;
        }

        message.textContent = '';
        depositBtn.disabled = true;
        amountInput.disabled = true;
        const walletAddress = 'GCUPGJNSX6QDI7MTNBVES6LHDCTP3QHZSHZP5WJG4BKBQVG4L2CW6ZULPN';
        const memo = `deposit_${username}_${Date.now()}`;
        popupAmount.textContent = amount;
        popupMemo.textContent = memo;
        popupUsername.textContent = username;
        popupTransferAmount.textContent = amount;
        popupTransferMemo.textContent = memo;
        popupWallet.textContent = walletAddress;
        depositPopup.style.display = 'block';

        let timeLeft = 100;
        countdownTimer.textContent = `Time left: ${timeLeft}s`;
        const countdownInterval = setInterval(() => {
            timeLeft--;
            countdownTimer.textContent = `Time left: ${timeLeft}s`;
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                depositPopup.style.display = 'none';
                depositBtn.disabled = false;
                amountInput.disabled = false;
                message.textContent = 'Deposit request timed out.';
            }
        }, 1000);

        copyWalletBtn.addEventListener('click', () => copyToClipboard(walletAddress, copyWalletBtn));
        copyMemoBtn.addEventListener('click', () => copyToClipboard(memo, copyMemoBtn));

        confirmBtn.addEventListener('click', async () => {
            clearInterval(countdownInterval);
            depositPopup.style.display = 'none';
            try {
                const playerRef = ref(database, `players/${username}`);
                const snapshot = await get(playerRef);
                let totalDeposit = snapshot.exists() ? snapshot.val().totalDeposit || 0 : 0;
                totalDeposit += amount;
                await update(playerRef, { totalDeposit });
                await set(depositLimitRef, { total: dailyTotal + amount });
                const depositHistoryRef = ref(database, `depositHistory/${encodedEmail}`);
                await push(depositHistoryRef, { amount, timestamp: Date.now(), memo, status: 'pending' });
                message.textContent = 'Deposit request submitted.';
            } catch (error) {
                console.error('Error submitting deposit:', error.message);
                message.textContent = 'Error submitting deposit: ' + error.message;
            } finally {
                depositBtn.disabled = false;
                amountInput.disabled = false;
                amountInput.value = '';
            }
        });

        cancelBtn.addEventListener('click', () => {
            clearInterval(countdownInterval);
            depositPopup.style.display = 'none';
            depositBtn.disabled = false;
            amountInput.disabled = false;
            message.textContent = 'Deposit request cancelled.';
        });
    });
}

// PART 9 //
import { addSafeClickListener } from './utils.js';
import { showNotification, langData, currentLang } from './ui.js';
import { playPlantingSound, playWateringSound, playHarvestingSound } from './audio.js';
import { savePlayerData, updateWallet } from './game.js';
import { addToInventory, renderInventory } from './inventory.js';
import { renderSellSection } from './shop.js';
import { checkHarvestAchievement } from './achievements.js';

const plotCount = 4;

export function initializePlots() {
    const farmAreaElement = document.getElementById('farm-area');
    if (!farmAreaElement) {
        console.error('farm-area element not found');
        showNotification('farm-area element not found');
        return;
    }

    farmAreaElement.innerHTML = '';
    if (!farmPlots || farmPlots.length === 0) {
        farmPlots = Array(plotCount).fill().map(() => ({
            planted: false, vegetable: null, progress: 0, watered: false,
            currentFrame: 1, countdown: 0, totalCountdown: 0
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
            plantImg.src = `../assets/img/plant/${plot.vegetable.id}/${plot.vegetable.id}_${plot.currentFrame}.png`;
            plantImg.onerror = () => plantImg.src = '../assets/img/ui/placeholder.png';
            plotContent.appendChild(plantImg);
            plantImg.classList.add('loaded');

            if (plot.currentFrame >= plot.vegetable.frames) {
                plotElement.classList.add('ready');
                plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
                countdownFill.style.width = '100%';
            } else if (plot.watered) {
                plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
                const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
                countdownFill.style.width = `${progress}%`;

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
                        plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
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
                            plantImg.src = `../assets/img/plant/${plot.vegetable.id}/${plot.vegetable.id}_${plot.currentFrame}.png`;
                            plantImg.onerror = () => plantImg.src = '../assets/img/ui/placeholder.png';
                            setTimeout(() => plantImg.classList.add('loaded'), 50);
                            if (plot.currentFrame >= plot.vegetable.frames) {
                                plotElement.classList.add('ready');
                                plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
                                clearInterval(countdownInterval);
                                countdownFill.style.width = '100%';
                            } else {
                                plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                                countdownFill.style.width = '0%';
                            }
                        } else {
                            plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
                        }
                    } else {
                        plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                        clearInterval(countdownInterval);
                        countdownFill.style.width = '0%';
                    }
                    savePlayerData();
                }, 1000);
            } else {
                plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                countdownFill.style.width = '0%';
            }
        }
    });
}

function handlePlotClick(index) {
    const plot = farmPlots[index];
    const plotElement = document.querySelectorAll('.plot')[index];
    const plotContent = plotElement.querySelector('.plot-content');
    const plotStatus = plotElement.querySelector('.plot-status');
    const countdownFill = plotElement.querySelector('.countdown-fill');

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
                plantImg.src = `../assets/img/plant/${vegetable.id}/${vegetable.id}_${plot.currentFrame}.png`;
                plantImg.onerror = () => plantImg.src = '../assets/img/ui/placeholder.png';
                plotContent.appendChild(plantImg);
                setTimeout(() => plantImg.classList.add('loaded'), 50);
            }, 800);

            plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
            countdownFill.style.width = '0%';
            inventory[seedIndex].quantity -= 1;
            if (inventory[seedIndex].quantity <= 0) inventory.splice(seedIndex, 1);

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
            waterImage.src = '../assets/img/ui/water_icon.png';
            waterImage.onerror = () => waterImage.src = '../assets/img/ui/placeholder.png';
            waterImage.classList.add('water-fly');
            waterImage.style.width = '40px';
            waterImage.style.top = '40px';
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
            showNotification(langData[currentLang]?.watered || 'Watered!');
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
                    plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
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
                        plantImg.src = `../assets/img/plant/${plot.vegetable.id}/${plot.vegetable.id}_${plot.currentFrame}.png`;
                        plantImg.onerror = () => plantImg.src = '../assets/img/ui/placeholder.png';
                        setTimeout(() => plantImg.classList.add('loaded'), 50);
                        if (plot.currentFrame >= plot.vegetable.frames) {
                            plotElement.classList.add('ready');
                            plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
                            clearInterval(countdownInterval);
                            countdownFill.style.width = '100%';
                        } else {
                            plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                            countdownFill.style.width = '0%';
                        }
                    } else {
                        plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
                    }
                } else {
                    plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                    clearInterval(countdownInterval);
                    countdownFill.style.width = '0%';
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
        const imageSrc = plot.vegetable?.shopImage || '../assets/img/ui/placeholder.png';
        flyImage.src = imageSrc;
        flyImage.onerror = () => flyImage.src = '../assets/img/ui/placeholder.png';
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
            countdownFill.style.width = '';
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

// PART 10 //
import { addSafeClickListener } from './utils.js';
import { showNotification, langData, currentLang } from './ui.js';
import { savePlayerData, updateWallet } from './game.js';
import { addToInventory, renderInventory } from './inventory.js';
import { playBuyingSound, playCoinSound } from './audio.js';

export function renderShop() {
    const shopContent = document.getElementById('shop-content');
    if (!shopContent) {
        console.error('shop-content element not found');
        return;
    }

    shopContent.innerHTML = '';
    if (!langData[currentLang]) {
        shopContent.innerHTML = '<p style="color:red;">Language data not loaded. Please reload.</p>';
        return;
    }

    if (!Array.isArray(vegetables) || vegetables.length === 0) {
        shopContent.innerHTML = `<p>${langData[currentLang]?.noItems || 'No items available in shop.'}</p>`;
        return;
    }

    vegetables.forEach(veg => {
        const vegItem = document.createElement('div');
        vegItem.classList.add('shop-item');
        const farmPrice = typeof veg.farmPrice === 'number' ? veg.farmPrice : 0;
        const piPrice = typeof veg.piPrice === 'number' ? veg.piPrice : 0;
        vegItem.innerHTML = `
            <img src="${veg.shopImage}" alt="${veg.name[currentLang]}" class="shop-item-img" onerror="this.src='../assets/img/ui/placeholder.png';">
            <h3>${veg.name[currentLang]}</h3>
            <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: ${farmPrice} Farm Coins</p>
            <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: ${piPrice} PI</p>
            <button class="buy-btn" data-id="${veg.id}">${langData[currentLang]?.buyLabel || 'Buy'} (Farm)</button>
            <button class="buy-pi-btn" data-id="${veg.id}">${langData[currentLang]?.buyLabel || 'Buy'} (PI)</button>
        `;
        shopContent.appendChild(vegItem);
    });

    const waterItem = document.createElement('div');
    waterItem.classList.add('shop-item');
    waterItem.innerHTML = `
        <img src="../assets/img/ui/water_icon.png" alt="${langData[currentLang]?.waterLabel || 'Water'}" class="shop-item-img" onerror="this.src='../assets/img/ui/placeholder.png';">
        <h3>${langData[currentLang]?.waterLabel || 'Water'}</h3>
        <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: 100 Farm Coins</p>
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

let isSaving = false;

export async function buyVegetable(id, currency) {
    if (isSaving) return;
    isSaving = true;
    try {
        if (id === 'water') {
            if (currency === 'farm') {
                if (farmCoins >= 100) {
                    farmCoins -= 100;
                    water += 10;
                    updateWallet();
                    showTransactionAnimation(`-100 ${id}`, false, document.querySelector(`.buy-btn[data-id="${id}"]`));
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
                    showTransactionAnimation(`-0.0001 PI`, false, document.querySelector(`.buy-pi-btn[data-id="${id}"]`));
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
        console.error('Error buying vegetable:', error.message);
        showNotification('Purchase failed');
    }
    isSaving = false;
}

export function showTransactionAnimation(amount, isPositive, element) {
    const animation = document.createElement('div');
    animation.classList.add('transaction-animation', isPositive ? 'positive' : 'negative');
    animation.textContent = amount;
    document.body.appendChild(animation);

    const rect = element ? element.getBoundingClientRect() : { left: 0, top: 0, width: 0 };
    animation.style.left = `${rect.left + rect.width / 2}px`;
    animation.style.top = `${rect.top - 20}px`;

    setTimeout(() => animation.remove(), 1000);
}

export function renderSellSection() {
    const sellContent = document.getElementById('sell-section');
    if (!sellContent) {
        console.error('sell-section element not found');
        return;
    }

    sellContent.innerHTML = '';
    if (!langData[currentLang]) {
        sellContent.innerHTML = '<p style="color:red;">Language data not loaded</p>';
        return;
    }

    let hasItems = false;
    const groupedHarvest = {};
    inventory.forEach((item, index) => {
        if (item && item.type === 'harvest') {
            const vegId = item.vegetable.id;
            if (!groupedHarvest[vegId]) {
                groupedHarvest[vegId] = { ...item, index };
            } else {
                groupedHarvest[vegId].quantity += item.quantity;
            }
        }
    });

    Object.values(groupedHarvest).forEach(item => {
        const sellDiv = document.createElement('div');
        sellDiv.classList.add('sell-item');
        const sellPrice = item.vegetable.sellPrice;
        if (typeof sellPrice !== 'number') {
            console.warn(`Missing sellPrice for ${item.vegetable.id}`);
            return;
        }
        sellDiv.innerHTML = `
            <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img" onerror="this.src='../assets/img/ui/placeholder.png';">
            <h3>${item.vegetable.name[currentLang]}</h3>
            <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
            <p>${langData[currentLang]?.sellPriceLabel || 'Sell Price'}: ${sellPrice} Farm Coins</p>
            <button class="sell-btn" data-index="${item.index}">${langData[currentLang]?.sellLabel || 'Sell'}</button>
        `;
        sellContent.appendChild(sellDiv);
        hasItems = true;
    });

    if (!hasItems) {
        sellContent.innerHTML = `<p>${langData[currentLang]?.noSellableItems || 'No items to sell.'}</p>`;
    }

    document.querySelectorAll('.sell-btn').forEach(btn => {
        addSafeClickListener(btn, () => sellItem(parseInt(btn.getAttribute('data-index'))));
    });
}

export function openSellSection() {
    switchTab('shop');
    document.getElementById('shop-sell-tab').click();
}

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
    if (btnElement) showTransactionAnimation(`+${totalGain}`, true, btnElement);

    inventory.splice(index, 1);
    savePlayerData();
    updateWallet();
    renderInventory();
    renderSellSection();
    playCoinSound();
}

// PART 11 //
import { addSafeClickListener } from './utils.js';
import { showNotification, langData, currentLang } from './ui.js';
import { savePlayerData } from './game.js';
import { renderSellSection, openSellSection } from './shop.js';
import { playMenuSound } from './audio.js';

export function addToInventory(type, veg, qty = 1) {
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

export function renderInventory() {
    const content = document.getElementById('inventory-content');
    if (!content) {
        console.error('inventory-content element not found');
        showNotification('inventory-content not found');
        return;
    }

    content.innerHTML = '';
    if (!langData[currentLang]) {
        console.error('Language data not loaded');
        return;
    }

    let hasItems = false;
    inventory.forEach(item => {
        if (!item || !item.vegetable) return;
        const vegItem = document.createElement('div');
        vegItem.classList.add('inventory-item');
        const isSeed = item.type === 'seed';
        const title = isSeed ? `${item.vegetable.name[currentLang]} Seed` : item.vegetable.name[currentLang];
        vegItem.innerHTML = `
            <img src="${item.vegetable.shopImage}" alt="${title}" class="shop-item-img" onerror="this.src='../assets/img/ui/placeholder.png';">
            <h3>${title}</h3>
            <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
        `;
        content.appendChild(vegItem);
        hasItems = true;
    });

    if (!hasItems) {
        content.innerHTML = `<p>${langData[currentLang]?.noInventory || 'No items in inventory.'}</p>`;
    }

    const sellButton = document.createElement('button');
    sellButton.textContent = langData[currentLang]?.sellToShop || 'Sell to Shop';
    sellButton.classList.add('sell-to-shop-btn');
    addSafeClickListener(sellButton, () => {
        openSellSection();
        playMenuSound();
    });
    content.appendChild(sellButton);
}

// PART 12 //
import { ref, update, get } from '../firebase/firebase-config.js';
import { showNotification, langData, currentLang } from './ui.js';
import { savePlayerData, updateWallet } from './game.js';
import { playCoinSound } from './audio.js';

export async function checkDailyReward() {
    if (!username) return;
    const today = new Date().toISOString().slice(0, 10);
    const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().slice(0, 10) : null;
    const button = document.getElementById('claim-reward-btn');
    if (button) {
        if (lastClaimDate === today) {
            button.classList.add('claimed');
            button.textContent = langData[currentLang]?.claimed || 'Claimed!';
            button.disabled = true;
            claimedToday = true;
        } else {
            button.classList.remove('claimed');
            button.textContent = langData[currentLang]?.claimDailyReward || 'Claim Daily Reward';
            button.disabled = false;
            claimedToday = false;
        }
    }
}

export async function claimDailyReward() {
    if (!username || isClaiming) return;
    isClaiming = true;
    const playerRef = ref(database, `players/${username}`);
    try {
        const snapshot = await get(playerRef);
        lastClaim = snapshot.val()?.lastClaim;
        const today = new Date().toISOString().split('T')[0];
        const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;

        if (lastClaimDate === today) {
            claimedToday = true;
            isClaiming = false;
            return;
        }

        farmCoins += 100;
        water += 50;
        xp += 10;
        lastClaim = new Date().toISOString();
        claimedToday = true;

        await update(playerRef, { farmCoins, water, xp, lastClaim, claimedToday });
        updateWallet();
        document.getElementById('reward-modal').style.display = 'none';
        const button = document.getElementById('claim-reward-btn');
        if (button) {
            button.classList.add('claimed');
            button.textContent = langData[currentLang]?.claimed || 'Claimed!';
            button.disabled = true;
        }
        playCoinSound();
        showNotification(langData[currentLang]?.rewardClaimed || 'Reward Claimed!');
    } catch (error) {
        console.error('Error claiming reward:', error.message);
        showNotification('Error claiming reward: ' + error.message);
    } finally {
        isClaiming = false;
    }
}

export function checkLevelUp() {
    const xpRequired = level * 100;
    while (xp >= xpRequired) {
        xp -= xpRequired;
        level++;
        showNotification(`${langData[currentLang]?.levelUp || 'Level Up!'} ${level}`);
    }
    updateWallet();
}

export function checkHarvestAchievement() {
    if (harvestCount >= 100 && !achievements.harvest) {
        achievements.harvest = true;
        farmCoins += 500;
        showNotification(langData[currentLang]?.harvestAchievement || 'Achievement Unlocked: Harvest Master! +500 Coins');
        updateWallet();
        renderAchievements();
    }
}

export function checkCoinAchievement() {
    if (farmCoins >= 10000 && !achievements.coins) {
        achievements.coins = true;
        water += 100;
        showNotification(langData[currentLang]?.coinAchievement || 'Achievement Unlocked: Coin Collector! +100 Water');
        updateWallet();
        renderAchievements();
    }
}

export function renderAchievements() {
    const content = document.getElementById('achievements-content');
    if (!content) return;
    content.innerHTML = '';

    const harvestItem = document.createElement('div');
    harvestItem.classList.add('achievement');
    harvestItem.innerHTML = `
        <h3>${langData[currentLang]?.harvestAchievementTitle || 'Harvest Master'}</h3>
        <p>${langData[currentLang]?.harvestAchievementDesc || 'Harvest 100 crops'}</p>
        <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.harvest ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
    `;
    content.appendChild(harvestItem);

    const coinItem = document.createElement('div');
    coinItem.classList.add('achievement');
    coinItem.innerHTML = `
        <h3>${langData[currentLang]?.coinAchievementTitle || 'Coin Collector'}</h3>
        <p>${langData[currentLang]?.coinAchievementDesc || 'Collect 10000 Farm Coins'}</p>
        <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.coins ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
    `;
    content.appendChild(coinItem);

    savePlayerData();
}
