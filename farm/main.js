// Ambil database dan auth dari window.firebaseConfig (dari index.html)
const { database, auth } = window.firebaseConfig;
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
                    // Coba play lagi setelah delay kecil
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
                    // Coba play lagi setelah delay kecil
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
    console.log('Updating volumes:', { musicVolume, voiceVolume }); // Debug

    // Pastikan volume dalam range 0-1
    const musicVol = musicVolume / 100;
    const voiceVol = voiceVolume / 100;

    // Update volume untuk semua audio element
    if (bgMusic) {
        bgMusic.volume = musicVol;
        console.log('BG Music volume set to:', bgMusic.volume);
    }
    if (bgVoice) {
        bgVoice.volume = voiceVol;
        console.log('BG Voice volume set to:', bgVoice.volume);
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
    // 1. Muat bahasa
    const langRes = await fetch('/data/lang.json');
    langData = await langRes.json();
    console.log('Language data loaded:', langData);

    // 2. Muat daftar sayur
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

// Load player data (anonymous or via Pi Network)
async function loadPlayerData() {
  try {
    const userCredential = await signInAnonymously(auth);
    userId = userCredential.user.uid;
    console.log('Signed in to Firebase anonymously, userId:', userId);
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
        farmPlots = data.farmPlots || []; // Load farmPlots dari Firebase
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
          farmPlots: [], // Inisialisasi farmPlots kosong di Firebase
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

// Save player data to Firebase (diperbaiki untuk menyimpan farmPlots)
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
    farmPlots, // Simpan farmPlots ke Firebase
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

// Initialize farm plots (diperbaiki untuk load dari Firebase)
function initializePlots() {
    const farmArea = document.getElementById('farm-area');
    if (!farmArea) {
        console.error('farm-area element not found');
        showNotification('farm-area element not found');
        return;
    }

    farmArea.innerHTML = '';

    // Inisialisasi farmPlots dengan default kalo kosong
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

    // Render ulang plot berdasarkan data farmPlots
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

        // Kalo plot udah ditanam, render tanamannya
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

                // Lanjutkan countdown
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
                    savePlayerData(); // Simpan progress countdown
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
            waterImage.onerror = () => { waterImage.src = 'assets/img/ui/placeholder.png'; }; // Fallback kalo gagal load
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
                savePlayerData(); // Simpan progress countdown
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
        // Pastikan shopImage ada, kalo gak ada kasih placeholder
        const imageSrc = plot.vegetable?.shopImage ? plot.vegetable.shopImage : 'assets/img/ui/placeholder.png';
        flyImage.src = imageSrc;
        flyImage.onerror = () => { flyImage.src = 'assets/img/ui/placeholder.png'; }; // Fallback tambahan
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

  // Paksa reflow untuk perbaiki layout grid kalau tab baru saja dibuka
  forceReflow(shopContent);
  shopContent.style.display = 'grid'; // Pastikan display-nya grid

  // Cek data bahasa
  if (!langData[currentLang]) {
    console.warn('Language data missing, skipping renderShop');
    shopContent.innerHTML = `<p style="color:red;">Language data not loaded. Please reload.</p>`;
    return;
  }

  // Cek data sayuran
  if (!Array.isArray(vegetables) || vegetables.length === 0) {
    console.warn('Vegetables not loaded or invalid');
    shopContent.innerHTML = `<p>${langData[currentLang]?.noItems || 'No items available in shop.'}</p>`;
    return;
  }

  // Kosongkan isi sebelumnya
  shopContent.innerHTML = '';

  // Loop semua sayuran
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

  // Tambahkan item air (water)
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

  // Tampilkan ulang shop setelah semua dimasukkan
  shopContent.style.display = 'flex';

  // Event tombol beli
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

// Tambahkan ke inventory (diperbaiki: seed digabung, harvest digabung)
function addToInventory(type, veg, qty = 1) {
  if (!veg || !veg.id) return;

  const existingIndex = inventory.findIndex(item =>
    item && item.type === type && item.vegetable && item.vegetable.id === veg.id
  );

  if (existingIndex !== -1) {
    // Baik seed maupun harvest, tambah kuantitas kalo udah ada
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

  // Gabung item harvest yang sama berdasarkan vegetable.id
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

  // Show animation duluan sebelum inventory diubah
  const btnElement = document.querySelector(`.sell-btn[data-index="${index}"]`);
  if (btnElement) {
    showTransactionAnimation(`+${totalGain}`, true, btnElement);
  }

  inventory.splice(index, 1); // hapus dari inventori
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
        // Cek dulu apakah bisa klaim
        const snapshot = await get(playerRef);
        lastClaim = snapshot.val() || null;
        const now = Date.now();

        if (lastClaim && isSameDay(lastClaim, now)) {
            const nextMidnight = getNextMidnight();
            const timeLeft = nextMidnight - now;
            const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            showNotification(`${langData[currentLang]?.waitLabel || 'Wait'} ${hoursLeft}h ${minutesLeft}m to claim again!`);
            return; // Langsung return, jangan buka modal
        }

        if (rewardModal) {
            rewardModal.style.display = 'block';
            playMenuSound();
        } else {
            console.error('Reward modal not found!');
        }
    } catch (error) {
        console.error('Error checking claim eligibility:', error);
        showNotification('Error checking reward eligibility. Please try again.');
    }
});

// Pastiin isSameDay dan getNextMidnight ada (kalo belum ada)
function isSameDay(timestamp1, timestamp2) {
  const date1 = new Date(timestamp1);
  const date2 = new Date(timestamp2);
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

function getNextMidnight() {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime();
}

// Claim daily reward
function claimDailyReward() {
  const playerRef = ref(database, `players/${userId}/lastClaim`);
  onValue(playerRef, (snapshot) => {
    lastClaim = snapshot.val();
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    const btn = document.getElementById('claim-reward-btn');

    if (lastClaim && now - lastClaim < oneDay) {
      const timeLeft = oneDay - (now - lastClaim);
      const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      showNotification(`${langData[currentLang]?.waitLabel || 'Wait'} ${hoursLeft}h ${minutesLeft}m ${langData[currentLang]?.toClaimAgain || 'to claim again!'}`);
      if (btn) {
        btn.disabled = true;
        btn.classList.add('claimed');
        btn.textContent = langData[currentLang]?.claimed || 'Claimed';
      }
    } else {
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('claimed');
        btn.textContent = langData[currentLang]?.claimNow || 'Claim Now';
      }
      if (rewardModal) {
          rewardModal.style.display = 'block';
      } else {
          console.error('Reward modal not found!');
      }
    }
  }, { onlyOnce: true });
}

// Check harvest achievement
function checkHarvestAchievement() {
    if (harvestCount >= 10 && !achievements.harvest) {
        achievements.harvest = true;
        savePlayerData();
        showNotification(langData[currentLang]?.achievementUnlocked || 'Achievement Unlocked!');
        playCoinSound();
        renderAchievements();
    }
}

// Check coin achievement
function checkCoinAchievement() {
    if (farmCoins >= 1000 && !achievements.coins) {
        achievements.coins = true;
        savePlayerData();
        showNotification(langData[currentLang]?.achievementUnlocked || 'Achievement Unlocked!');
        playCoinSound();
        renderAchievements();
    }
}

// Render achievements
function renderAchievements() {
    const achievementsContent = document.getElementById('achievements-content');
    achievementsContent.innerHTML = `
        <div class="achievement ${achievements.harvest ? 'completed' : ''}" data-id="harvest">
            <h3>${langData[currentLang]?.achievementHarvest || 'Harvest Master'}</h3>
            <p>${langData[currentLang]?.achievementHarvestDesc || 'Harvest 10 crops'}</p>
        </div>
        <div class="achievement ${achievements.coins ? 'completed' : ''}" data-id="coins">
            <h3>${langData[currentLang]?.achievementCoins || 'Coin Collector'}</h3>
            <p>${langData[currentLang]?.achievementCoinsDesc || 'Collect 1000 coins'}</p>
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
    document.getElementById('title').textContent = langData[currentLang]?.title || 'Harvest Pi';
    document.getElementById('start-text').textContent = langData[currentLang]?.startBtn || 'Start Game';
    document.getElementById('lang-toggle').textContent = langData[currentLang]?.switchLangLabel || 'Switch Language (EN/ID)';
    document.getElementById('game-lang-toggle').textContent = langData[currentLang]?.switchLangLabel || 'Switch Language (EN/ID)';
    document.getElementById('game-title').textContent = langData[currentLang]?.title || 'Harvest Pi';
    document.querySelector('.tab-btn[data-tab="farm"]').textContent = langData[currentLang]?.farmTab || 'Farm';
    document.querySelector('.tab-btn[data-tab="shop"]').textContent = langData[currentLang]?.shopTab || 'Shop';
    document.querySelector('.tab-btn[data-tab="upgrades"]').textContent = langData[currentLang]?.upgradesTab || 'Upgrades';
    document.querySelector('.tab-btn[data-tab="inventory"]').textContent = langData[currentLang]?.inventoryTab || 'Inventory';
    document.querySelector('.tab-btn[data-tab="exchange"]').textContent = langData[currentLang]?.exchangeTab || 'Exchange';
    document.querySelector('.tab-btn[data-tab="leaderboard"]').textContent = langData[currentLang]?.leaderboardTab || 'Leaderboard';
    document.querySelector('.tab-btn[data-tab="achievements"]').textContent = langData[currentLang]?.achievementsTab || 'Achievements';
    document.getElementById('claim-reward-btn').textContent = langData[currentLang]?.claimRewardBtn || 'Claim Reward';
    document.getElementById('upgrades-title').textContent = langData[currentLang]?.upgradesTab || 'Upgrades';
    document.getElementById('upgrades-content').textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    document.getElementById('leaderboard-title').textContent = langData[currentLang]?.leaderboardTab || 'Leaderboard';
    document.getElementById('leaderboard-content').textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    document.getElementById('exchange-title').textContent = langData[currentLang]?.exchangeTab || 'Exchange';
    document.getElementById('exchange-rate').textContent = langData[currentLang]?.exchangeRateLabel || `1 PI = ${piToFarmRate} Coins`;
    document.getElementById('exchange-amount').placeholder = langData[currentLang]?.enterPiAmount || 'Enter PI amount';
    document.getElementById('exchange-btn').textContent = langData[currentLang]?.exchangeBtn || 'Exchange';
    document.getElementById('sell-section-title').textContent = langData[currentLang]?.sellItemsLabel || 'Sell Items';
    document.getElementById('settings-title').textContent = langData[currentLang]?.settingsLabel || 'Settings';
    document.getElementById('music-volume-label').textContent = langData[currentLang]?.musicVolumeLabel || 'Music Volume:';
    document.getElementById('voice-volume-label').textContent = langData[currentLang]?.voiceVolumeLabel || 'Voice/SFX Volume:';
}

// Start game
function startGame() {
  console.log('Starting game...');
  const startScreen = document.getElementById('start-screen');
  startScreen.style.display = 'none';
  startScreen.classList.remove('center-screen'); // hapus centering setelah masuk game

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
addSafeClickListener(document.getElementById('start-text'), () => {
  startGame();
});

// Exit game
function exitGame() {
  console.log('Exiting game...');
  document.getElementById('game-screen').style.display = 'none';

  const startScreen = document.getElementById('start-screen');
  startScreen.style.display = 'flex';
  startScreen.classList.add('center-screen'); // balikin centering ke tengah

  document.getElementById('settings-modal').style.display = 'none';
  document.getElementById('exit-game-btn').style.display = 'none';

  if (bgMusic) {
    bgMusic.pause();
    bgMusic.currentTime = 0;
  }
  if (bgVoice) {
    bgVoice.pause();
    bgVoice.currentTime = 0;
  }
  isAudioPlaying = false;
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
    updateDailyRewardTexts();
    playMenuSound();
}

// Open settings
function openSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'block';
    playMenuSound();
  } else {
    console.error('Settings modal not found!');
  }
}

// Initialize settings
function initializeSettings() {
    const musicVolumeSlider = document.getElementById('music-volume');
    const voiceVolumeSlider = document.getElementById('voice-volume');
    const closeSettings = document.getElementById('close-settings');

    // Set nilai awal slider dari localStorage
    musicVolumeSlider.value = localStorage.getItem('musicVolume') || 50;
    voiceVolumeSlider.value = localStorage.getItem('voiceVolume') || 50;

    // Update volume saat slider diubah
    musicVolumeSlider.addEventListener('input', () => {
        const newVolume = musicVolumeSlider.value;
        localStorage.setItem('musicVolume', newVolume);
        console.log('Music volume changed to:', newVolume); // Debug
        updateVolumes();
    });

    voiceVolumeSlider.addEventListener('input', () => {
        const newVolume = voiceVolumeSlider.value;
        localStorage.setItem('voiceVolume', newVolume);
        console.log('Voice volume changed to:', newVolume); // Debug
        updateVolumes();
    });

    addSafeClickListener(closeSettings, () => {
        document.getElementById('settings-modal').style.display = 'none';
        playMenuSound();
    });
}

// Check daily reward availability
async function checkDailyReward() {
  if (!userId) return;

  const playerRef = ref(database, `players/${userId}`);
  const btn = document.getElementById('claim-reward-btn');
  if (!btn) return;

  try {
    const snapshot = await get(playerRef);
    const data = snapshot.val();
    lastClaim = data.lastClaim || null;
    claimedToday = data.claimedToday || false;
    const now = Date.now();

    // Reset claimedToday kalo udah ganti hari
    if (lastClaim && !isSameDay(lastClaim, now)) {
      claimedToday = false;
      await update(playerRef, { claimedToday: false });
    }

    if (claimedToday) {
      btn.disabled = true;
      btn.classList.add('claimed');
      btn.textContent = langData[currentLang]?.claimed || 'Claimed';
    } else {
      btn.disabled = false;
      btn.classList.remove('claimed');
      btn.textContent = langData[currentLang]?.claimNow || 'Claim Now';
    }
    console.log('Claim check:', { claimedToday, lastClaim, now });
  } catch (error) {
    console.error('Error checking daily reward:', error);
    btn.disabled = true;
    btn.classList.add('claimed');
    btn.textContent = langData[currentLang]?.claimed || 'Claimed';
  }
}

// Update Daily Reward Text
function updateDailyRewardTexts() {
  const title = document.getElementById('daily-reward-title');
  const text = document.getElementById('daily-reward-text');

  if (!langData[currentLang]) return;

  if (title) title.textContent = langData[currentLang].dailyRewardTitle || 'Daily Reward';
  if (text) text.content = langData[currentLang].dailyRewardText || 'You got +100 Farm Coins & +50 Water!';
  if (claimModalBtn) {
    claimModalBtn.textContent = langData[currentLang].claimRewardLabel || 'Claim';
    // Cek status klaim saat init
    checkClaimStatus(claimModalBtn);
  }
}

// Fungsi checkClaimStatus (pastikan ada)
async function checkClaimStatus(btn) {
  if (!userId || !btn) return;

  try {
    const playerRef = ref(database, `players/${userId}`);
    const snapshot = await get(playerRef);
    const data = snapshot.val();
    claimedToday = data.claimedToday || false;
    const now = Date.now();
    const lastClaim = data.lastClaim || null;

    // Reset claimedToday kalo udah ganti hari
    if (lastClaim && !isSameDay(lastClaim, now)) {
      claimedToday = false;
      await update(playerRef, { claimedToday: false });
    }

    if (claimedToday) {
      btn.disabled = true;
      btn.classList.add('claimed');
      btn.textContent = langData[currentLang]?.claimed || 'Claimed';
    } else {
      btn.disabled = false;
      btn.classList.remove('claimed');
      btn.textContent = langData[currentLang].claimRewardLabel || 'Claim';
    }
    console.log('Claim status:', { claimedToday, lastClaim, now });
  } catch (error) {
    console.error('Error checking claim status:', error);
    btn.disabled = true;
    btn.classList.add('claimed');
    btn.textContent = langData[currentLang]?.claimed || 'Claimed';
  }
}

  // Event listener untuk claimModalBtn
  if (claimModalBtn) {
  addSafeClickListener(claimModalBtn, async () => {
    if (isClaiming || claimedToday) return; // Lock kalo udah klaim
    isClaiming = true;

    try {
      const playerRef = ref(database, `players/${userId}`);
      const snapshot = await get(playerRef);
      const data = snapshot.val();
      claimedToday = data.claimedToday || false;

      if (claimedToday) {
        const nextMidnight = getNextMidnight();
        const timeLeft = nextMidnight - Date.now();
        const hoursLeft = Math.floor(timeLeft / (60 * 60 * 1000));
        const minutesLeft = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
        showNotification(`${langData[currentLang]?.waitLabel || 'Wait'} ${hoursLeft}h ${minutesLeft}m to claim again!`);
        return;
      }

      farmCoins += 100;
      water += 50;
      lastClaim = Date.now();
      claimedToday = true;

      await update(playerRef, { lastClaim, claimedToday });
      await savePlayerData();

      updateWallet();
      showTransactionAnimation('+100 Coins, +50 Water', true, claimModalBtn);
      playCoinSound();

      claimModalBtn.disabled = true; // Lock tombol setelah klaim
      claimModalBtn.classList.add('claimed');
      claimModalBtn.textContent = langData[currentLang]?.claimed || 'Claimed';

      if (rewardModal) rewardModal.style.display = 'none';

      showNotification(langData[currentLang]?.claimSuccess || 'You claimed +100 Coins & +50 Water!');
    } catch (error) {
      showNotification('Failed to claim reward. Please try again.');
      console.error('Claim error:', error);
    } finally {
      isClaiming = false;
    }
  });
}

// Initialize game
async function initializeGame() {
  try {
    await loadData();
    await loadPlayerData();

    if (!isDataLoaded) {
      throw new Error('Failed to load player data');
    }

    initializeSettings();
    initializePlots();
    updateWallet();
    renderInventory();
    renderShop();
    renderSellSection();
    checkLevelUp();
    await checkDailyReward();
    updateExchangeResult();

    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      const startScreen = document.getElementById('start-screen');
      if (loadingScreen && startScreen) {
        loadingScreen.style.display = 'none';
        startScreen.style.display = 'flex';
      }
    }, 1000);
  } catch (error) {
    console.error('Error initializing game:', error.message);
    if (error.message.includes('Failed to connect to Firebase')) {
      showNotification('Error initializing game. Please check your internet connection and reload.');
    }
    setTimeout(() => {
      const loadingScreen = document.getElementById('loading-screen');
      const startScreen = document.getElementById('start-screen');
      if (loadingScreen && startScreen) {
        loadingScreen.style.display = 'none';
        startScreen.style.display = 'flex';
      }
    }, 1000);
  }
}
    
// Settings Handler
addSafeClickListener(document.getElementById('settings-btn'), openSettings);
addSafeClickListener(document.getElementById('game-settings-btn'), openSettings);
addSafeClickListener(document.getElementById('close-settings'), () => {
  document.getElementById('settings-modal').style.display = 'none';
  playMenuSound();
});

// Full Screen Bray
function enterFullScreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.webkitRequestFullscreen) {
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) {
    elem.msRequestFullscreen();
  }
}

function exitFullScreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) {
    document.msExitFullscreen();
  }
}

function isFullScreen() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
}

// Toggle Full Screen 
function toggleFullscreen() {
  const elem = document.documentElement;
  if (!document.fullscreenElement) {
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.msRequestFullscreen) {
      elem.msRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.msExitFullscreen) {
      document.msExitFullscreen();
    }
  }
}

function updateFullscreenButtonText() {
  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  if (!fullscreenToggle) return;

  const isFullscreen = !!document.fullscreenElement;
  fullscreenToggle.textContent = isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen';
}

// DOM Content Loaded (versi aman)
document.addEventListener('DOMContentLoaded', () => {
  const startText = document.getElementById('start-text');
  if (startText) addSafeClickListener(startText, () => startGame());

  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) addSafeClickListener(langToggle, toggleLanguage);

  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) addSafeClickListener(settingsBtn, openSettings);

  const claimRewardBtn = document.getElementById('claim-reward-btn');
  if (claimRewardBtn) addSafeClickListener(claimRewardBtn, claimDailyReward);

  const gameLangToggle = document.getElementById('game-lang-toggle');
  if (gameLangToggle) addSafeClickListener(gameLangToggle, toggleLanguage);

  const gameSettingsBtn = document.getElementById('game-settings-btn');
  if (gameSettingsBtn) addSafeClickListener(gameSettingsBtn, openSettings);

  const exitBtn = document.getElementById('exit-game-btn');
  if (exitBtn) addSafeClickListener(exitBtn, exitGame);

  const exchangeBtn = document.getElementById('exchange-btn');
  if (exchangeBtn) addSafeClickListener(exchangeBtn, exchangePi);

  const exchangeInput = document.getElementById('exchange-amount');
  if (exchangeInput) exchangeInput.addEventListener('input', updateExchangeResult);

  const fullscreenToggle = document.getElementById('fullscreen-toggle');
  if (fullscreenToggle) fullscreenToggle.addEventListener('click', toggleFullscreen);

  const tabButtons = document.querySelectorAll('.tab-btn');
  if (tabButtons.length > 0) {
    tabButtons.forEach(btn => {
      addSafeClickListener(btn, () => {
        const tab = btn.getAttribute('data-tab');
        switchTab(tab);
      });
    });
  }

  initializeGame();

  document.addEventListener('fullscreenchange', updateFullscreenButtonText);

  updateFullscreenButtonText();

  // Sembunyikan tombol exit saat di start screen (tambah pengecekan)
  const exitGameBtn = document.getElementById('exit-game-btn');
  if (exitGameBtn) exitGameBtn.style.display = 'none';
});

// Stop audio on page unload to prevent overlap
window.addEventListener('beforeunload', () => {
    if (bgMusic) bgMusic.pause();
    if (bgVoice) bgVoice.pause();
    isAudioPlaying = false;
});

//Buy Sell Shop Section
const shopBuyBtn = document.getElementById('shop-buy-tab');
const shopSellBtn = document.getElementById('shop-sell-tab');
const shopContent = document.getElementById('shop-content');
const sellSection = document.getElementById('sell-section');

addSafeClickListener(shopBuyBtn, () => {
  shopBuyBtn.classList.add('active');
  shopSellBtn.classList.remove('active');
  shopContent.style.display = 'flex';
  sellSection.style.display = 'none';
  renderShop();
});

addSafeClickListener(shopSellBtn, () => {
  shopSellBtn.classList.add('active');
  shopBuyBtn.classList.remove('active');
  shopContent.style.display = 'none';
  sellSection.style.display = 'block';
  renderSellSection();
});
