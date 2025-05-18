// Ambil database dan auth dari firebase-config.js
import { database, auth } from '../firebase/firebase-config.js';
import { ref, onValue, set, update, get, push } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { signInWithPopup, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
let farmCoins = 0;
let piBalance = 0; // Ganti pi jadi piBalance
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
let userEmail = null; // Simpan email user untuk notifikasi
let lastClaim = null;
const plotCount = 4; // 2x2 grid
const piToFarmRate = 1000000; // 1 PI = 1,000,000 Farm Coins
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;

// Update wallet UI
function updateWallet() {
    const farmCoinsElement = document.getElementById('farm-coins');
    const piCoinsElement = document.getElementById('pi-coins');
    const waterElement = document.getElementById('water');
    const levelElement = document.getElementById('level');
    const xpFillElement = document.getElementById('xp-fill');

    if (farmCoinsElement) farmCoinsElement.textContent = `${farmCoins} ${langData[currentLang]?.coinLabel || 'Coins'}`;
    if (piCoinsElement) piCoinsElement.textContent = `${piBalance.toFixed(6)} PI`; // Tetap PI di UI
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
        piBalance = data.piBalance || 0; // Ganti pi jadi piBalance
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
    if (harvestingSound) harvestingSound.play().catch(e => console.log('Harvest sound failed:', e.message));
}

function playWateringSound() {
    if (wateringSound) wateringSound.play().catch(e => console.log('Watering sound failed:', e.message));
}

function playPlantingSound() {
    if (plantingSound) plantingSound.play().catch(e => console.log('Planting sound failed:', e.message));
}

function playMenuSound() {
    if (menuSound) menuSound.play().catch(e => console.log('Menu sound failed:', e.message));
}

function playBuyingSound() {
    if (buyingSound) buyingSound.play().catch(e => console.log('Buying sound failed:', e.message));
}

function playCoinSound() {
    if (coinSound) coinSound.play().catch(e => console.log('Coin sound failed:', e.message));
}

// Set posisi awal slider dari localStorage
const musicVolumeSlider = document.getElementById('music-volume');
if (musicVolumeSlider) musicVolumeSlider.value = localStorage.getItem('musicVolume') ?? 50;

const voiceVolumeSlider = document.getElementById('voice-volume');
if (voiceVolumeSlider) voiceVolumeSlider.value = localStorage.getItem('voiceVolume') ?? 50;

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

// Panggil update pertama kali setelah semua siap
updateVolumes();

// Load data
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

// Fungsi login dengan Google
const provider = new GoogleAuthProvider();
async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        userId = user.uid;
        userEmail = user.email;
        localStorage.setItem('userId', userId);
        showNotification(`Logged in as ${user.displayName || user.email}`);

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
        console.error('Google login failed:', error.message);
        showNotification('Google login failed: ' + error.message);
    }
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

// Load player data
function loadPlayerData() {
    try {
        if (!userId) {
            console.warn('No userId, please login first!');
            return;
        }
        const playerRef = ref(database, `players/${userId}`);

        onValue(playerRef, (snapshot) => {
            if (isDataLoaded) return;

            const data = snapshot.val();
            if (data) {
                farmCoins = data.farmCoins || 0;
                piBalance = data.piBalance || 0; // Ganti pi jadi piBalance
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
                    claimedToday: false
                };
                set(playerRef, initialData).catch(err => {
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

// Save player data to Firebase
async function savePlayerData() {
    if (!userId || !isDataLoaded) return;
    const playerRef = ref(database, `players/${userId}`);

    const dataToSave = {
        farmCoins,
        piBalance, // Ganti pi jadi piBalance
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

// Fungsi untuk generate unique ID transaksi
function generateTransactionId() {
    return 'TX-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Fungsi untuk simpan transaksi deposit/withdraw ke Firebase
async function saveTransaction(type, amount, walletAddress = null) {
    if (!userId || !userEmail) return;
    
    const transactionId = generateTransactionId();
    const transactionsRef = ref(database, 'transactions');
    const newTransactionRef = push(transactionsRef);

    const transactionData = {
        transactionId,
        userId,
        userEmail,
        type, // 'deposit' atau 'withdraw'
        amount,
        walletAddress: walletAddress || 'N/A',
        status: 'pending',
        timestamp: new Date().toISOString()
    };

    try {
        await set(newTransactionRef, transactionData);
        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} request submitted! Transaction ID: ${transactionId}`);
        // Untuk notifikasi email, admin harus cek Firebase manual
        // Alternatif: Gunakan Firebase Functions untuk kirim email (di luar scope)
        return transactionId;
    } catch (error) {
        console.error(`Error saving ${type} transaction:`, error.message);
        showNotification(`Error submitting ${type} request: ${error.message}`);
    }
}

// Document ready event listener
document.addEventListener('DOMContentLoaded', () => {
    // Login dengan Google
    const loginGoogleBtnElement = document.getElementById('login-google-btn');
    if (loginGoogleBtnElement) {
        addSafeClickListener(loginGoogleBtnElement, loginWithGoogle);
    }

    // Load existing userId from localStorage if available
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
        userId = storedUserId;
        const loginScreenElement = document.getElementById('login-screen');
        const startScreenElement = document.getElementById('start-screen');
        if (loginScreenElement && startScreenElement) {
            loginScreenElement.style.display = 'none';
            startScreenElement.style.display = 'flex';
        }
        loadPlayerData();
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

    const exitGameBtnElement = document.getElementById('exit-game-btn');
    if (exitGameBtnElement) {
        addSafeClickListener(exitGameBtnElement, () => {
            if (bgMusic) bgMusic.pause();
            if (bgVoice) bgVoice.pause();
            window.location.reload();
        });
    }

    const logoutBtnElement = document.getElementById('logout-btn');
    if (logoutBtnElement) {
        addSafeClickListener(logoutBtnElement, logout);
    }

    const exchangeBtnElement = document.getElementById('exchange-btn');
    if (exchangeBtnElement) addSafeClickListener(exchangeBtnElement, handleExchange);

    const notifyDepositBtn = document.getElementById('notify-deposit-btn');
    if (notifyDepositBtn) {
        addSafeClickListener(notifyDepositBtn, async () => {
            const depositAmount = parseFloat(document.getElementById('deposit-amount').value);
            if (isNaN(depositAmount) || depositAmount <= 0) {
                showNotification('Please enter a valid deposit amount.');
                return;
            }
            await saveTransaction('deposit', depositAmount);
        });
    }

    const notifyWithdrawBtn = document.getElementById('notify-withdraw-btn');
    if (notifyWithdrawBtn) {
        addSafeClickListener(notifyWithdrawBtn, async () => {
            const withdrawAmount = parseFloat(document.getElementById('withdraw-amount').value);
            const withdrawWallet = document.getElementById('withdraw-wallet').value;
            if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
                showNotification('Please enter a valid withdraw amount.');
                return;
            }
            if (!withdrawWallet) {
                showNotification('Please enter your wallet address.');
                return;
            }
            if (piBalance < withdrawAmount) {
                showNotification('Insufficient PI balance for withdrawal.');
                return;
            }
            await saveTransaction('withdraw', withdrawAmount, withdrawWallet);
        });
    }

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

    if (exchangeAmountElement) {
        exchangeAmountElement.addEventListener("input", updateExchangeResult);
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

    initializeGame();
});

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

// Handle plot click with manual growth
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

// Fungsi paksa layout agar grid langsung kebentuk
function forceReflow(el) {
    void el.offsetHeight;
}

// Render shop dengan item sayuran
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
            <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: ${farmPrice} ${langData[currentLang]?.coinLabel || 'Coins'}</p>
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
        <p>${langData[currentLang]?.farmPriceLabel || 'Farm Price'}: 100 ${langData[currentLang]?.coinLabel || 'Coins'}</p>
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

// Tambahkan ke inventory
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
                if (piBalance >= 0.0001) { // Ganti pi jadi piBalance
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
            if (piBalance >= veg.piPrice) { // Ganti pi jadi piBalance
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
            <p>${langData[currentLang]?.sellPriceLabel || 'Sell Price'}: ${sellPrice} ${langData[currentLang]?.coinLabel || 'Coins'}</p>
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

// Fungsi untuk langsung buka tab Sell di dalam Shop
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
    } else {
        console.warn('Tab or tab button not found:', tab);
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
    } else if (tab === 'admin') {
        renderAdminPanel();
    }

    playMenuSound();
}

// Render admin panel
function renderAdminPanel() {
    const adminTransactionsElement = document.getElementById('admin-transactions');
    if (!adminTransactionsElement) return;

    const transactionsRef = ref(database, 'transactions');
    onValue(transactionsRef, (snapshot) => {
        const transactions = snapshot.val();
        if (!transactions) {
            adminTransactionsElement.innerHTML = '<p>No transactions found.</p>';
            return;
        }

        adminTransactionsElement.innerHTML = '';
        Object.entries(transactions).forEach(([key, transaction]) => {
            const transactionDiv = document.createElement('div');
            transactionDiv.classList.add('transaction-item');
            transactionDiv.innerHTML = `
                <p><strong>Transaction ID:</strong> ${transaction.transactionId}</p>
                <p><strong>User ID:</strong> ${transaction.userId}</p>
                <p><strong>User Email:</strong> ${transaction.userEmail}</p>
                <p><strong>Type:</strong> ${transaction.type}</p>
                <p><strong>Amount:</strong> ${transaction.amount} PI</p>
                <p><strong>Wallet Address:</strong> ${transaction.walletAddress}</p>
                <p><strong>Status:</strong> ${transaction.status}</p>
                <p><strong>Timestamp:</strong> ${transaction.timestamp}</p>
                <button class="approve-btn" data-key="${key}">Approve</button>
                <button class="reject-btn" data-key="${key}">Reject</button>
            `;
            adminTransactionsElement.appendChild(transactionDiv);
        });

        const approveButtons = document.querySelectorAll('.approve-btn');
        approveButtons.forEach(btn => {
            addSafeClickListener(btn, async () => {
                const key = btn.getAttribute('data-key');
                const transactionRef = ref(database, `transactions/${key}`);
                await update(transactionRef, { status: 'approved' });
                showNotification('Transaction approved!');
                renderAdminPanel();
            });
        });

        const rejectButtons = document.querySelectorAll('.reject-btn');
        rejectButtons.forEach(btn => {
            addSafeClickListener(btn, async () => {
                const key = btn.getAttribute('data-key');
                const transactionRef = ref(database, `transactions/${key}`);
                await update(transactionRef, { status: 'rejected' });
                showNotification('Transaction rejected!');
                renderAdminPanel();
            });
        });
    });
}

// Exchange PI to Farm Coins
let currentExchangeRate = 1000000;

function loadExchangeRate() {
    const rateRef = ref(database, "exchangeRate/liveRate");
    onValue(rateRef, (snapshot) => {
        currentExchangeRate = snapshot.val() || currentExchangeRate;
        const rateEl = document.getElementById("live-rate");
        if (rateEl) rateEl.textContent = `1 PI = ${currentExchangeRate.toLocaleString()} FC`;
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
    const playerRef = ref(database, `players/${userId}`);
    const snapshot = await get(playerRef);
    const data = snapshot.val();

    if (!data) return showNotification("Player data not found!");
    if (isNaN(amount) || amount <= 0) return showNotification("Invalid amount!");

    let pi = Number(data.piBalance || 0);
    let fc = Number(data.farmCoins || 0);
    let resultText = "";

    if (direction === "piToFc") {
        if (pi < amount) return showNotification("Not enough PI!");
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

    piBalance = Math.round(pi * 1000000) / 1000000; // Ganti pi jadi piBalance
    farmCoins = Math.floor(fc);

    document.getElementById("exchange-loading").style.display = "block";

    setTimeout(() => {
        (async () => {
            try {
                await update(playerRef, {
                    piBalance: piBalance, // Ganti pi jadi piBalance
                    farmCoins: farmCoins
                });

                const piElem = document.getElementById("pi-balance");
                const fcElem = document.getElementById("fc-balance");
                if (piElem) piElem.textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
                if (fcElem) fcElem.textContent = farmCoins.toLocaleString();
                document.getElementById("exchange-amount").value = "";
                updateExchangeResult(resultText);
                playCoinSound();
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
        exchangeBtn.textContent = "Exchange to PI";
    }
});

directionSelect.dispatchEvent(new Event("change"));

// Modal untuk daily reward
if (claimModalBtn) {
    addSafeClickListener(document.getElementById('claim-reward-btn'), async () => {
        const playerRef = ref(database, `players/${userId}/lastClaim`);
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
        if (!userId) return;

        farmCoins += 100;
        water += 50;
        xp += 20;

        const today = new Date().toISOString();
        lastClaim = today;
        claimedToday = true;

        const playerRef = ref(database, `players/${userId}`);
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
    if (!userId) return;

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

// Show notification
function showNotification(message) {
    const notificationElement = document.getElementById('notification');
    if (!notificationElement) return;

    notificationElement.textContent = message;
    notificationElement.style.display = 'block';

    setTimeout(() => {
        notificationElement.style.display = 'none';
    }, 3000);
}

// Start game
function startGame() {
    const startScreenElement = document.getElementById('start-screen');
    const gameScreenElement = document.getElementById('game-screen');
    if (startScreenElement && gameScreenElement) {
        startScreenElement.style.display = 'none';
        gameScreenElement.style.display = 'block';
        playBgMusic();
        playBgVoice();
    }
}

// Toggle language
function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'id' : 'en';
    updateUIText();
    renderShop();
    renderInventory();
    renderSellSection();
    renderAchievements();
    checkDailyReward();
}

// Update UI text
function updateUIText() {
    const titleElement = document.getElementById('title');
    const gameTitleElement = document.getElementById('game-title');
    const langToggleElement = document.getElementById('lang-toggle');
    const gameLangToggleElement = document.getElementById('game-lang-toggle');
    const settingsTitleElement = document.getElementById('settings-title');
    const musicVolumeLabelElement = document.getElementById('music-volume-label');
    const voiceVolumeLabelElement = document.getElementById('voice-volume-label');
    const dailyRewardTitleElement = document.getElementById('daily-reward-title');
    const upgradesTitleElement = document.getElementById('upgrades-title');
    const upgradesContentElement = document.getElementById('upgrades-content');
    const sellSectionTitleElement = document.getElementById('sell-section-title');
    const leaderboardTitleElement = document.getElementById('leaderboard-title');
    const leaderboardContentElement = document.getElementById('leaderboard-content');
    const exchangeTitleElement = document.querySelector('.exchange-title');

    if (titleElement) titleElement.textContent = langData[currentLang]?.title || 'Harvest Pi';
    if (gameTitleElement) gameTitleElement.textContent = langData[currentLang]?.title || 'Harvest Pi';
    if (langToggleElement) langToggleElement.textContent = langData[currentLang]?.switchLang || 'Switch Language (EN/ID)';
    if (gameLangToggleElement) gameLangToggleElement.textContent = langData[currentLang]?.switchLang || 'Switch Language (EN/ID)';
    if (settingsTitleElement) settingsTitleElement.textContent = langData[currentLang]?.settingsTitle || 'Settings';
    if (musicVolumeLabelElement) musicVolumeLabelElement.textContent = langData[currentLang]?.musicVolumeLabel || 'Music Volume:';
    if (voiceVolumeLabelElement) voiceVolumeLabelElement.textContent = langData[currentLang]?.voiceVolumeLabel || 'Voice/SFX Volume:';
    if (dailyRewardTitleElement) dailyRewardTitleElement.textContent = langData[currentLang]?.dailyRewardTitle || 'Daily Reward';
    if (upgradesTitleElement) upgradesTitleElement.textContent = langData[currentLang]?.upgradesTitle || 'Upgrades';
    if (upgradesContentElement) upgradesContentElement.textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    if (sellSectionTitleElement) sellSectionTitleElement.textContent = langData[currentLang]?.sellSectionTitle || 'Sell Items';
    if (leaderboardTitleElement) leaderboardTitleElement.textContent = langData[currentLang]?.leaderboardTitle || 'Leaderboard';
    if (leaderboardContentElement) leaderboardContentElement.textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    if (exchangeTitleElement) exchangeTitleElement.textContent = langData[currentLang]?.exchangeTitle || 'Live Exchange';

    updateWallet();
}

// Check harvest achievement
function checkHarvestAchievement() {
    if (harvestCount >= 5 && !achievements.harvest) {
        achievements.harvest = true;
        showNotification(langData[currentLang]?.harvestAchievement || 'Achievement Unlocked: Harvest Master!');
        renderAchievements();
        savePlayerData();
    }
}

// Check coin achievement
function checkCoinAchievement() {
    if (farmCoins >= 1000 && !achievements.coins) {
        achievements.coins = true;
        showNotification(langData[currentLang]?.coinAchievement || 'Achievement Unlocked: Coin Collector!');
        renderAchievements();
        savePlayerData();
    }
}

// Render achievements
function renderAchievements() {
    const achievementsContentElement = document.getElementById('achievements-content');
    if (!achievementsContentElement) {
        console.error('achievements-content element not found');
        return;
    }

    achievementsContentElement.innerHTML = '';

    const harvestAch = document.createElement('div');
    harvestAch.classList.add('achievement');
    harvestAch.innerHTML = `
        <h3>${langData[currentLang]?.harvestAchievement || 'Harvest Master'}</h3>
        <p>${langData[currentLang]?.harvestDesc || 'Harvest 5 crops'}</p>
        <p>${achievements.harvest ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
    `;
    achievementsContentElement.appendChild(harvestAch);

    const coinAch = document.createElement('div');
    coinAch.classList.add('achievement');
    coinAch.innerHTML = `
        <h3>${langData[currentLang]?.coinAchievement || 'Coin Collector'}</h3>
        <p>${langData[currentLang]?.coinDesc || 'Collect 1000 Farm Coins'}</p>
        <p>${achievements.coins ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
    `;
    achievementsContentElement.appendChild(coinAch);
}

// Show transaction animation
function showTransactionAnimation(amountText, isPositive, buttonElement) {
    if (!buttonElement) return;

    const amountElement = document.createElement('div');
    amountElement.textContent = amountText;
    amountElement.classList.add('amount-text', isPositive ? 'positive' : 'negative');
    buttonElement.appendChild(amountElement);

    setTimeout(() => {
        if (amountElement.parentNode) amountElement.remove();
    }, 800);
}

// Fullscreen functions
function enterFullScreen() {
    const docEl = document.documentElement;
    if (docEl.requestFullscreen) {
        docEl.requestFullscreen();
    } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
    } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
    } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
    }
}

function exitFullScreen() {
    if (document.exitFullscreen) {
        document.exitFullscreen();
    } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
    } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
    }
}

// Initialize game
function initializeGame() {
    loadData();
    updateUIText();
    loadUserBalances();
}
