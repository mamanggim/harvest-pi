import { database, auth } from '../firebase/firebase-config.js';
import { ref, onValue, set, update, get, push } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { signInWithEmailAndPassword, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// Deklarasi claimModalBtn dan rewardModal sebagai global
const claimModalBtn = document.getElementById('claim-modal-btn');
const rewardModal = document.getElementById('reward-modal');

// Helper addSafeClickListener
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

// Global variables
let isDataLoaded = false;
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
let userId = null;
let userEmail = null;
let lastClaim = null;
const plotCount = 4;
const piToFarmRate = 1000000;
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;
let currentExchangeRate = 1000000;

// Fungsi login dengan Email/Password
const loginEmailBtn = document.getElementById('login-email-btn');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const verifyEmailMsg = document.getElementById('verify-email-msg');

if (loginEmailBtn) {
    addSafeClickListener(loginEmailBtn, async () => {
        const email = emailInput.value;
        const password = passwordInput.value;

        if (!email || !password) {
            loginError.style.display = 'block';
            loginError.textContent = 'Please enter email and password.';
            return;
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                await sendEmailVerification(user);
                verifyEmailMsg.style.display = 'block';
                loginError.style.display = 'none';
                return;
            }

            userId = user.uid;
            userEmail = user.email;
            localStorage.setItem('userId', userId);
            showNotification(`Logged in as ${user.email}`);

            const loginScreenElement = document.getElementById('login-screen');
            const startScreenElement = document.getElementById('start-screen');
            if (loginScreenElement && startScreenElement) {
                loginScreenElement.style.display = 'none';
                startScreenElement.style.display = 'flex';
            }

            if (user.email === 'admin@example.com') {
                const adminTab = document.querySelector('.tab-btn[data-tab="admin"]');
                if (adminTab) adminTab.style.display = 'block';
            }

            loadPlayerData();
        } catch (error) {
            loginError.style.display = 'block';
            loginError.textContent = 'Login failed: ' + error.message;
            verifyEmailMsg.style.display = 'none';
        }
    });
}

// Fungsi logout
async function logout() {
    try {
        await auth.signOut();
        localStorage.removeItem('userId');
        userId = null;
        userEmail = null;
        showNotification('Logged out successfully');
        window.location.reload();
    } catch (error) {
        console.error('Logout failed:', error.message);
        showNotification('Logout failed: ' + error.message);
    }
}

// Listener buat cek status auth
auth.onAuthStateChanged(user => {
    if (user) {
        if (!user.emailVerified) {
            verifyEmailMsg.style.display = 'block';
            return;
        }

        userId = user.uid;
        userEmail = user.email;
        localStorage.setItem('userId', userId);

        const loginScreenElement = document.getElementById('login-screen');
        const startScreenElement = document.getElementById('start-screen');
        if (loginScreenElement && startScreenElement) {
            loginScreenElement.style.display = 'none';
            startScreenElement.style.display = 'flex';
        }

        if (user.email === 'admin@example.com') {
            const adminTab = document.querySelector('.tab-btn[data-tab="admin"]');
            if (adminTab) adminTab.style.display = 'block';
        }

        loadPlayerData();
    } else {
        const loginScreenElement = document.getElementById('login-screen');
        const startScreenElement = document.getElementById('start-screen');
        if (loginScreenElement && startScreenElement) {
            loginScreenElement.style.display = 'flex';
            startScreenElement.style.display = 'none';
        }
    }
});

// Update wallet UI
function updateWallet() {
    const farmCoinsElement = document.getElementById('farm-coins');
    const piCoinsElement = document.getElementById('pi-coins');
    const waterElement = document.getElementById('water');
    const levelElement = document.getElementById('level');
    const xpFillElement = document.getElementById('xp-fill');

    if (farmCoinsElement) farmCoinsElement.textContent = `${farmCoins} ${langData[currentLang]?.coinLabel || 'Coins'}`;
    if (piCoinsElement) piCoinsElement.textContent = `${piBalance.toFixed(6)} PI`;
    if (waterElement) waterElement.textContent = `${water} ${langData[currentLang]?.waterLabel || 'Water'}`;
    if (levelElement) levelElement.textContent = `Level: ${level} | XP: ${xp}`;
    if (xpFillElement) xpFillElement.style.width = `${(xp / (level * 100)) * 100}%`;

    const farmCoinBalanceElement = document.getElementById('farm-coin-balance');
    const piCoinBalanceElement = document.getElementById('pi-coin-balance');
    if (farmCoinBalanceElement) farmCoinBalanceElement.textContent = farmCoins.toLocaleString();
    if (piCoinBalanceElement) piCoinBalanceElement.textContent = piBalance.toFixed(6);

    savePlayerData();
}

// Load user balances from Firebase
function loadUserBalances() {
    const playerRef = ref(database, `players/${userId}`);
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
            playPromise.catch(e => {
                console.log('BG Music failed to start:', e.message);
                setTimeout(() => bgMusic.play().catch(err => console.log('Retry BG Music failed:', err.message)), 100);
            });
        }
    }
}

function playBgVoice() {
    if (bgVoice && !isAudioPlaying) {
        const playPromise = bgVoice.play();
        if (playPromise !== undefined) {
            playPromise.catch(e => {
                console.log('BG Voice failed to start:', e.message);
                setTimeout(() => bgVoice.play().catch(err => console.log('Retry BG Voice failed:', err.message)), 100);
            });
        }
    }
}

function playHarvestingSound() { if (harvestingSound) harvestingSound.play().catch(e => console.log('Harvest sound failed:', e.message)); }
function playWateringSound() { if (wateringSound) wateringSound.play().catch(e => console.log('Watering sound failed:', e.message)); }
function playPlantingSound() { if (plantingSound) plantingSound.play().catch(e => console.log('Planting sound failed:', e.message)); }
function playMenuSound() { if (menuSound) menuSound.play().catch(e => console.log('Menu sound failed:', e.message)); }
function playBuyingSound() { if (buyingSound) buyingSound.play().catch(e => console.log('Buying sound failed:', e.message)); }
function playCoinSound() { if (coinSound) coinSound.play().catch(e => console.log('Coin sound failed:', e.message)); }

// Update audio volumes
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
}

// Load data
async function loadData() {
    try {
        const langRes = await fetch('/data/lang.json');
        langData = await langRes.json();
        const vegRes = await fetch('/data/vegetables.json');
        const vegJson = await vegRes.json();
        vegetables = vegJson.vegetables;
    } catch (error) {
        console.error('Error loading data:', error.message);
        showNotification('Error loading game data.');
    }
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

// Save player data to Firebase
async function savePlayerData() {
    if (!userId || !isDataLoaded) return;
    const playerRef = ref(database, `players/${userId}`);
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
        claimedToday
    }).catch(err => {
        console.error('Error saving player data:', err.message);
        showNotification('Error saving data');
    });
}

// Generate unique transaction ID
function generateTransactionId() {
    return 'TX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Save transaction to Firebase
async function saveTransaction(type, amount, walletAddress = null) {
    if (!userId || !userEmail) return;
    const transactionId = generateTransactionId();
    const transactionsRef = ref(database, 'transactions');
    const newTransactionRef = push(transactionsRef);
    await set(newTransactionRef, {
        transactionId,
        userId,
        userEmail,
        type,
        amount,
        walletAddress: walletAddress || 'N/A',
        status: 'pending',
        timestamp: new Date().toISOString()
    }).then(() => {
        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} request submitted! Transaction ID: ${transactionId}`);
    }).catch(error => {
        console.error(`Error saving ${type} transaction:`, error.message);
        showNotification(`Error submitting ${type} request: ${error.message}`);
    });
}

// Initialize farm plots
function initializePlots() {
    const farmAreaElement = document.getElementById('farm-area');
    if (!farmAreaElement) return;
    farmAreaElement.innerHTML = '';
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
        farmAreaElement.appendChild(plotElement);
        if (plot.planted && plot.vegetable) updatePlotDisplay(plotElement, plot);
    });
}

// Update plot display
function updatePlotDisplay(plotElement, plot) {
    const plotContent = plotElement.querySelector('.plot-content');
    const plotStatus = plotElement.querySelector('.plot-status');
    const countdownFill = plotElement.querySelector('.countdown-fill');
    const plantImg = document.createElement('img');
    plantImg.classList.add('plant-img');
    plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
    plantImg.onerror = () => { plantImg.src = 'assets/img/ui/placeholder.png'; };
    plotContent.innerHTML = '';
    plotContent.appendChild(plantImg);
    plantImg.classList.add('loaded');
    if (plot.currentFrame >= plot.vegetable.frames) {
        plotElement.classList.add('ready');
        plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
        countdownFill.style.width = '100%';
    } else if (plot.watered) {
        plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
        countdownFill.style.width = `${(1 - plot.countdown / plot.totalCountdown) * 100}%`;
    } else {
        plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
        countdownFill.style.width = '0%';
    }
}

// Handle plot click
function handlePlotClick(index) {
    const plot = farmPlots[index];
    const plotElement = document.querySelectorAll('.plot')[index];
    const plotContent = plotElement.querySelector('.plot-content');
    const plotStatus = plotElement.querySelector('.plot-status');
    const countdownFill = plotElement.querySelector('.countdown-fill');

    if (!plot.planted) {
        const seedIndex = inventory.findIndex(item => item.type === 'seed' && item.quantity > 0);
        if (seedIndex !== -1) {
            const { vegetable } = inventory[seedIndex];
            plot.planted = true;
            plot.vegetable = vegetable;
            plot.watered = false;
            plot.currentFrame = 1;
            plot.countdown = vegetable.growthTime;
            plot.totalCountdown = vegetable.growthTime;
            animatePlanting(plotContent, vegetable);
            plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
            countdownFill.style.width = '0%';
            inventory[seedIndex].quantity--;
            if (inventory[seedIndex].quantity <= 0) inventory.splice(seedIndex, 1);
            savePlayerData();
            renderInventory();
            showNotification(langData[currentLang]?.planted || 'Planted!');
            playPlantingSound();
        } else showNotification(langData[currentLang]?.noSeeds || 'No Seeds!');
    } else if (!plot.watered && plot.currentFrame < plot.vegetable.frames) {
        if (water >= (plot.vegetable.waterNeeded || 1)) {
            water -= plot.vegetable.waterNeeded || 1;
            plot.watered = true;
            animateWatering(plotContent);
            updateWallet();
            showNotification(langData[currentLang]?.watered || 'Watered!');
            playWateringSound();
            startCountdown(plot, plotElement, plotContent, plotStatus, countdownFill);
        } else showNotification(langData[currentLang]?.notEnoughWater || 'Not Enough Water!');
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
        animateHarvest(plotContent, plot.vegetable);
        harvestCount++;
        savePlayerData();
        checkHarvestAchievement();
        showNotification(langData[currentLang]?.harvested || 'Harvested!');
        playHarvestingSound();
        renderInventory();
        renderSellSection();
    }
}

// Start countdown for plot
function startCountdown(plot, plotElement, plotContent, plotStatus, countdownFill) {
    const interval = setInterval(() => {
        if (!plot.planted) {
            clearInterval(interval);
            countdownFill.style.width = '0%';
            return;
        }
        if (plot.currentFrame >= plot.vegetable.frames) {
            clearInterval(interval);
            plotElement.classList.add('ready');
            plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
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
                plot.totalCountdown = plot.vegetable.growthTime;
                updatePlotDisplay(plotElement, plot);
                if (plot.currentFrame >= plot.vegetable.frames) {
                    plotElement.classList.add('ready');
                    plotStatus.innerHTML = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
                    countdownFill.style.width = '100%';
                } else {
                    plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
                    countdownFill.style.width = '0%';
                }
            } else plotStatus.innerHTML = langData[currentLang]?.growing || 'Growing';
        } else {
            plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
            countdownFill.style.width = '0%';
            clearInterval(interval);
        }
        savePlayerData();
    }, 1000);
}

// Add to inventory
function addToInventory(type, veg, qty = 1) {
    const existingIndex = inventory.findIndex(item => item.type === type && item.vegetable.id === veg.id);
    if (existingIndex !== -1) inventory[existingIndex].quantity += qty;
    else inventory.push({ type, vegetable: veg, quantity: qty });
    savePlayerData();
}

// Load exchange rate
function loadExchangeRate() {
    const rateRef = ref(database, "exchangeRate/liveRate");
    onValue(rateRef, (snapshot) => {
        currentExchangeRate = snapshot.val() || currentExchangeRate;
        const rateEl = document.getElementById("live-rate");
        if (rateEl) rateEl.textContent = `1 PI = ${currentExchangeRate.toLocaleString()} FC`;
    });
}
loadExchangeRate();

// Handle exchange
async function handleExchange() {
    const amount = parseFloat(document.getElementById("exchange-amount").value.replace(",", ".")) || 0;
    const direction = document.getElementById("exchange-direction").value;
    const playerRef = ref(database, `players/${userId}`);
    const snapshot = await get(playerRef);
    const data = snapshot.val();

    if (!data) return showNotification("Player data not found!");
    if (isNaN(amount) || amount <= 0) return showNotification("Invalid amount!");

    let pi = data.piBalance || 0;
    let fc = data.farmCoins || 0;

    if (direction === "piToFc") {
        if (pi < amount) return showNotification("Not enough PI!");
        pi -= amount;
        fc += Math.floor(amount * currentExchangeRate);
    } else {
        if (fc < amount) return showNotification("Not enough FC!");
        fc -= amount;
        pi += amount / currentExchangeRate;
    }

    piBalance = Math.round(pi * 1000000) / 1000000;
    farmCoins = Math.floor(fc);

    document.getElementById("exchange-loading").style.display = "block";
    setTimeout(async () => {
        try {
            await update(playerRef, { piBalance, farmCoins });
            document.getElementById("pi-balance").textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
            document.getElementById("fc-balance").textContent = farmCoins.toLocaleString();
            document.getElementById("exchange-amount").value = "";
            updateExchangeResult();
            playCoinSound();
            showNotification("Exchange success!");
        } catch (error) {
            console.error("Exchange failed:", error.message);
            showNotification("Exchange failed: " + error.message);
        } finally {
            document.getElementById("exchange-loading").style.display = "none";
        }
    }, 3000);
}

// Document ready event listener
document.addEventListener('DOMContentLoaded', () => {
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
        userId = storedUserId;
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
        loadPlayerData();
    }

    const startTextElement = document.getElementById('start-text');
    if (startTextElement) addSafeClickListener(startTextElement, startGame);

    const langToggleElement = document.getElementById('lang-toggle');
    if (langToggleElement) addSafeClickListener(langToggleElement, toggleLanguage);

    const gameLangToggleElement = document.getElementById('game-lang-toggle');
    if (gameLangToggleElement) addSafeClickListener(gameLangToggleElement, toggleLanguage);

    const settingsBtnElement = document.getElementById('settings-btn');
    if (settingsBtnElement) addSafeClickListener(settingsBtnElement, () => {
        document.getElementById('settings-modal').style.display = 'block';
        playMenuSound();
    });

    const gameSettingsBtnElement = document.getElementById('game-settings-btn');
    if (gameSettingsBtnElement) addSafeClickListener(gameSettingsBtnElement, () => {
        document.getElementById('settings-modal').style.display = 'block';
        playMenuSound();
    });

    const closeSettingsElement = document.getElementById('close-settings');
    if (closeSettingsElement) addSafeClickListener(closeSettingsElement, () => {
        document.getElementById('settings-modal').style.display = 'none';
        playMenuSound();
    });

    const rewardModalCloseElement = document.getElementById('reward-modal-close');
    if (rewardModalCloseElement) addSafeClickListener(rewardModalCloseElement, () => {
        rewardModal.style.display = 'none';
        playMenuSound();
    });

    const fullscreenToggleElement = document.getElementById('fullscreen-toggle');
    if (fullscreenToggleElement) addSafeClickListener(fullscreenToggleElement, () => {
        if (!document.fullscreenElement) enterFullScreen();
        else exitFullScreen();
        playMenuSound();
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

    const exitGameBtnElement = document.getElementById('exit-game-btn');
    if (exitGameBtnElement) addSafeClickListener(exitGameBtnElement, () => {
        if (bgMusic) bgMusic.pause();
        if (bgVoice) bgVoice.pause();
        window.location.reload();
    });

    const logoutBtnElement = document.getElementById('logout-btn');
    if (logoutBtnElement) addSafeClickListener(logoutBtnElement, logout);

    const exchangeBtnElement = document.getElementById('exchange-btn');
    if (exchangeBtnElement) addSafeClickListener(exchangeBtnElement, handleExchange);

    const notifyDepositBtn = document.getElementById('notify-deposit-btn');
    if (notifyDepositBtn) addSafeClickListener(notifyDepositBtn, async () => {
        const depositAmount = parseFloat(document.getElementById('deposit-amount').value);
        if (isNaN(depositAmount) || depositAmount <= 0) return showNotification('Please enter a valid deposit amount.');
        await saveTransaction('deposit', depositAmount);
    });

    const notifyWithdrawBtn = document.getElementById('notify-withdraw-btn');
    if (notifyWithdrawBtn) addSafeClickListener(notifyWithdrawBtn, async () => {
        const withdrawAmount = parseFloat(document.getElementById('withdraw-amount').value);
        const withdrawWallet = document.getElementById('withdraw-wallet').value;
        if (isNaN(withdrawAmount) || withdrawAmount <= 0) return showNotification('Please enter a valid withdraw amount.');
        if (!withdrawWallet) return showNotification('Please enter your wallet address.');
        if (piBalance < withdrawAmount) return showNotification('Insufficient PI balance!');
        await saveTransaction('withdraw', withdrawAmount, withdrawWallet);
    });

    const exchangeAmountElement = document.getElementById('exchange-amount');
    if (exchangeAmountElement) exchangeAmountElement.addEventListener('input', updateExchangeResult);

    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons) tabButtons.forEach(btn => addSafeClickListener(btn, () => switchTab(btn.getAttribute('data-tab'))));

    const directionSelect = document.getElementById('exchange-direction');
    if (directionSelect) directionSelect.addEventListener('change', updateExchangeResult);

    const buyTabElement = document.getElementById('shop-buy-tab');
    const sellTabElement = document.getElementById('shop-sell-tab');
    const shopContentElement = document.getElementById('shop-content');
    const sellContentElement = document.getElementById('sell-section');

    if (buyTabElement) addSafeClickListener(buyTabElement, () => {
        buyTabElement.classList.add('active');
        sellTabElement.classList.remove('active');
        shopContentElement.style.display = 'block';
        sellContentElement.style.display = 'none';
        renderShop();
        playMenuSellSound();
    });

    if (sellTabElement) addSafeClickListener(sellTabElement, () => {
        sellTabElement.classList.add('active');
        buyTabElement.classList.remove('active');
        shopContentElement.style.display = 'none';
        sellContentElement.style.display = 'block';
        renderSellSection();
        playMenuSellSound();
    });

    initializeGame();
});

// Render shop
function renderShop() {
    const shopContentElement = document.getElementById('shop-content');
    if (!shopContentElement) return;
    shopContentElement.innerHTML = '';
    vegetables.forEach(veg => {
        const vegItem = document.createElement('div');
        vegItem.classList.add('shop-item');
        vegItem.innerHTML = `
            <img src="${veg.shopImage}" alt="${veg.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
            <h3>${veg.name[currentLang]}</h3>
            <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: ${veg.farmPrice} ${langData[currentLang]?.coinLabel || 'Coins'}</p>
            <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: ${veg.piPrice} PI</p>
            <button class="buy-btn" data-id="${veg.id}">Buy (Farm)</button>
            <button class="buy-pi-btn" data-id="${veg.id}">Buy (PI)</button>
        `;
        shopContentElement.appendChild(vegItem);
    });
    const waterItem = document.createElement('div');
    waterItem.classList.add('shop-item');
    waterItem.innerHTML = `
        <img src="assets/img/ui/water_icon.png" alt="${langData[currentLang]?.waterLabel || 'Water'}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
        <h3>${langData[currentLang]?.waterLabel || 'Water'}</h3>
        <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: 100 ${langData[currentLang]?.coinLabel || 'Coins'}</p>
        <p>${langData[currentLang]?.piPriceLabel || 'PI Price'}: 0.0001 PI</p>
        <button class="buy-btn" data-id="water">Buy (Farm)</button>
        <button class="buy-pi-btn" data-id="water">Buy (PI)</button>
    `;
    shopContentElement.appendChild(waterItem);
    document.querySelectorAll('.buy-btn').forEach(btn => addSafeClickListener(btn, () => buyVegetable(btn.getAttribute('data-id'), 'farm')));
    document.querySelectorAll('.buy-pi-btn').forEach(btn => addSafeClickListener(btn, () => buyVegetable(btn.getAttribute('data-id'), 'pi')));
}

// Render sell section
function renderSellSection() {
    const sellContentElement = document.getElementById('sell-content');
    if (!sellContentElement) return;
    sellContentElement.innerHTML = '';
    const groupedHarvest = {};
    inventory.forEach((item, index) => {
        if (item.type === 'harvest') {
            if (!groupedHarvest[item.vegetable.id]) groupedHarvest[item.vegetable.id] = { ...item, index };
            else groupedHarvest[item.vegetable.id].quantity += item.quantity;
        }
    });
    Object.values(groupedHarvest).forEach(item => {
        const sellDiv = document.createElement('div');
        sellDiv.classList.add('sell-item');
        sellDiv.innerHTML = `
            <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img">
            <h3>${item.vegetable.name[currentLang]}</h3>
            <p>${langData[currentLang]?.quantityLabel || 'Quantity'}: ${item.quantity}</p>
            <p>${langData[currentLang]?.sellPriceLabel || 'Sell Price'}: ${item.vegetable.sellPrice} ${langData[currentLang]?.coinLabel || 'Coins'}</p>
            <button class="sell-btn" data-index="${item.index}">Sell</button>
        `;
        sellContentElement.appendChild(sellDiv);
    });
    document.querySelectorAll('.sell-btn').forEach(btn => addSafeClickListener(btn, () => sellItem(parseInt(btn.getAttribute('data-index')))));
}

// Buy vegetable or water
async function buyVegetable(id, currency) {
    if (id === 'water') {
        if (currency === 'farm' && farmCoins >= 100) {
            farmCoins -= 100;
            water += 10;
            updateWallet();
            playBuyingSound();
            await savePlayerData();
        } else if (currency === 'pi' && piBalance >= 0.0001) {
            piBalance -= 0.0001;
            water += 10;
            updateWallet();
            playBuyingSound();
            await savePlayerData();
        } else showNotification(currency === 'farm' ? langData[currentLang]?.notEnoughCoins : langData[currentLang]?.notEnoughPi);
        return;
    }
    const veg = vegetables.find(v => v.id === id);
    if (!veg) return;
    if (currency === 'farm' && farmCoins >= veg.farmPrice) {
        farmCoins -= veg.farmPrice;
        addToInventory('seed', veg);
        updateWallet();
        renderInventory();
        playBuyingSound();
        await savePlayerData();
    } else if (currency === 'pi' && piBalance >= veg.piPrice) {
        piBalance -= veg.piPrice;
        addToInventory('seed', veg);
        updateWallet();
        renderInventory();
        playBuyingSound();
        await savePlayerData();
    } else showNotification(currency === 'farm' ? langData[currentLang]?.notEnoughCoins : langData[currentLang]?.notEnoughPi);
}

// Sell item
function sellItem(index) {
    const item = inventory[index];
    if (!item || item.type !== 'harvest') return;
    farmCoins += item.vegetable.sellPrice * item.quantity;
    xp += 10;
    inventory.splice(index, 1);
    savePlayerData();
    updateWallet();
    renderInventory();
    renderSellSection();
    playCoinSound();
    checkLevelUp();
    checkCoinAchievement();
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

// Update exchange result
function updateExchangeResult() {
    const amount = parseFloat(document.getElementById("exchange-amount").value.replace(",", ".")) || 0;
    const direction = document.getElementById("exchange-direction").value;
    const result = direction === "piToFc" ? Math.floor(amount * currentExchangeRate) : amount / currentExchangeRate;
    const resultDiv = document.getElementById("exchange-result");
    const shortDisplay = `You will get: ${result.toLocaleString(undefined, { maximumFractionDigits: 6 })}`.substring(0, 25) + (result.toString().length > 25 ? "…" : "");
    resultDiv.textContent = shortDisplay;
    resultDiv.title = `You will get: ${result.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

// Claim daily reward
if (claimModalBtn) {
    addSafeClickListener(document.getElementById('claim-reward-btn'), async () => {
        if (!userId || isClaiming) return;
        isClaiming = true;
        const playerRef = ref(database, `players/${userId}/lastClaim`);
        const snapshot = await get(playerRef);
        lastClaim = snapshot.val();
        const today = new Date().toISOString().split('T')[0];
        if (lastClaim && new Date(lastClaim).toISOString().split('T')[0] === today) {
            document.getElementById('claim-reward-btn').classList.add('claimed');
            document.getElementById('claim-reward-btn').textContent = langData[currentLang]?.claimed || 'Claimed!';
            document.getElementById('claim-reward-btn').disabled = true;
            claimedToday = true;
            isClaiming = false;
            return;
        }
        rewardModal.style.display = 'block';
        document.getElementById('daily-reward-text').textContent = langData[currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!';
    });

    addSafeClickListener(claimModalBtn, async () => {
        farmCoins += 100;
        water += 50;
        xp += 20;
        lastClaim = new Date().toISOString();
        claimedToday = true;
        const playerRef = ref(database, `players/${userId}`);
        await update(playerRef, { farmCoins, water, xp, lastClaim, claimedToday });
        updateWallet();
        rewardModal.style.display = 'none';
        document.getElementById('claim-reward-btn').classList.add('claimed');
        document.getElementById('claim-reward-btn').textContent = langData[currentLang]?.claimed || 'Claimed!';
        document.getElementById('claim-reward-btn').disabled = true;
        checkLevelUp();
        playCoinSound();
        showNotification(langData[currentLang]?.rewardClaimed || 'Reward Claimed!');
        isClaiming = false;
    });
}

// Check daily reward
function checkDailyReward() {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    if (lastClaim && new Date(lastClaim).toISOString().split('T')[0] === today) {
        document.getElementById('claim-reward-btn').classList.add('claimed');
        document.getElementById('claim-reward-btn').textContent = langData[currentLang]?.claimed || 'Claimed!';
        document.getElementById('claim-reward-btn').disabled = true;
        claimedToday = true;
    }
}

// Switch tabs
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add('active');
    if (tab === 'shop') { renderShop(); renderSellSection(); }
    else if (tab === 'inventory') renderInventory();
    else if (tab === 'achievements') renderAchievements();
    else if (tab === 'exchange') updateExchangeResult();
    else if (tab === 'admin') renderAdminPanel();
    playMenuSound();
}
