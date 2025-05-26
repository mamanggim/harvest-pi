// Ambil database dan auth dari firebase-config.js (cuma pake database)
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
let encodedEmail = null; // Sekarang pake Pi User ID langsung
let username = null; // Pake Pi User ID sebagai username
let lastClaim = null;
const plotCount = 4;
const piToFarmRate = 1000000;
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;

// Load user balances
function loadUserBalances() {
    if (!encodedEmail) {
        console.warn('No Pi ID, please login first!');
        return;
    }
    const playerRef = ref(database, `players/${encodedEmail}`);
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

// Panggil update pertama kali setelah semua siap
updateVolumes();

// START loadData fix
async function loadData() {
    try {
        const langRes = await fetch('/data/lang.json');
        if (!langRes.ok) {
            throw new Error(`Failed to fetch lang.json: ${langRes.statusText}`);
        }
        langData = await langRes.json();
        console.log('Language data loaded:', langData);

        const vegRes = await fetch('/data/vegetables.json');
        if (!vegRes.ok) {
            throw new Error(`Failed to fetch vegetables.json: ${vegRes.statusText}`);
        }
        const vegJson = await vegRes.json();
        vegetables = vegJson.vegetables;
        console.log('Vegetables data loaded:', vegetables);
    } catch (error) {
        console.error('Error loading data:', error.message);
        showNotification('Error loading game data: ' + error.message);
        // Fallback kalo gagal load
        langData[currentLang] = { title: 'Harvest Pi', startGame: 'Start Game' }; // Minimal data biar ga stuck
        vegetables = [];
    }
}
// END loadData fix

// Login dengan Pi Network SDK
async function loginWithPi() {
    // Cek kalo ga di Pi Browser
    if (!window.Pi || !window.Pi.authenticate) {
        showNotification('This app must be opened in Pi Browser to login with Pi. Please switch to Pi Browser.');
        return;
    }

    try {
        await new Promise((resolve) => {
            window.Pi = window.Pi || {};
            if (window.Pi.init) {
                resolve();
            } else {
                const script = document.createElement('script');
                script.src = 'https://sdk.minepi.com/pi-sdk.js';
                script.onload = resolve;
                document.body.appendChild(script);
            }
        });
        await window.Pi.init({ version: "2.0" });

        const scopes = ['payments'];
        const authResult = await new Promise((resolve, reject) => {
            window.Pi.authenticate(scopes, resolve, reject);
        });

        const piUserId = authResult.userId;
        console.log('Login berhasil, User ID:', piUserId);

        // Simpan Pi ID langsung sebagai key database
        encodedEmail = `pi_${piUserId}`; // Format unik buat Pi user
        username = piUserId; // Pake Pi ID sebagai username
        localStorage.setItem('encodedEmail', encodedEmail);
        localStorage.setItem('username', username);

        // Load data player berdasarkan Pi ID
        loadPlayerData();

        // Pindah ke start screen
        const loginScreenElement = document.getElementById('login-screen');
        const startScreenElement = document.getElementById('start-screen');
        if (loginScreenElement && startScreenElement) {
            loginScreenElement.style.display = 'none';
            startScreenElement.style.display = 'flex';
        }
        updateReferralLink();
        handleReferral();
    } catch (error) {
        console.error('Error login dengan Pi:', error);
        showNotification('Gagal login, cek koneksi Pi Browser atau coba lagi.');
    }
}

// Event listener buat tombol login Pi
const piLoginBtn = document.getElementById('pi-login-btn');
if (piLoginBtn) {
    addSafeClickListener(piLoginBtn, loginWithPi);
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

// Save player data to Firebase
async function savePlayerData() {
    if (!encodedEmail || !isDataLoaded) return;
    const playerRef = ref(database, `players/${encodedEmail}`);

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
        claimedToday,
        referralEarnings,
        totalReferrals,
        username
    };

    try {
        await update(playerRef, dataToSave);
        console.log('Player data saved');
    } catch (error) {
        console.error('Error saving player data:', error.message);
        showNotification('Error saving data: ' + error.message);
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

// START renderSellSection
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
// END renderSellSection

// START sellItem
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
// END sellItem

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

// Update referral link setelah login
function updateReferralLink() {
    const referralLinkElement = document.getElementById('referral-link');
    const copyReferralBtn = document.getElementById('copy-referral-btn');
    const totalReferralsElement = document.getElementById('total-referrals');
    if (referralLinkElement) {
        const userUsername = localStorage.getItem('username');
        if (!userUsername) {
            console.warn('Username not found in localStorage');
            return;
        }
        const link = generateReferralLink(userUsername);
        referralLinkElement.textContent = link;
        if (copyReferralBtn) {
            addSafeClickListener(copyReferralBtn, () => {
                copyToClipboard(link, copyReferralBtn);
                showNotification('Referral link copied!');
            });
        }
    }
    if (totalReferralsElement && encodedEmail) {
        const referralRef = ref(database, `referrals/${localStorage.getItem('username')}`);
        get(referralRef).then((snapshot) => {
            const referrals = snapshot.val() || {};
            const total = Object.keys(referrals).length;
            totalReferralsElement.textContent = total;
        });
    }
}

// Fungsi generate referral link
function generateReferralLink(username) {
    return `https://www.harvestpi.biz.id/?ref=${username}`;
}

// Handle referral link dari URL
function handleReferral() {
    const urlParams = new URLSearchParams(window.location.search);
    const referralUsername = urlParams.get('ref');
    const userUsername = localStorage.getItem('username');

    if (referralUsername && userUsername && referralUsername !== userUsername) {
        const referrerRef = ref(database, `players`);
        get(referrerRef).then((snapshot) => {
            const playersData = snapshot.val();
            if (!playersData) return;

            let referrerEncodedEmail = null;
            for (const [encodedEmail, playerData] of Object.entries(playersData)) {
                if (playerData.username === referralUsername) {
                    referrerEncodedEmail = encodedEmail;
                    break;
                }
            }

            if (!referrerEncodedEmail) {
                console.warn('Referrer not found for username:', referralUsername);
                return;
            }

            const referrerPlayerRef = ref(database, `players/${referrerEncodedEmail}`);
            const referralRef = ref(database, `referrals/${referralUsername}`);

            get(referrerPlayerRef).then((playerSnapshot) => {
                if (playerSnapshot.exists()) {
                    const referrerData = playerSnapshot.val();
                    const newReferralEarnings = (referrerData.referralEarnings || 0) + 100;
                    const totalReferrals = (referrerData.totalReferrals || 0) + 1;

                    update(referrerPlayerRef, {
                        referralEarnings: newReferralEarnings,
                        totalReferrals: totalReferrals
                    }).then(() => {
                        console.log(`Referral bonus (100) given to ${referralUsername}`);
                        showNotification('Referral bonus (100 PI) given to referrer!');
                    }).catch(err => {
                        console.error('Error updating referral earnings:', err);
                    });

                    set(referralRef, {
                        referrer: referralUsername,
                        referred: userUsername,
                        earnings: 100,
                        timestamp: Date.now(),
                        totalReferrals: 1
                    }).catch(err => {
                        console.error('Error saving referral data:', err);
                    });
                }
            }).catch(err => {
                console.error('Error fetching referrer data:', err);
            });
        }).catch(err => {
            console.error('Error fetching players data:', err);
        });
    }
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

// Initialize game
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const loadDataPromise = loadData();
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Load data timed out')), 10000);
        });
        await Promise.race([loadDataPromise, timeoutPromise]);
    } catch (error) {
        console.error('Load data failed:', error.message);
        showNotification('Failed to load game data: ' + error.message);
    }
    updateUIText();

    const tabButtons = document.querySelectorAll('.tab-btn');
    if (tabButtons) {
        tabButtons.forEach(btn => {
            addSafeClickListener(btn, () => {
                const tab = btn.getAttribute('data-tab');
                switchTab(tab);
            });
        });
    }

    const startBtn = document.getElementById('start-btn');
    if (startBtn) {
        addSafeClickListener(startBtn, () => {
            const startScreenElement = document.getElementById('start-screen');
            const gameScreenElement = document.getElementById('game-screen');
            if (startScreenElement && gameScreenElement) {
                startScreenElement.style.display = 'none';
                gameScreenElement.style.display = 'block';
                playBgMusic();
                playBgVoice();
                initializePlots();
                updateWallet();
                updateReferralLink();
                handleReferral();
                loadAdminTransactions();
            }
        });
    }

    // Cek kalo ga di Pi Browser pas load
    if (!window.Pi || !window.Pi.authenticate) {
        showNotification('This app must be opened in Pi Browser to login with Pi. Please switch to Pi Browser.');
    }
});
