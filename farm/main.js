// Import Firebase dependencies
import { database, auth } from '../firebase/firebase-config.js';
import { ref, onValue, set, update, get } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Global DOM elements
const claimModalBtn = document.getElementById('claim-modal-btn');
const rewardModal = document.getElementById('reward-modal');

// Helper to prevent rapid clicks
function addSafeClickListener(element, callback) {
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

// Global game state
let isDataLoaded = false;
let piInitialized = false;
let farmCoins = 0;
let pi = 0;
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
const plotCount = 4; // 2x2 grid
const piToFarmRate = 1000000; // 1 PI = 1,000,000 Farm Coins
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;

// Audio elements
const audioElements = {
    bgMusic: document.getElementById('bg-music'),
    bgVoice: document.getElementById('bg-voice'),
    harvestingSound: document.getElementById('harvesting-sound'),
    wateringSound: document.getElementById('watering-sound'),
    plantingSound: document.getElementById('planting-sound'),
    menuSound: document.getElementById('menu-sound'),
    buyingSound: document.getElementById('buying-sound'),
    coinSound: document.getElementById('coin-sound')
};

// Audio control functions
function playAudio(audio, errorMessage) {
    if (!audio) {
        console.warn(`${errorMessage}: Element not found`);
        return;
    }
    if (!isAudioPlaying || audio !== audioElements.bgMusic) {
        audio.play()
            .then(() => {
                if (audio === audioElements.bgMusic) isAudioPlaying = true;
                console.log(`${errorMessage} started`);
            })
            .catch(e => {
                console.warn(`${errorMessage} failed: ${e.message}`);
                setTimeout(() => audio.play().catch(err => console.warn(`Retry ${errorMessage} failed: ${err.message}`)), 100);
            });
    }
}

const playBgMusic = () => playAudio(audioElements.bgMusic, 'Background music');
const playBgVoice = () => playAudio(audioElements.bgVoice, 'Background voice');
const playHarvestingSound = () => playAudio(audioElements.harvestingSound, 'Harvest sound');
const playWateringSound = () => playAudio(audioElements.wateringSound, 'Watering sound');
const playPlantingSound = () => playAudio(audioElements.plantingSound, 'Planting sound');
const playMenuSound = () => playAudio(audioElements.menuSound, 'Menu sound');
const playBuyingSound = () => playAudio(audioElements.buyingSound, 'Buying sound');
const playCoinSound = () => playAudio(audioElements.coinSound, 'Coin sound');

// Volume controls
const musicVolumeSlider = document.getElementById('music-volume');
const voiceVolumeSlider = document.getElementById('voice-volume');

function initializeVolumeSliders() {
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
}

function updateVolumes() {
    const musicVol = Math.min(Math.max((parseFloat(localStorage.getItem('musicVolume') || 50) / 100), 0), 1);
    const voiceVol = Math.min(Math.max((parseFloat(localStorage.getItem('voiceVolume') || 50) / 100), 0), 1);

    Object.values(audioElements).forEach(audio => {
        if (audio) audio.volume = audio === audioElements.bgMusic ? musicVol : voiceVol;
    });
    console.log('Updated Volumes:', { musicVol, voiceVol });
}

// Load game data
async function loadData() {
    try {
        const [langRes, vegRes] = await Promise.all([
            fetch('/data/lang.json'),
            fetch('/data/vegetables.json')
        ]);
        langData = await langRes.json();
        vegetables = (await vegRes.json()).vegetables;
        console.log('Data loaded:', { langData, vegetables });
    } catch (error) {
        console.error('Error loading data:', error.message);
        showNotification('Error loading game data.');
    }
}

// Pi Network authentication
async function initializePiSDK() {
    if (!window.Pi) {
        console.error('Pi SDK not found');
        showNotification('Pi SDK not available.');
        return false;
    }
    try {
        await Pi.init({
            version: '2.0',
            sandbox: true,
            appId: '0k7py9pfz2zpndv3azmsx3utawgrfdkc1e1dlgfrbl4fywolpdl8q9s9c9iguvos'
        });
        piInitialized = true;
        console.log('Pi SDK initialized');
        return true;
    } catch (err) {
        console.error('Pi SDK init failed:', err);
        showNotification('Error initializing Pi SDK.');
        return false;
    }
}

async function authenticateWithPi() {
    if (!window.Pi) {
        console.error('Pi SDK not loaded');
        showNotification('Pi SDK not available.');
        return;
    }
    if (!piInitialized && !(await initializePiSDK())) return;

    try {
        const authResult = await Pi.authenticate(['username', 'payments'], onIncompletePaymentFound);
        userId = authResult.user.uid;
        localStorage.setItem('userId', userId);

        await update(ref(database, `players/${userId}`), {
            piUser: { uid: authResult.user.uid, username: authResult.user.username }
        });

        showNotification(`Logged in as ${authResult.user.username}`);
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
        loadPlayerData();
    } catch (err) {
        console.error('Pi login failed:', err);
        showNotification(`Login failed: ${err.message}`);
    }
}

async function autoLoginWithPi() {
    if (userId) {
        console.log('Using cached user:', userId);
        loadPlayerData();
        return;
    }
    if (!window.Pi || !piInitialized) await initializePiSDK();
    try {
        const auth = await Pi.authenticate(['username', 'payments'], onIncompletePaymentFound);
        userId = auth.user.uid;
        localStorage.setItem('userId', userId);
        console.log('Logged in as:', auth.user.username);
        loadPlayerData();
    } catch (err) {
        console.error('Auto login failed:', err);
        showNotification('Auto login failed.');
    }
}

function onIncompletePaymentFound(payment) {
    console.log('Found unfinished payment:', payment);
    showNotification('You have an unfinished transaction.');
}

// Load user balances
function loadUserBalances() {
    if (!userId) return;
    onValue(ref(database, `players/${userId}`), (snapshot) => {
        const data = snapshot.val() || {};
        pi = data.piBalance || 0;
        farmCoins = data.farmCoins || 0;

        const piBalanceElement = document.getElementById('pi-balance');
        const fcBalanceElement = document.getElementById('fc-balance');
        if (piBalanceElement) piBalanceElement.textContent = pi.toLocaleString(undefined, { maximumFractionDigits: 6 });
        if (fcBalanceElement) fcBalanceElement.textContent = farmCoins.toLocaleString();

        updateWallet();
    });
}

// Initialize DOM event listeners
function initializeEventListeners() {
    const elements = {
        startText: document.getElementById('start-text'),
        langToggle: document.getElementById('lang-toggle'),
        gameLangToggle: document.getElementById('game-lang-toggle'),
        settingsBtn: document.getElementById('settings-btn'),
        gameSettingsBtn: document.getElementById('game-settings-btn'),
        closeSettings: document.getElementById('close-settings'),
        rewardModalClose: document.getElementById('reward-modal-close'),
        fullscreenToggle: document.getElementById('fullscreen-toggle'),
        exitGameBtn: document.getElementById('exit-game-btn'),
        exchangeBtn: document.getElementById('exchange-btn'),
        exchangeAmount: document.getElementById('exchange-amount'),
        exchangeDirection: document.getElementById('exchange-direction'),
        buyTab: document.getElementById('shop-buy-tab'),
        sellTab: document.getElementById('shop-sell-tab'),
        loginPiBtn: document.getElementById('login-pi-btn'),
        claimRewardBtn: document.getElementById('claim-reward-btn')
    };

    if (elements.startText) addSafeClickListener(elements.startText, startGame);
    if (elements.langToggle) addSafeClickListener(elements.langToggle, toggleLanguage);
    if (elements.gameLangToggle) addSafeClickListener(elements.gameLangToggle, toggleLanguage);
    if (elements.settingsBtn) addSafeClickListener(elements.settingsBtn, () => toggleModal('settings-modal', true));
    if (elements.gameSettingsBtn) addSafeClickListener(elements.gameSettingsBtn, () => toggleModal('settings-modal', true));
    if (elements.closeSettings) addSafeClickListener(elements.closeSettings, () => toggleModal('settings-modal', false));
    if (elements.rewardModalClose) addSafeClickListener(elements.rewardModalClose, () => toggleModal('reward-modal', false));
    if (elements.fullscreenToggle) addSafeClickListener(elements.fullscreenToggle, toggleFullscreen);
    if (elements.exitGameBtn) addSafeClickListener(elements.exitGameBtn, exitGame);
    if (elements.exchangeBtn) addSafeClickListener(elements.exchangeBtn, handleExchange);
    if (elements.exchangeAmount) elements.exchangeAmount.addEventListener('input', updateExchangeResult);
    if (elements.exchangeDirection) elements.exchangeDirection.addEventListener('change', updateExchangeResult);
    if (elements.buyTab) addSafeClickListener(elements.buyTab, () => toggleShopTab('buy'));
    if (elements.sellTab) addSafeClickListener(elements.sellTab, () => toggleShopTab('sell'));
    if (elements.loginPiBtn) addSafeClickListener(elements.loginPiBtn, authenticateWithPi);
    if (elements.claimRewardBtn) addSafeClickListener(elements.claimRewardBtn, handleClaimReward);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        addSafeClickListener(btn, () => switchTab(btn.getAttribute('data-tab')));
    });
}

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = show ? 'block' : 'none';
        playMenuSound();
    }
}

function toggleShopTab(tab) {
    const buyTab = document.getElementById('shop-buy-tab');
    const sellTab = document.getElementById('shop-sell-tab');
    const shopContent = document.getElementById('shop-content');
    const sellContent = document.getElementById('sell-section');

    if (buyTab && sellTab && shopContent && sellContent) {
        buyTab.classList.toggle('active', tab === 'buy');
        sellTab.classList.toggle('active', tab === 'sell');
        shopContent.style.display = tab === 'buy' ? 'block' : 'none';
        sellContent.style.display = tab === 'sell' ? 'block' : 'none';
        if (tab === 'buy') renderShop();
        else renderSellSection();
        playMenuSound();
    }
}

function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.error('Fullscreen error:', err));
    } else {
        document.exitFullscreen().catch(err => console.error('Exit fullscreen error:', err));
    }
    playMenuSound();
}

function exitGame() {
    if (audioElements.bgMusic) audioElements.bgMusic.pause();
    if (audioElements.bgVoice) audioElements.bgVoice.pause();
    window.location.reload();
}

// Deposit feature
function initializeDeposit() {
    const realDepositBtn = document.getElementById('real-deposit-btn');
    const realDepositMsg = document.getElementById('real-deposit-msg');

    if (realDepositBtn) {
        addSafeClickListener(realDepositBtn, async () => {
            if (!userId || !window.Pi || !Pi.createPayment) {
                realDepositMsg.textContent = 'Login with Pi first or SDK not ready';
                return;
            }

            const amountInput = document.getElementById('deposit-amount');
            const amount = parseFloat(amountInput?.value || '1');
            if (isNaN(amount) || amount < 1) {
                realDepositMsg.textContent = 'Minimum 1 Pi';
                return;
            }

            realDepositBtn.disabled = true;
            realDepositMsg.textContent = 'Preparing payment...';

            try {
                await Pi.createPayment(
                    {
                        amount,
                        memo: 'Deposit to Harvest Pi',
                        metadata: { userId }
                    },
                    {
                        onReadyForServerApproval: paymentId => console.log('Ready for server approval:', paymentId),
                        onReadyForServerCompletion: async (paymentId, txid) => {
                            console.log('Payment confirmed:', paymentId, txid);
                            const playerRef = ref(database, `players/${userId}`);
                            const snapshot = await get(playerRef);
                            const data = snapshot.val() || {};

                            const newPi = (data.piBalance || 0) + amount;
                            await update(playerRef, {
                                piBalance: newPi,
                                totalDeposit: (data.totalDeposit || 0) + amount
                            });

                            pi = newPi;
                            updateWallet();
                            await Pi.completePayment(paymentId, txid);
                            realDepositMsg.textContent = `Successfully deposited +${amount} Pi`;
                        },
                        onCancel: () => realDepositMsg.textContent = 'Payment cancelled',
                        onError: err => {
                            console.error('Payment error:', err);
                            realDepositMsg.textContent = `Error: ${err.message}`;
                        }
                    }
                );
            } catch (err) {
                console.error('Payment process failed:', err);
                realDepositMsg.textContent = `Deposit failed: ${err.message}`;
            } finally {
                realDepositBtn.disabled = false;
            }
        });
    }
}

// Withdraw feature
function initializeWithdraw() {
    const realWithdrawBtn = document.getElementById('real-withdraw-btn');
    const withdrawMsg = document.getElementById('withdraw-message');
    const withdrawNote = document.getElementById('withdraw-note');

    async function checkWithdrawEligibility() {
        if (!userId) return;
        try {
            const snapshot = await get(ref(database, `players/${userId}`));
            const data = snapshot.val() || {};
            const eligible = data.level >= 10 && data.farmCoins >= 10000000 && data.totalDeposit >= 10 && data.piBalance >= 1;
            if (realWithdrawBtn && withdrawNote) {
                realWithdrawBtn.disabled = !eligible;
                withdrawNote.style.display = eligible ? 'none' : 'block';
            }
        } catch (error) {
            console.error('Withdraw check error:', error);
        }
    }

    if (realWithdrawBtn) {
        addSafeClickListener(realWithdrawBtn, async () => {
            withdrawMsg.textContent = '';
            if (!userId || !window.Pi) {
                withdrawMsg.textContent = 'User not authenticated or Pi SDK unavailable.';
                return;
            }

            const amount = 1; // Fixed withdraw amount for testnet
            try {
                realWithdrawBtn.disabled = true;
                realWithdrawBtn.textContent = 'Processing...';

                const playerRef = ref(database, `players/${userId}`);
                const snapshot = await get(playerRef);
                const data = snapshot.val() || {};

                if (data.piBalance < amount) {
                    withdrawMsg.textContent = 'Not enough Pi balance.';
                    return;
                }

                await Pi.createPayment(
                    {
                        amount,
                        memo: 'Withdraw from Harvest Pi',
                        metadata: { userId },
                        to: userId
                    },
                    {
                        onReadyForServerApproval: async paymentId => {
                            console.log('Ready for approval:', paymentId);
                            await Pi.approvePayment(paymentId);
                        },
                        onReadyForServerCompletion: async (paymentId, txid) => {
                            console.log('Completing payment:', paymentId, txid);
                            const newPi = data.piBalance - amount;
                            await update(playerRef, { piBalance: newPi });
                            pi = newPi;
                            updateWallet();
                            await Pi.completePayment(paymentId, txid);
                            withdrawMsg.textContent = `Withdraw success! -${amount} Pi`;
                            await checkWithdrawEligibility();
                        },
                        onCancel: paymentId => {
                            console.warn('Payment cancelled:', paymentId);
                            withdrawMsg.textContent = 'Withdraw cancelled.';
                        },
                        onError: error => {
                            console.error('Payment error:', error);
                            withdrawMsg.textContent = 'Error during withdraw.';
                        }
                    }
                );
            } catch (error) {
                console.error('Withdraw failed:', error);
                withdrawMsg.textContent = 'Failed to process withdraw.';
            } finally {
                realWithdrawBtn.disabled = false;
                realWithdrawBtn.textContent = 'Withdraw Real Pi';
            }
        });
    }
    checkWithdrawEligibility();
}

// Load player data
async function loadPlayerData() {
    if (!userId) {
        console.warn('No userId, please login first!');
        return;
    }
    try {
        onValue(ref(database, `players/${userId}`), (snapshot) => {
            if (isDataLoaded) return;
            const data = snapshot.val() || {};
            if (data) {
                farmCoins = data.farmCoins || 0;
                pi = data.piBalance || 0;
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
                    piUser: { email: userId }
                };
                set(ref(database, `players/${userId}`), initialData).catch(err => {
                    console.error('Initial set failed:', err);
                    showNotification('Error initializing player data.');
                });
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
    } catch (error) {
        console.error('Error loading player data:', error.message);
        showNotification('Failed to connect to Firebase. Please check your internet connection and reload.');
        isDataLoaded = false;
    }
}

// Save player data
async function savePlayerData() {
    if (!userId || !isDataLoaded) return;
    try {
        await update(ref(database, `players/${userId}`), {
            farmCoins,
            piBalance: pi,
            water,
            level,
            xp,
            inventory,
            farmPlots,
            harvestCount,
            achievements,
            lastClaim,
            claimedToday
        });
        console.log('Player data saved');
    } catch (error) {
        console.error('Error saving player data:', error.message);
        showNotification('Error saving data');
    }
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

    if (elements.farmCoins) elements.farmCoins.textContent = `${farmCoins} ${langData[currentLang]?.coinLabel || 'Coins'}`;
    if (elements.piCoins) elements.piCoins.textContent = `${pi.toFixed(6)} PI`;
    if (elements.water) elements.water.textContent = `${water} ${langData[currentLang]?.waterLabel || 'Water'}`;
    if (elements.level) elements.level.textContent = `Level: ${level} | XP: ${xp}`;
    if (elements.xpFill) elements.xpFill.style.width = `${(xp / (level * 100)) * 100}%`;
    if (elements.farmCoinBalance) elements.farmCoinBalance.textContent = farmCoins;
    if (elements.piCoinBalance) elements.piCoinBalance.textContent = pi.toFixed(6);

    savePlayerData();
}

// Initialize farm plots
function initializePlots() {
    const farmArea = document.getElementById('farm-area');
    if (!farmArea) {
        console.error('farm-area element not found');
        showNotification('Farm area not found');
        return;
    }

    farmArea.innerHTML = '';
    if (!farmPlots?.length) {
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

    updateUIText();
}

// Update plot UI and handle growth
function updatePlotUI(plot, plotElement, index) {
    const plotContent = plotElement.querySelector('.plot-content');
    const plotStatus = plotElement.querySelector('.plot-status');
    const countdownFill = plotElement.querySelector('.countdown-fill');

    const plantImg = document.createElement('img');
    plantImg.classList.add('plant-img');
    plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
    plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
    plotContent.appendChild(plantImg);
    plantImg.classList.add('loaded');

    if (plot.currentFrame >= plot.vegetable.frames) {
        plotElement.classList.add('ready');
        plotStatus.textContent = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
        countdownFill.style.width = '100%';
    } else if (plot.watered) {
        plotStatus.textContent = langData[currentLang]?.growing || 'Growing';
        const progress = (1 - plot.countdown / plot.totalCountdown) * 100;
        countdownFill.style.width = `${progress}%`;

        const interval = setInterval(() => {
            if (!plot.planted || plot.currentFrame >= plot.vegetable.frames) {
                clearInterval(interval);
                countdownFill.style.width = plot.currentFrame >= plot.vegetable.frames ? '100%' : '0%';
                plotElement.classList.toggle('ready', plot.currentFrame >= plot.vegetable.frames);
                plotStatus.textContent = plot.currentFrame >= plot.vegetable.frames
                    ? langData[currentLang]?.readyToHarvest || 'Ready to Harvest'
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
                    plotStatus.textContent = plot.currentFrame >= plot.vegetable.frames
                        ? langData[currentLang]?.readyToHarvest || 'Ready to Harvest'
                        : langData[currentLang]?.needsWater || 'Needs Water';
                    countdownFill.style.width = plot.currentFrame >= plot.vegetable.frames ? '100%' : '0%';
                    plotElement.classList.toggle('ready', plot.currentFrame >= plot.vegetable.frames);
                    if (plot.currentFrame >= plot.vegetable.frames) clearInterval(interval);
                } else {
                    plotStatus.textContent = langData[currentLang]?.growing || 'Growing';
                }
            } else {
                plotStatus.textContent = langData[currentLang]?.needsWater || 'Needs Water';
                countdownFill.style.width = '0%';
                clearInterval(interval);
            }
            savePlayerData();
        }, 1000);
    } else {
        plotStatus.textContent = langData[currentLang]?.needsWater || 'Needs Water';
        countdownFill.style.width = '0%';
    }
}

// Handle plot interaction
function handlePlotClick(index) {
    const plot = farmPlots[index];
    const plotElement = document.querySelectorAll('.plot')[index];
    const plotContent = plotElement?.querySelector('.plot-content');
    const plotStatus = plotElement?.querySelector('.plot-status');
    const countdownFill = plotElement?.querySelector('.countdown-fill');

    if (!plot.planted) {
        const seedIndex = inventory.findIndex(item => item?.type === 'seed' && item.quantity > 0);
        if (seedIndex === -1) {
            showNotification(langData[currentLang]?.noSeeds || 'No Seeds in inventory!');
            return;
        }

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
            updatePlotUI(plot, plotElement, index);
        }, 800);

        inventory[seedIndex].quantity -= 1;
        if (inventory[seedIndex].quantity <= 0) inventory.splice(seedIndex, 1);
        savePlayerData();
        renderInventory();
        showNotification(langData[currentLang]?.planted || 'Planted!');
        playPlantingSound();
    } else if (!plot.watered && plot.currentFrame < plot.vegetable.frames) {
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
        showNotification(langData[currentLang]?.watered || 'Watered!');
        playWateringSound();
        updatePlotUI(plot, plotElement, index);
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
        flyImage.onerror = () => flyImage.src = 'assets/img/ui/placeholder.png';
        flyImage.classList.add('plant-fly');
        flyImage.style.width = '60px';
        document.body.appendChild(flyImage);

        const rect = plotContent?.getBoundingClientRect() || { left: 0, top: 0, width: 0 };
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
            plotStatus.textContent = '';
            countdownFill.style.width = '0%';
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

// Render shop
function renderShop() {
    const shopContent = document.getElementById('shop-content');
    if (!shopContent) {
        console.error('shop-content element not found');
        return;
    }

    shopContent.style.display = 'grid';
    shopContent.innerHTML = '';

    if (!langData[currentLang] || !Array.isArray(vegetables) || !vegetables.length) {
        shopContent.innerHTML = `<p>${langData[currentLang]?.noItems || 'No items available in shop.'}</p>`;
        return;
    }

    vegetables.forEach(veg => {
        const vegItem = document.createElement('div');
        vegItem.classList.add('shop-item');
        vegItem.innerHTML = `
            <img src="${veg.shopImage}" alt="${veg.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
            <h3>${veg.name[currentLang]}</h3>
            <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: ${veg.farmPrice || 0} ${langData[currentLang]?.coinLabel || 'Coins'}</p>
            <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: ${veg.piPrice || 0} PI</p>
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

    shopContent.style.display = 'flex';

    document.querySelectorAll('.buy-btn').forEach(btn => {
        addSafeClickListener(btn, () => buyVegetable(btn.getAttribute('data-id'), 'farm'));
    });
    document.querySelectorAll('.buy-pi-btn').forEach(btn => {
        addSafeClickListener(btn, () => buyVegetable(btn.getAttribute('data-id'), 'pi'));
    });
}

// Add to inventory
function addToInventory(type, veg, qty = 1) {
    if (!veg?.id) return;
    const existingIndex = inventory.findIndex(item => item?.type === type && item.vegetable?.id === veg.id);
    if (existingIndex !== -1) {
        inventory[existingIndex].quantity += qty;
    } else {
        inventory.push({ type, vegetable: veg, quantity: qty });
    }
    savePlayerData();
}

// Buy item
let isSaving = false;
async function buyVegetable(id, currency) {
    if (isSaving) return;
    isSaving = true;

    try {
        if (id === 'water') {
            const cost = currency === 'farm' ? 100 : 0.0001;
            const balance = currency === 'farm' ? farmCoins : pi;
            if (balance >= cost) {
                if (currency === 'farm') farmCoins -= cost;
                else pi -= cost;
                water += 10;
                updateWallet();
                showTransactionAnimation(`-${cost} ${currency === 'farm' ? '' : 'PI'}`, false, document.querySelector(`.${currency === 'farm' ? 'buy-btn' : 'buy-pi-btn'}[data-id="water"]`));
                playBuyingSound();
                await savePlayerData();
            } else {
                showNotification(langData[currentLang]?.[`notEnough${currency === 'farm' ? 'Coins' : 'Pi'}`] || `Not Enough ${currency === 'farm' ? 'Coins' : 'PI'}!`);
            }
            return;
        }

        const veg = vegetables.find(v => v.id === id);
        if (!veg) {
            console.warn(`Vegetable with id ${id} not found`);
            return;
        }

        const cost = currency === 'farm' ? veg.farmPrice : veg.piPrice;
        const balance = currency === 'farm' ? farmCoins : pi;
        if (balance >= cost) {
            if (currency === 'farm') farmCoins -= cost;
            else pi -= cost;
            addToInventory('seed', veg, 1);
            updateWallet();
            renderInventory();
            showTransactionAnimation(`-${cost} ${currency === 'farm' ? '' : 'PI'}`, false, document.querySelector(`.${currency === 'farm' ? 'buy-btn' : 'buy-pi-btn'}[data-id="${id}"]`));
            playBuyingSound();
            await savePlayerData();
        } else {
            showNotification(langData[currentLang]?.[`notEnough${currency === 'farm' ? 'Coins' : 'Pi'}`] || `Not Enough ${currency === 'farm' ? 'Coins' : 'PI'}!`);
        }
    } catch (error) {
        console.error('Error in buyVegetable:', error.message);
        showNotification('Error during purchase');
    } finally {
        isSaving = false;
    }
}

// Render inventory
function renderInventory() {
    const inventoryContent = document.getElementById('inventory-content');
    if (!inventoryContent) {
        console.error('inventory-content element not found');
        showNotification('Inventory content not found');
        return;
    }

    inventoryContent.innerHTML = '';
    let hasItems = false;

    inventory.forEach(item => {
        if (!item?.vegetable) return;
        const veg = item.vegetable;
        const invItem = document.createElement('div');
        invItem.classList.add('inventory-item');
        const title = item.type === 'seed' ? `${veg.name[currentLang]} Seed` : veg.name[currentLang];
        invItem.innerHTML = `
            <img src="${veg.shopImage}" alt="${title}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
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
    addSafeClickListener(sellButton, () => {
        openSellTab();
        playMenuSound();
    });
    inventoryContent.appendChild(sellButton);
}

// Render sell section
function renderSellSection() {
    const sellContent = document.getElementById('sell-content');
    if (!sellContent) {
        console.error('sell-content element not found');
        return;
    }

    sellContent.innerHTML = '';
    let hasItems = false;

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

    Object.values(groupedHarvest).forEach(item => {
        const sellPrice = item.vegetable.sellPrice;
        if (typeof sellPrice !== 'number') return;

        const sellDiv = document.createElement('div');
        sellDiv.classList.add('sell-item');
        sellDiv.innerHTML = `
            <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img">
            <h3>${item.vegetable.name[currentLang]}</h3>
            <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
            <p>${langData[currentLang]?.sellPriceLabel || 'Sell Price'}: ${sellPrice} ${langData[currentLang]?.coinLabel || 'Coins'}</p>
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

// Open sell tab
function openSellTab() {
    switchTab('shop');
    toggleShopTab('sell');
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
    else if (tab === 'exchange') updateExchangeResult();

    playMenuSound();
}

// Exchange logic
let currentExchangeRate = 1000000;

function loadExchangeRate() {
    onValue(ref(database, 'exchangeRate/liveRate'), snapshot => {
        currentExchangeRate = snapshot.val() || currentExchangeRate;
        const rateEl = document.getElementById('live-rate');
        if (rateEl) rateEl.textContent = `1 Pi = ${currentExchangeRate.toLocaleString()} FC`;
        updateExchangeResult();
    });
}

function updateExchangeResult() {
    const amount = parseFloat(document.getElementById('exchange-amount').value.replace(',', '.')) || 0;
    const direction = document.getElementById('exchange-direction').value;
    const result = direction === 'piToFc'
        ? Math.floor(amount * currentExchangeRate)
        : amount / currentExchangeRate;

    const resultText = `You will get: ${direction === 'piToFc' ? result.toLocaleString() : result.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
    const resultDiv = document.getElementById('exchange-result');
    resultDiv.textContent = resultText.length > 25 ? resultText.substring(0, 25) + '…' : resultText;
    resultDiv.title = resultText;
}

async function handleExchange() {
    const amount = parseFloat(document.getElementById('exchange-amount').value.replace(',', '.')) || 0;
    const direction = document.getElementById('exchange-direction').value;
    if (isNaN(amount) || amount <= 0) {
        showNotification('Invalid amount!');
        return;
    }

    const playerRef = ref(database, `players/${userId}`);
    const snapshot = await get(playerRef);
    const data = snapshot.val();
    if (!data) {
        showNotification('Player data not found!');
        return;
    }

    let piBalance = Number(data.piBalance || 0);
    let fcBalance = Number(data.farmCoins || 0);
    let resultText;

    if (direction === 'piToFc') {
        if (piBalance < amount) {
            showNotification('Not enough Pi!');
            return;
        }
        const converted = Math.floor(amount * currentExchangeRate);
        piBalance -= amount;
        fcBalance += converted;
        resultText = converted.toLocaleString();
    } else {
        if (fcBalance < amount) {
            showNotification('Not enough FC!');
            return;
        }
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
            pi = piBalance;
            farmCoins = fcBalance;
            document.getElementById('pi-balance').textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
            document.getElementById('fc-balance').textContent = fcBalance.toLocaleString();
            document.getElementById('exchange-amount').value = '';
            updateExchangeResult();
            playCoinSound();
            showNotification('Exchange success!');
        } catch (error) {
            console.error('Exchange failed:', error.message);
            showNotification(`Exchange failed: ${error.message}`);
        } finally {
            document.getElementById('exchange-loading').style.display = 'none';
        }
    }, 3000);
}

// Initialize exchange button text
function initializeExchangeButton() {
    const exchangeBtn = document.getElementById('exchange-btn');
    const directionSelect = document.getElementById('exchange-direction');
    if (exchangeBtn && directionSelect) {
        directionSelect.addEventListener('change', () => {
            exchangeBtn.textContent = directionSelect.value === 'piToFc' ? 'Exchange to FC' : 'Exchange to Pi';
        });
        directionSelect.dispatchEvent(new Event('change'));
    }
}

// Daily reward handling
async function handleClaimReward() {
    if (!userId || isClaiming) return;
    isClaiming = true;

    try {
        const snapshot = await get(ref(database, `players/${userId}/lastClaim`));
        lastClaim = snapshot.val();
        const today = new Date().toISOString().split('T')[0];
        const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;

        if (lastClaimDate === today) {
            const claimRewardBtn = document.getElementById('claim-reward-btn');
            if (claimRewardBtn) {
                claimRewardBtn.classList.add('claimed');
                claimRewardBtn.textContent = langData[currentLang]?.claimed || 'Claimed!';
                claimRewardBtn.disabled = true;
            }
            claimedToday = true;
            return;
        }

        toggleModal('reward-modal', true);
        const dailyRewardText = document.getElementById('daily-reward-text');
        if (dailyRewardText) {
            dailyRewardText.textContent = langData[currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!';
        }
    } catch (error) {
        console.error('Error checking last claim:', error.message);
        showNotification('Error checking daily reward.');
    } finally {
        isClaiming = false;
    }
}

if (claimModalBtn) {
    addSafeClickListener(claimModalBtn, async () => {
        if (!userId) return;
        farmCoins += 100;
        water += 50;
        xp += 20;

        const today = new Date().toISOString();
        lastClaim = today;
        claimedToday = true;

        try {
            await update(ref(database, `players/${userId}`), { farmCoins, water, xp, lastClaim, claimedToday });
            updateWallet();
            toggleModal('reward-modal', false);
            const claimRewardBtn = document.getElementById('claim-reward-btn');
            if (claimRewardBtn) {
                claimRewardBtn.classList.add('claimed');
                claimRewardBtn.textContent = langData[currentLang]?.claimed || 'Claimed!';
                claimRewardBtn.disabled = true;
            }
            checkLevelUp();
            playCoinSound();
            showNotification(langData[currentLang]?.rewardClaimed || 'Reward Claimed!');
        } catch (error) {
            console.error('Error claiming reward:', error.message);
            showNotification(`Error claiming reward: ${error.message}`);
        }
    });
}

function checkDailyReward() {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;
    const claimRewardBtn = document.getElementById('claim-reward-btn');

    if (claimRewardBtn) {
        if (lastClaimDate === today) {
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

// Show notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 3000);
}

// Show transaction animation
function showTransactionAnimation(amount, isPositive, buttonElement) {
    const animation = document.createElement('div');
    animation.classList.add('transaction-animation', isPositive ? 'positive' : 'negative');
    animation.textContent = amount;
    document.body.appendChild(animation);

    const rect = buttonElement?.getBoundingClientRect() || { left: 0, top: 0, width: 0 };
    animation.style.left = `${rect.left + rect.width / 2}px`;
    animation.style.top = `${rect.top - 20}px`;

    setTimeout(() => animation.remove(), 1000);
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

// Render achievements
function renderAchievements() {
    const achievementsContent = document.getElementById('achievements-content');
    if (!achievementsContent) return;

    achievementsContent.innerHTML = `
        <div class="achievement">
            <h3>${langData[currentLang]?.harvestAchievementTitle || 'Harvest Master'}</h3>
            <p>${langData[currentLang]?.harvestAchievementDesc || 'Harvest 10 crops'}</p>
            <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.harvest ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
        </div>
        <div class="achievement">
            <h3>${langData[currentLang]?.coinAchievementTitle || 'Coin Collector'}</h3>
            <p>${langData[currentLang]?.coinAchievementDesc || 'Collect 1000 Farm Coins'}</p>
            <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.coins ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
        </div>
    `;
    savePlayerData();
}

// Update UI text
function updateUIText() {
    if (!langData[currentLang]) return;
    const elements = {
        title: document.getElementById('title'),
        gameTitle: document.getElementById('game-title'),
        startText: document.getElementById('start-text'),
        farmTab: document.querySelector('.tab-btn[data-tab="farm"]'),
        shopTab: document.querySelector('.tab-btn[data-tab="shop"]'),
        upgradesTab: document.querySelector('.tab-btn[data-tab="upgrades"]'),
        inventoryTab: document.querySelector('.tab-btn[data-tab="inventory"]'),
        exchangeTab: document.querySelector('.tab-btn[data-tab="exchange"]'),
        financeTab: document.querySelector('.tab-btn[data-tab="finance"]'),
        leaderboardTab: document.querySelector('.tab-btn[data-tab="leaderboard"]'),
        achievementsTab: document.querySelector('.tab-btn[data-tab="achievements"]'),
        langToggle: document.getElementById('lang-toggle'),
        gameLangToggle: document.getElementById('game-lang-toggle'),
        upgradesTitle: document.getElementById('upgrades-title'),
        upgradesContent: document.getElementById('upgrades-content'),
        exchangeTitle: document.getElementById('exchange-title'),
        exchangeRate: document.getElementById('exchange-rate'),
        exchangeAmount: document.getElementById('exchange-amount'),
        exchangeResultLabel: document.getElementById('exchange-result-label'),
        exchangeBtn: document.getElementById('exchange-btn'),
        leaderboardTitle: document.getElementById('leaderboard-title'),
        leaderboardContent: document.getElementById('leaderboard-content'),
        settingsTitle: document.getElementById('settings-title'),
        musicVolumeLabel: document.getElementById('music-volume-label'),
        voiceVolumeLabel: document.getElementById('voice-volume-label'),
        exitGameBtn: document.getElementById('exit-game-btn'),
        dailyRewardTitle: document.getElementById('daily-reward-title'),
        claimModalBtn: document.getElementById('claim-modal-btn'),
        shopBuyTab: document.getElementById('shop-buy-tab'),
        shopSellTab: document.getElementById('shop-sell-tab'),
        sellSectionTitle: document.getElementById('sell-section-title')
    };

    if (elements.title) elements.title.textContent = langData[currentLang]?.title || 'Harvest Pi';
    if (elements.gameTitle) elements.gameTitle.textContent = langData[currentLang]?.title || 'Harvest Pi';
    if (elements.startText) elements.startText.textContent = langData[currentLang]?.startGame || 'Start Game';
    if (elements.farmTab) elements.farmTab.textContent = langData[currentLang]?.farmTab || 'Farm';
    if (elements.shopTab) elements.shopTab.textContent = langData[currentLang]?.shopTab || 'Shop';
    if (elements.upgradesTab) elements.upgradesTab.textContent = langData[currentLang]?.upgradesTab || 'Upgrades';
    if (elements.inventoryTab) elements.inventoryTab.textContent = langData[currentLang]?.inventoryTab || 'Inventory';
    if (elements.exchangeTab) elements.exchangeTab.textContent = langData[currentLang]?.exchangeTab || 'Exchange';
    if (elements.financeTab) elements.financeTab.textContent = langData[currentLang]?.financeTab || 'Finance';
    if (elements.leaderboardTab) elements.leaderboardTab.textContent = langData[currentLang]?.leaderboardTab || 'Leaderboard';
    if (elements.achievementsTab) elements.achievementsTab.textContent = langData[currentLang]?.achievementsTab || 'Achievements';
    if (elements.langToggle) elements.langToggle.textContent = langData[currentLang]?.switchLang || 'Switch Language (EN/ID)';
    if (elements.gameLangToggle) elements.gameLangToggle.textContent = langData[currentLang]?.switchLang || 'Switch Language (EN/ID)';
    if (elements.upgradesTitle) elements.upgradesTitle.textContent = langData[currentLang]?.upgradesTitle || 'Upgrades';
    if (elements.upgradesContent) elements.upgradesContent.textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    if (elements.exchangeTitle) elements.exchangeTitle.textContent = langData[currentLang]?.exchangeTitle || 'Exchange';
    if (elements.exchangeRate) elements.exchangeRate.textContent = langData[currentLang]?.exchangeRate || '1 PI = 1,000,000 Farm Coins';
    if (elements.exchangeAmount) elements.exchangeAmount.placeholder = langData[currentLang]?.enterPiAmount || 'Enter PI amount';
    if (elements.exchangeResultLabel) elements.exchangeResultLabel.textContent = `${langData[currentLang]?.farmCoinsLabel || 'Farm Coins'}: `;
    if (elements.exchangeBtn) elements.exchangeBtn.textContent = langData[currentLang]?.exchangeButton || 'Exchange to Farm Coins';
    if (elements.leaderboardTitle) elements.leaderboardTitle.textContent = langData[currentLang]?.leaderboardTitle || 'Leaderboard';
    if (elements.leaderboardContent) elements.leaderboardContent.textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    if (elements.settingsTitle) elements.settingsTitle.textContent = langData[currentLang]?.settingsTitle || 'Settings';
    if (elements.musicVolumeLabel) elements.musicVolumeLabel.textContent = langData[currentLang]?.musicVolumeLabel || 'Music Volume:';
    if (elements.voiceVolumeLabel) elements.voiceVolumeLabel.textContent = langData[currentLang]?.voiceVolumeLabel || 'Voice/SFX Volume:';
    if (elements.exitGameBtn) elements.exitGameBtn.textContent = langData[currentLang]?.exitGame || 'Exit';
    if (elements.dailyRewardTitle) elements.dailyRewardTitle.textContent = langData[currentLang]?.dailyRewardTitle || 'Daily Reward';
    if (elements.claimModalBtn) elements.claimModalBtn.textContent = langData[currentLang]?.claimButton || 'Claim';
    if (elements.shopBuyTab) elements.shopBuyTab.textContent = langData[currentLang]?.buyTab || 'Buy';
    if (elements.shopSellTab) elements.shopSellTab.textContent = langData[currentLang]?.sellTab || 'Sell';
    if (elements.sellSectionTitle) elements.sellSectionTitle.textContent = langData[currentLang]?.sellSectionTitle || 'Sell Items';

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
        console.warn('Please login with Pi Network first!');
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
    isAudioPlaying = false;
    playBgMusic();
    playBgVoice();
    switchTab('farm');
    toggleFullscreen();
}

// Initialize game
async function initializeGame() {
    try {
        await loadData();
        updateUIText();
        initializeVolumeSliders();
        updateVolumes();
        loadExchangeRate();
        initializeEventListeners();
        initializeDeposit();
        initializeWithdraw();
        initializeExchangeButton();

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

// Bootstrap
document.addEventListener('DOMContentLoaded', async () => {
    await initializeGame();
    await initializePiSDK();
    await autoLoginWithPi();
    loadUserBalances();
});
