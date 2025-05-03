// Ambil database dan auth dari firebase-config.js
import { database, auth } from '../firebase/firebase-config.js';
import { ref, onValue, set, update, get } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
let achievements = { harvest: false, coins: false };
let userId = null;
let lastClaim = null;
const plotCount = 4; // 2x2 grid
const piToFarmRate = 1000000; // 1 PI = 1,000,000 Farm Coins
let claimedToday = false; // Flag sederhana buat status klaim
let isClaiming = false; // Tambah untuk lock claim
let isAudioPlaying = false; // Flag to track audio state

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
    } else {
        console.log('BG Music already playing or bgMusic not found:', bgMusic, isAudioPlaying);
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
    } else {
        console.log('BG Voice already playing or bgVoice not found:', bgVoice, isAudioPlaying);
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

function updateVolumes() {
    const musicVolume = parseFloat(localStorage.getItem('musicVolume')) || 50;
    const voiceVolume = parseFloat(localStorage.getItem('voiceVolume')) || 50;
    console.log('Updating volumes:', { musicVolume, voiceVolume });

    const musicVol = Math.min(Math.max(musicVolume / 100, 0), 1);
    const voiceVol = Math.min(Math.max(voiceVolume / 100, 0), 1);

    if (bgMusic) {
        bgMusic.volume = musicVol;
        console.log('BG Music volume set to:', bgMusic.volume);
        if (isAudioPlaying) bgMusic.play().catch(e => console.log('BG Music play failed after volume change:', e));
    }
    if (bgVoice) {
        bgVoice.volume = voiceVol;
        console.log('BG Voice volume set to:', bgVoice.volume);
        bgVoice.play().catch(e => console.log('BG Voice play failed after volume change:', e));
    }
    if (harvestingSound) {
        harvestingSound.volume = voiceVol;
        console.log('Harvesting sound volume set to:', harvestingSound.volume);
    }
    if (wateringSound) {
        wateringSound.volume = voiceVol;
        console.log('Watering sound volume set to:', wateringSound.volume);
    }
    if (plantingSound) {
        plantingSound.volume = voiceVol;
        console.log('Planting sound volume set to:', plantingSound.volume);
    }
    if (menuSound) {
        menuSound.volume = voiceVol;
        console.log('Menu sound volume set to:', menuSound.volume);
    }
    if (buyingSound) {
        buyingSound.volume = voiceVol;
        console.log('Buying sound volume set to:', buyingSound.volume);
    }
    if (coinSound) {
        coinSound.volume = voiceVol;
        console.log('Coin sound volume set to:', coinSound.volume);
    }
}

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

// Authenticate with Pi Network
function authenticateWithPi() {
  if (!window.Pi) {
    console.error('Pi SDK not loaded');
    showNotification('Pi Network SDK not available. Please try again later.');
    return;
  }

  const scopes = ['username', 'email', 'payments'];
  Pi.init({ version: "2.0" }).then(() => {
    Pi.authenticate(scopes, onIncompletePaymentFound)
      .then(authResult => {
        console.log('Pi Auth success:', authResult);
        const user = authResult.user;
        userId = user.email || `${user.username}@pi-network.com`;
        const playerRef = ref(database, `players/${userId}`);

        update(playerRef, {
          piUser: {
            uid: user.uid,
            username: user.username,
            email: user.email || null
          },
          pi: pi || 0
        }).then(() => {
          showNotification(`Logged in as ${user.username} (Email: ${user.email || 'Not provided'})`);
          document.getElementById('login-screen').style.display = 'none';
          document.getElementById('start-screen').style.display = 'flex';
          loadPlayerData();
        }).catch(error => {
          console.error('Error saving Pi user data:', error);
          showNotification('Failed to save Pi user data: ' + error.message);
        });
      })
      .catch(error => {
        console.error('Pi Auth failed:', error);
        showNotification('Pi Network login failed: ' + error.message);
      });
  }).catch(error => {
    console.error('Pi init failed:', error);
    showNotification('Failed to initialize Pi SDK: ' + error.message);
  });
}

function onIncompletePaymentFound(payment) {
  console.log("onIncompletePaymentFound", payment);
  // Kalo gak pake backend, biarin kosong kayak gini
}

// Modal SignIn
function showModal() {
  document.getElementById('signInModal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('signInModal').style.display = 'none';
}

// Cek kalo user belum login, tampilkan modal
document.addEventListener('DOMContentLoaded', () => {
  if (!localStorage.getItem('userId')) {
    showModal();
  }
});

// Load player data
async function loadPlayerData() {
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
                pi = data.pi || 0;
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
                    pi: 0,
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
                set(playerRef, initialData).catch(err => {
                    console.error('Initial set failed:', err);
                    showNotification('Error initializing player data.');
                });
            }

            isDataLoaded = true;
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
        console.error('Error loading player data:', error.message);
        showNotification('Failed to connect to Firebase. Please check your internet connection and reload.');
        isDataLoaded = false;
    }
}

// Save player data to Firebase
function savePlayerData() {
    if (!userId || !isDataLoaded) return;
    const playerRef = ref(database, `players/${userId}`);

    const dataToSave = {
        farmCoins,
        pi,
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

    return update(playerRef, dataToSave).catch(error => {
        console.error('Error saving player data:', error.message);
        showNotification('Error saving player data: ' + error.message);
        throw error;
    });
}

// Update wallet UI
function updateWallet() {
    document.getElementById('farm-coins').textContent = `${farmCoins} ${langData[currentLang]?.coinLabel || 'Coins'}`;
    document.getElementById('pi-coins').textContent = `${pi.toFixed(2)} PI`;
    document.getElementById('water').textContent = `${water} ${langData[currentLang]?.waterLabel || 'Water'}`;
    document.getElementById('level').textContent = `Level: ${level} | XP: ${xp}`;
    const xpPercentage = (xp / (level * 100)) * 100;
    document.getElementById('xp-fill').style.width = `${xpPercentage}%`;
    savePlayerData();
}

// Initialize farm plots
function initializePlots() {
    const farmArea = document.getElementById('farm-area');
    if (!farmArea) {
        console.error('farm-area element not found');
        showNotification('farm-area element not found');
        return;
    }

    farmArea.innerHTML = '';

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
        farmArea.appendChild(plotElement);

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
                            plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
                            plantImg.onerror = () => { plantImg.src = 'assets/img/ui/placeholder.png'; };
                            setTimeout(() => {
                                plantImg.classList.add('loaded');
                            }, 50);
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
                plantImg.src = `${vegetable.baseImage}${plot.currentFrame}.png`;
                plantImg.onerror = () => { plantImg.src = 'assets/img/ui/placeholder.png'; };
                plotContent.appendChild(plantImg);
                setTimeout(() => {
                    plantImg.classList.add('loaded');
                }, 50);
            }, 800);

            plotStatus.innerHTML = langData[currentLang]?.needsWater || 'Needs Water';
            countdownFill.style.width = '0%';

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
                        plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
                        plantImg.onerror = () => { plantImg.src = 'assets/img/ui/placeholder.png'; };
                        setTimeout(() => {
                            plantImg.classList.add('loaded');
                        }, 50);
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
        const imageSrc = plot.vegetable?.shopImage ? plot.vegetable.shopImage : 'assets/img/ui/placeholder.png';
        flyImage.src = imageSrc;
        flyImage.onerror = () => {
            console.log(`Failed to load fly image: ${imageSrc}, using placeholder`);
            flyImage.src = 'assets/img/ui/placeholder.png';
        };
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
    const shopContent = document.getElementById('shop-content');
    if (!shopContent) {
        console.error('shop-content element not found');
        return;
    }

    forceReflow(shopContent);
    shopContent.style.display = 'grid';

    if (!langData[currentLang]) {
        console.warn('Language data missing, skipping renderShop');
        shopContent.innerHTML = `<p style="color:red;">Language data not loaded. Please reload.</p>`;
        return;
    }

    if (!Array.isArray(vegetables) || vegetables.length === 0) {
        console.warn('Vegetables not loaded or invalid');
        shopContent.innerHTML = `<p>${langData[currentLang]?.noItems || 'No items available in shop.'}</p>`;
        return;
    }

    shopContent.innerHTML = '';

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
        addSafeClickListener(btn, () => {
            const id = btn.getAttribute('data-id');
            buyVegetable(id, 'farm');
        });
    });

    document.querySelectorAll('.buy-pi-btn').forEach(btn => {
        addSafeClickListener(btn, () => {
            const id = btn.getAttribute('data-id');
            buyVegetable(id, 'pi');
        });
    });
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
                showNotification(langData[currentLang]?.notEnoughCoins || 'Not Enough Coins!');
            }
        } else {
            if (pi >= 0.0001) {
                pi -= 0.0001;
                water += 10;
                updateWallet();
                showTransactionAnimation(`-0.0001 PI`, false, document.querySelector(`.buy-pi-btn[data-id="water"]`));
                playBuyingSound();
            } else {
                showNotification(langData[currentLang]?.notEnoughPi || 'Not Enough PI!');
            }
        }
        return;
    }

    const veg = vegetables.find(v => v.id === id);
    if (!veg) {
        console.warn(`Vegetable with id ${id} not found`);
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
        if (pi >= veg.piPrice) {
            pi -= veg.piPrice;
            canBuy = true;
            showTransactionAnimation(`-${veg.piPrice} PI`, false, document.querySelector(`.buy-pi-btn[data-id="${id}"]`));
        } else {
            showNotification(langData[currentLang]?.notEnoughPi || 'Not Enough PI!');
        }
    }

    if (canBuy) {
        addToInventory('seed', veg, 1);
        savePlayerData();
        updateWallet();
        renderInventory();
        playBuyingSound();
    }
}

// Render inventory
function renderInventory() {
    const inventoryContent = document.getElementById('inventory-content');
    if (!inventoryContent) {
        console.error('inventory-content element not found');
        showNotification('inventory-content element not found');
        return;
    }

    if (!langData[currentLang]) {
        console.error('Language data not loaded');
        return;
    }

    inventoryContent.innerHTML = '';

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

        inventoryContent.appendChild(invItem);
        hasItems = true;
    });

    if (!hasItems) {
        const noItemText = document.createElement('p');
        noItemText.textContent = langData[currentLang]?.noInventory || 'No items in inventory.';
        inventoryContent.appendChild(noItemText);
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

// START renderSellSection
function renderSellSection() {
    const sellContent = document.getElementById('sell-content');
    if (!sellContent) {
        console.error('sell-content element not found');
        return;
    }

    if (!langData[currentLang]) {
        console.warn('Language data missing');
        sellContent.innerHTML = '<p style="color:red;">Language data not loaded</p>';
        return;
    }

    sellContent.innerHTML = '';

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

        sellContent.appendChild(sellDiv);
        hasItems = true;
    });

    if (!hasItems) {
        sellContent.innerHTML = `<p>${langData[currentLang]?.noSellableItems || 'No items to sell.'}</p>`;
    }

    document.querySelectorAll('.sell-btn').forEach(btn => {
        addSafeClickListener(btn, () => {
            const index = parseInt(btn.getAttribute('data-index'));
            sellItem(index);
        });
    });
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

    const buyTab = document.getElementById('shop-buy-tab');
    const sellTab = document.getElementById('shop-sell-tab');
    const shopContent = document.getElementById('shop-content');
    const sellContent = document.getElementById('sell-section');

    if (sellTab && buyTab && shopContent && sellContent) {
        sellTab.classList.add('active');
        buyTab.classList.remove('active');
        shopContent.style.display = 'none';
        sellContent.style.display = 'block';
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
    }

    playMenuSound();
}

// Exchange PI to Farm Coins
function exchangePi() {
    const amount = parseFloat(document.getElementById('exchange-amount').value);
    if (isNaN(amount) || amount <= 0) {
        showNotification(langData[currentLang]?.invalidAmount || 'Invalid amount!');
        return;
    }

    if (pi >= amount) {
        pi -= amount;
        farmCoins += amount * piToFarmRate;
        updateWallet();
        showNotification(langData[currentLang]?.exchanged || 'Exchanged!');
        playCoinSound();
        checkCoinAchievement();
        updateExchangeResult();
    } else {
        showNotification(langData[currentLang]?.notEnoughPi || 'Not Enough PI!');
    }
}

// Update exchange result
function updateExchangeResult() {
    const amount = parseFloat(document.getElementById('exchange-amount').value) || 0;
    const farmCoinsResult = amount * piToFarmRate;
    document.getElementById('exchange-result').textContent = farmCoinsResult;
}

// Modal untuk daily reward
addSafeClickListener(document.getElementById('claim-reward-btn'), async () => {
    const playerRef = ref(database, `players/${userId}/lastClaim`);
    try {
        const snapshot = await get(playerRef);
        lastClaim = snapshot.val();

        const today = new Date().toISOString().split('T')[0];
        const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;

        if (lastClaimDate === today) {
            document.getElementById('claim-reward-btn').classList.add('claimed');
            document.getElementById('claim-reward-btn').textContent = langData[currentLang]?.claimed || 'Claimed!';
            document.getElementById('claim-reward-btn').disabled = true;
            claimedToday = true;
            return;
        }

        if (isClaiming) return;
        isClaiming = true;

        rewardModal.style.display = 'block';
        document.getElementById('daily-reward-text').textContent = `${langData[currentLang]?.dailyRewardText || 'You got +100 Farm Coins & +50 Water!'}`;
    } catch (error) {
        console.error('Error checking last claim:', error.message);
        showNotification('Error checking daily reward.');
        isClaiming = false;
    }
});

// Claim daily reward
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
        rewardModal.style.display = 'none';
        document.getElementById('claim-reward-btn').classList.add('claimed');
        document.getElementById('claim-reward-btn').textContent = langData[currentLang]?.claimed || 'Claimed!';
        document.getElementById('claim-reward-btn').disabled = true;
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

// Check daily reward
function checkDailyReward() {
    if (!userId) return;

    const today = new Date().toISOString().split('T')[0];
    const lastClaimDate = lastClaim ? new Date(lastClaim).toISOString().split('T')[0] : null;

    if (lastClaimDate === today) {
        document.getElementById('claim-reward-btn').classList.add('claimed');
        document.getElementById('claim-reward-btn').textContent = langData[currentLang]?.claimed || 'Claimed!';
        document.getElementById('claim-reward-btn').disabled = true;
        claimedToday = true;
    } else {
        document.getElementById('claim-reward-btn').classList.remove('claimed');
        document.getElementById('claim-reward-btn').textContent = langData[currentLang]?.claimDailyReward || 'Claim Daily Reward';
        document.getElementById('claim-reward-btn').disabled = false;
        claimedToday = false;
    }
}

// Show notification
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.style.display = 'block';

    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Show transaction animation
function showTransactionAnimation(amount, isPositive, buttonElement) {
    const animation = document.createElement('div');
    animation.classList.add('transaction-animation');
    animation.classList.add(isPositive ? 'positive' : 'negative');
    animation.textContent = amount;

    document.body.appendChild(animation);

    const rect = buttonElement.getBoundingClientRect();
    animation.style.left = `${rect.left + rect.width / 2}px`;
    animation.style.top = `${rect.top - 20}px`;

    setTimeout(() => {
        animation.remove();
    }, 1000);
}

// Check harvest achievement
function checkHarvestAchievement() {
    if (harvestCount >= 10 && !achievements.harvest) {
        achievements.harvest = true;
        farmCoins += 500;
        showNotification(langData[currentLang]?.harvestAchievement || 'Achievement Unlocked: Harvest Master! +500 Coins');
        updateWallet();
        renderAchievements();
    }
}

// Check coin achievement
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

    achievementsContent.innerHTML = '';

    const harvestAchievement = document.createElement('div');
    harvestAchievement.classList.add('achievement');
    harvestAchievement.innerHTML = `
        <h3>${langData[currentLang]?.harvestAchievementTitle || 'Harvest Master'}</h3>
        <p>${langData[currentLang]?.harvestAchievementDesc || 'Harvest 10 crops'}</p>
        <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.harvest ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
    `;
    achievementsContent.appendChild(harvestAchievement);

    const coinAchievement = document.createElement('div');
    coinAchievement.classList.add('achievement');
    coinAchievement.innerHTML = `
        <h3>${langData[currentLang]?.coinAchievementTitle || 'Coin Collector'}</h3>
        <p>${langData[currentLang]?.coinAchievementDesc || 'Collect 1000 Farm Coins'}</p>
        <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.coins ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
    `;
    achievementsContent.appendChild(coinAchievement);

    savePlayerData();
}

// Update UI text based on language
function updateUIText() {
    if (!langData[currentLang]) return;

    document.getElementById('title').textContent = langData[currentLang]?.title || 'Harvest Pi';
    document.getElementById('game-title').textContent = langData[currentLang]?.title || 'Harvest Pi';
    document.getElementById('start-text').textContent = langData[currentLang]?.startGame || 'Start Game';

    document.querySelector('.tab-btn[data-tab="farm"]').textContent = langData[currentLang]?.farmTab || 'Farm';
    document.querySelector('.tab-btn[data-tab="shop"]').textContent = langData[currentLang]?.shopTab || 'Shop';
    document.querySelector('.tab-btn[data-tab="upgrades"]').textContent = langData[currentLang]?.upgradesTab || 'Upgrades';
    document.querySelector('.tab-btn[data-tab="inventory"]').textContent = langData[currentLang]?.inventoryTab || 'Inventory';
    document.querySelector('.tab-btn[data-tab="exchange"]').textContent = langData[currentLang]?.exchangeTab || 'Exchange';
    document.querySelector('.tab-btn[data-tab="depositPi"]').textContent = langData[currentLang]?.depositPiTab || 'Deposit Pi Coin';
    document.querySelector('.tab-btn[data-tab="leaderboard"]').textContent = langData[currentLang]?.leaderboardTab || 'Leaderboard';
    document.querySelector('.tab-btn[data-tab="achievements"]').textContent = langData[currentLang]?.achievementsTab || 'Achievements';

    document.getElementById('lang-toggle').textContent = langData[currentLang]?.switchLang || 'Switch Language (EN/ID)';
    document.getElementById('game-lang-toggle').textContent = langData[currentLang]?.switchLang || 'Switch Language (EN/ID)';
    document.getElementById('upgrades-title').textContent = langData[currentLang]?.upgradesTitle || 'Upgrades';
    document.getElementById('upgrades-content').textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    document.getElementById('exchange-title').textContent = langData[currentLang]?.exchangeTitle || 'Exchange';
    document.getElementById('exchange-rate').textContent = `${langData[currentLang]?.exchangeRate || '1 PI = 1,000,000 Farm Coins'}`;
    document.getElementById('exchange-amount').placeholder = langData[currentLang]?.enterPiAmount || 'Enter PI amount';
    document.getElementById('exchange-result-label').textContent = `${langData[currentLang]?.farmCoinsLabel || 'Farm Coins'}: `;
    document.getElementById('exchange-btn').textContent = langData[currentLang]?.exchangeButton || 'Exchange to Farm Coins';
    document.getElementById('leaderboard-title').textContent = langData[currentLang]?.leaderboardTitle || 'Leaderboard';
    document.getElementById('leaderboard-content').textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    document.getElementById('settings-title').textContent = langData[currentLang]?.settingsTitle || 'Settings';
    document.getElementById('music-volume-label').textContent = langData[currentLang]?.musicVolumeLabel || 'Music Volume:';
    document.getElementById('voice-volume-label').textContent = langData[currentLang]?.voiceVolumeLabel || 'Voice/SFX Volume:';
    document.getElementById('exit-game-btn').textContent = langData[currentLang]?.exitGame || 'Exit';
    document.getElementById('daily-reward-title').textContent = langData[currentLang]?.dailyRewardTitle || 'Daily Reward';
    document.getElementById('claim-modal-btn').textContent = langData[currentLang]?.claimButton || 'Claim';

    document.getElementById('shop-buy-tab').textContent = langData[currentLang]?.buyTab || 'Buy';
    document.getElementById('shop-sell-tab').textContent = langData[currentLang]?.sellTab || 'Sell';
    document.getElementById('sell-section-title').textContent = langData[currentLang]?.sellSectionTitle || 'Sell Items';

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
    console.log('Starting game...');
    const startScreen = document.getElementById('start-screen');
    startScreen.style.display = 'none';
    startScreen.classList.remove('center-screen');

    const gameScreen = document.getElementById('game-screen');
    gameScreen.style.display = 'flex';
    gameScreen.classList.add('fade-in');

    document.getElementById('exit-game-btn').style.display = 'block';
    isAudioPlaying = false;

    playBgMusic();
    playBgVoice();
    switchTab('farm');
    enterFullScreen();
}

// Initialize game
async function initializeGame() {
    try {
        await loadData();
        updateUIText();

        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            const loginScreen = document.getElementById('login-screen');
            if (loadingScreen && loginScreen) {
                loadingScreen.style.display = 'none';
                loginScreen.style.display = 'flex';
            }
        }, 1000);

        const loginPiBtn = document.getElementById('login-pi-btn');
        if (loginPiBtn) {
            addSafeClickListener(loginPiBtn, authenticateWithPi);
        }
    } catch (error) {
        console.error('Error initializing game:', error.message);
        showNotification('Error initializing game. Please reload.');
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            const loginScreen = document.getElementById('login-screen');
            if (loadingScreen && loginScreen) {
                loadingScreen.style.display = 'none';
                loginScreen.style.display = 'flex';
            }
        }, 1000);
    }
}

// Fullscreen toggle
function enterFullScreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
        elem.requestFullscreen();
    } else if (elem.mozRequestFullScreen) {
        elem.mozRequestFullScreen();
    } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
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

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const startText = document.getElementById('start-text');
    if (startText) addSafeClickListener(startText, startGame);

    const langToggle = document.getElementById('lang-toggle');
    if (langToggle) addSafeClickListener(langToggle, toggleLanguage);

    const gameLangToggle = document.getElementById('game-lang-toggle');
    if (gameLangToggle) addSafeClickListener(gameLangToggle, toggleLanguage);

    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        addSafeClickListener(settingsBtn, () => {
            document.getElementById('settings-modal').style.display = 'block';
            playMenuSound();
        });
    }

    const gameSettingsBtn = document.getElementById('game-settings-btn');
    if (gameSettingsBtn) {
        addSafeClickListener(gameSettingsBtn, () => {
            document.getElementById('settings-modal').style.display = 'block';
            playMenuSound();
        });
    }

    const closeSettings = document.getElementById('close-settings');
    if (closeSettings) {
        addSafeClickListener(closeSettings, () => {
            document.getElementById('settings-modal').style.display = 'none';
            playMenuSound();
        });
    }

    const rewardModalClose = document.getElementById('reward-modal-close');
    if (rewardModalClose) {
        addSafeClickListener(rewardModalClose, () => {
            rewardModal.style.display = 'none';
            playMenuSound();
        });
    }

    const fullscreenToggle = document.getElementById('fullscreen-toggle');
    if (fullscreenToggle) {
        addSafeClickListener(fullscreenToggle, () => {
            if (!document.fullscreenElement) {
                enterFullScreen();
            } else {
                exitFullScreen();
            }
            playMenuSound();
        });
    }

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

    const exitGameBtn = document.getElementById('exit-game-btn');
    if (exitGameBtn) {
        addSafeClickListener(exitGameBtn, () => {
            bgMusic.pause();
            bgVoice.pause();
            window.location.reload();
        });
    }

    const exchangeBtn = document.getElementById('exchange-btn');
    if (exchangeBtn) addSafeClickListener(exchangeBtn, exchangePi);

    const exchangeAmount = document.getElementById('exchange-amount');
    if (exchangeAmount) exchangeAmount.addEventListener('input', updateExchangeResult);

    document.querySelectorAll('.tab-btn').forEach(btn => {
        addSafeClickListener(btn, () => {
            const tab = btn.getAttribute('data-tab');
            switchTab(tab);
        });
    });

    const buyTab = document.getElementById('shop-buy-tab');
    const sellTab = document.getElementById('shop-sell-tab');
    const shopContent = document.getElementById('shop-content');
    const sellContent = document.getElementById('sell-section');

    if (buyTab) {
        addSafeClickListener(buyTab, () => {
            buyTab.classList.add('active');
            sellTab.classList.remove('active');
            shopContent.style.display = 'block';
            sellContent.style.display = 'none';
            renderShop();
            playMenuSound();
        });
    }

    if (sellTab) {
        addSafeClickListener(sellTab, () => {
            sellTab.classList.add('active');
            buyTab.classList.remove('active');
            shopContent.style.display = 'none';
            sellContent.style.display = 'block';
            renderSellSection();
            playMenuSound();
        });
    }

    const loginPiBtn = document.getElementById('login-pi-btn');
    if (loginPiBtn) addSafeClickListener(loginPiBtn, authenticateWithPi);

    initializeGame();
});
