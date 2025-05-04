// Import Firebase dari firebase-config.js
import { database } from '../firebase/firebase-config.js';
import { ref, onValue, set, update, get } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// Deklarasi elemen global untuk reward modal
const rewardModal = document.getElementById('reward-modal');
const claimModalBtn = document.getElementById('claim-modal-btn');

// Helper untuk listener aman
function addSafeClickListener(element, callback) {
    if (!element) {
        console.error('Element not found for addSafeClickListener:', callback.name);
        return;
    }
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

// Variabel global
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
const bgMusic = document.getElementById('bg-music');
const bgVoice = document.getElementById('bg-voice');
const harvestingSound = document.getElementById('harvesting-sound');
const wateringSound = document.getElementById('watering-sound');
const plantingSound = document.getElementById('planting-sound');
const menuSound = document.getElementById('menu-sound');
const buyingSound = document.getElementById('buying-sound');
const coinSound = document.getElementById('coin-sound');

// Fungsi kontrol audio
function playBgMusic() {
    if (bgMusic && !isAudioPlaying) {
        bgMusic.play().catch(e => console.log('BG Music failed:', e.message));
        isAudioPlaying = true;
    }
}

function playBgVoice() {
    if (bgVoice && !isAudioPlaying) {
        bgVoice.play().catch(e => console.log('BG Voice failed:', e.message));
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

function updateVolumes() {
    const musicVolume = parseFloat(localStorage.getItem('musicVolume')) || 50;
    const voiceVolume = parseFloat(localStorage.getItem('voiceVolume')) || 50;
    const musicVol = Math.min(Math.max(musicVolume / 100, 0), 1);
    const voiceVol = Math.min(Math.max(voiceVolume / 100, 0), 1);

    [bgMusic, bgVoice, harvestingSound, wateringSound, plantingSound, menuSound, buyingSound, coinSound].forEach(audio => {
        if (audio) {
            audio.volume = audio.id === 'bg-music' ? musicVol : voiceVol;
            if (isAudioPlaying && audio.id === 'bg-music') audio.play().catch(e => console.log(`${audio.id} play failed:`, e));
        }
    });
}

// Load data statis
async function loadData() {
    try {
        const [langRes, vegRes] = await Promise.all([
            fetch('/data/lang.json'),
            fetch('/data/vegetables.json')
        ]);
        langData = await langRes.json();
        const vegJson = await vegRes.json();
        vegetables = vegJson.vegetables;
    } catch (error) {
        console.error('Error loading data:', error.message);
        showNotification('Error loading game data.');
    }
}

// Inisialisasi Pi SDK
async function initializePiSDK() {
    if (!window.Pi) {
        console.error('Pi SDK not loaded');
        showNotification('Pi Network SDK not available.');
        return false;
    }
    try {
        await Pi.init({ version: "2.0", appId: "zph8ke6h96lxogfkzxcxgekdtgcqcos3gv1ighavcwxbf8dobcadvfyifvgqutgh" });
        piInitialized = true;
        return true;
    } catch (error) {
        console.error('Pi init failed:', error);
        showNotification('Failed to initialize Pi SDK.');
        return false;
    }
}

// Autentikasi dengan Pi Network
async function authenticateWithPi() {
    if (!window.Pi) {
        showNotification('Pi Network SDK not available.');
        return;
    }
    if (!piInitialized && !(await initializePiSDK())) return;

    const scopes = ['username'];
    Pi.authenticate(scopes, onIncompletePaymentFound)
        .then(authResult => {
            userId = authResult.user.uid;
            localStorage.setItem('userId', userId);
            const playerRef = ref(database, `players/${userId}`);
            get(playerRef).then(snapshot => {
                const data = snapshot.val() || {};
                update(playerRef, {
                    piUser: { uid: userId, username: authResult.user.username },
                    pi: data.pi || 0,
                    farmCoins: data.farmCoins || 0,
                    lastUpdated: new Date().toISOString()
                }).then(() => {
                    showNotification(`Logged in as ${authResult.user.username}`);
                    const loginScreen = document.getElementById('login-screen');
                    const startScreen = document.getElementById('start-screen');
                    if (loginScreen && startScreen) {
                        loginScreen.style.display = 'none';
                        startScreen.style.display = 'flex';
                    }
                    loadPlayerData();
                }).catch(error => {
                    console.error('Error saving Pi user data:', error);
                    showNotification('Failed to save Pi user data.');
                });
            }).catch(error => {
                console.error('Error checking existing data:', error);
                showNotification('Error accessing player data.');
            });
        })
        .catch(error => {
            console.error('Pi Auth failed:', error);
            showNotification('Pi Network login failed.');
        });
}

function onIncompletePaymentFound(payment) {
    console.log("onIncompletePaymentFound", payment);
}

function showModal() {
    const modal = document.getElementById('signInModal');
    if (modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('signInModal');
    if (modal) modal.style.display = 'none';
}

// Event listener awal
document.addEventListener('DOMContentLoaded', () => {
    if (!userId) {
        showModal();
        const loginScreen = document.getElementById('login-screen');
        const startScreen = document.getElementById('start-screen');
        if (loginScreen && startScreen) {
            loginScreen.style.display = 'flex';
            startScreen.style.display = 'none';
        }
    }

    addSafeClickListener(document.getElementById('start-text'), startGame);
    addSafeClickListener(document.getElementById('lang-toggle'), toggleLanguage);
    addSafeClickListener(document.getElementById('game-lang-toggle'), toggleLanguage);
    addSafeClickListener(document.getElementById('settings-btn'), () => {
        document.getElementById('settings-modal').style.display = 'block';
        playMenuSound();
    });
    addSafeClickListener(document.getElementById('game-settings-btn'), () => {
        document.getElementById('settings-modal').style.display = 'block';
        playMenuSound();
    });
    addSafeClickListener(document.getElementById('close-settings'), () => {
        document.getElementById('settings-modal').style.display = 'none';
        playMenuSound();
    });
    addSafeClickListener(document.getElementById('reward-modal-close'), () => {
        rewardModal.style.display = 'none';
        playMenuSound();
    });
    addSafeClickListener(document.getElementById('fullscreen-toggle'), () => {
        document.fullscreenElement ? exitFullScreen() : enterFullScreen();
        playMenuSound();
    });
    addSafeClickListener(document.getElementById('exit-game-btn'), () => {
        bgMusic.pause();
        bgVoice.pause();
        window.location.reload();
    });
    addSafeClickListener(document.getElementById('exchange-btn'), exchangePi);
    addSafeClickListener(document.getElementById('claim-reward-btn'), checkAndShowRewardModal);

    document.getElementById('exchange-amount').addEventListener('input', updateExchangeResult);
    document.querySelectorAll('.tab-btn').forEach(btn => addSafeClickListener(btn, () => switchTab(btn.getAttribute('data-tab'))));
    addSafeClickListener(document.getElementById('shop-buy-tab'), () => {
        document.getElementById('shop-buy-tab').classList.add('active');
        document.getElementById('shop-sell-tab').classList.remove('active');
        document.getElementById('shop-content').style.display = 'block';
        document.getElementById('sell-section').style.display = 'none';
        renderShop();
        playMenuSound();
    });
    addSafeClickListener(document.getElementById('shop-sell-tab'), () => {
        document.getElementById('shop-sell-tab').classList.add('active');
        document.getElementById('shop-buy-tab').classList.remove('active');
        document.getElementById('shop-content').style.display = 'none';
        document.getElementById('sell-section').style.display = 'block';
        renderSellSection();
        playMenuSound();
    });
    addSafeClickListener(document.getElementById('login-pi-btn'), authenticateWithPi);

    initializePiSDK().catch(error => console.error('Initial Pi SDK init failed:', error));
    initializeGame();
});

// Load data pemain dari Firebase
async function loadPlayerData() {
    if (!userId) {
        console.warn('No userId, login required!');
        return;
    }
    const playerRef = ref(database, `players/${userId}`);
    onValue(playerRef, (snapshot) => {
        if (isDataLoaded) return;
        const data = snapshot.val() || {};
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
}

// Simpan data pemain ke Firebase
function savePlayerData() {
    if (!userId || !isDataLoaded) return;
    const playerRef = ref(database, `players/${userId}`);
    update(playerRef, {
        farmCoins, pi, water, level, xp, inventory, farmPlots, harvestCount,
        achievements, lastClaim, claimedToday, piUser: { uid: userId }
    }).catch(error => {
        console.error('Error saving player data:', error.message);
        showNotification('Error saving player data.');
    });
}

// Update UI wallet
function updateWallet() {
    document.getElementById('farm-coins').textContent = `${farmCoins} ${langData[currentLang]?.coinLabel || 'Coins'}`;
    document.getElementById('pi-coins').textContent = `${pi.toFixed(2)} PI`;
    document.getElementById('water').textContent = `${water} ${langData[currentLang]?.waterLabel || 'Water'}`;
    document.getElementById('level').textContent = `Level: ${level} | XP: ${xp}`;
    document.getElementById('xp-fill').style.width = `${(xp / (level * 100)) * 100}%`;
    savePlayerData();
}

// Inisialisasi plot pertanian
function initializePlots() {
    const farmArea = document.getElementById('farm-area');
    if (!farmArea) {
        console.error('farm-area not found');
        showNotification('Farm area not found.');
        return;
    }
    farmArea.innerHTML = '';
    if (!farmPlots.length) {
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
        farmArea.appendChild(plotElement);
        if (plot.planted && plot.vegetable) updatePlotDisplay(plotElement, plot);
    });
    updateUIText();
}

// Update tampilan plot
function updatePlotDisplay(plotElement, plot) {
    const plotContent = plotElement.querySelector('.plot-content');
    const plotStatus = plotElement.querySelector('.plot-status');
    const countdownFill = plotElement.querySelector('.countdown-fill');
    plotContent.innerHTML = '';
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
        countdownFill.style.width = `${(1 - plot.countdown / plot.totalCountdown) * 100}%`;
        const interval = setInterval(() => {
            if (!plot.planted || plot.currentFrame >= plot.vegetable.frames) {
                clearInterval(interval);
                return;
            }
            if (plot.watered) {
                plot.countdown--;
                countdownFill.style.width = `${(1 - plot.countdown / plot.totalCountdown) * 100}%`;
                if (plot.countdown <= 0) {
                    plot.currentFrame++;
                    plot.watered = false;
                    plot.countdown = plot.vegetable.growthTime;
                    plantImg.src = `${plot.vegetable.baseImage}${plot.currentFrame}.png`;
                    plantImg.classList.remove('loaded');
                    setTimeout(() => plantImg.classList.add('loaded'), 50);
                    if (plot.currentFrame >= plot.vegetable.frames) {
                        plotElement.classList.add('ready');
                        plotStatus.textContent = langData[currentLang]?.readyToHarvest || 'Ready to Harvest';
                        countdownFill.style.width = '100%';
                    } else {
                        plotStatus.textContent = langData[currentLang]?.needsWater || 'Needs Water';
                        countdownFill.style.width = '0%';
                    }
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

// Handle klik plot
function handlePlotClick(index) {
    const plot = farmPlots[index];
    const plotElement = document.querySelectorAll('.plot')[index];
    const plotContent = plotElement.querySelector('.plot-content');
    const plotStatus = plotElement.querySelector('.plot-status');
    const countdownFill = plotElement.querySelector('.countdown-fill');

    if (!plot.planted) {
        const seedIndex = inventory.findIndex(item => item?.type === 'seed' && item.quantity > 0);
        if (seedIndex !== -1) {
            const { vegetable } = inventory[seedIndex];
            plot.planted = true;
            plot.vegetable = vegetable;
            plot.watered = false;
            plot.currentFrame = 1;
            plot.countdown = vegetable.growthTime;
            plot.totalCountdown = vegetable.growthTime;

            const flyImage = createFlyElement(vegetable.shopImage, 'plant-fly', '60px');
            const amountText = createAmountText('-1', 'negative');
            plotContent.append(flyImage, amountText);
            setTimeout(() => {
                flyImage.remove();
                amountText.remove();
                plotContent.innerHTML = '';
                const plantImg = document.createElement('img');
                plantImg.classList.add('plant-img');
                plantImg.src = `${vegetable.baseImage}${plot.currentFrame}.png`;
                plantImg.onerror = () => plantImg.src = 'assets/img/ui/placeholder.png';
                plotContent.appendChild(plantImg);
                setTimeout(() => plantImg.classList.add('loaded'), 50);
            }, 800);

            plotStatus.textContent = langData[currentLang]?.needsWater || 'Needs Water';
            countdownFill.style.width = '0%';
            inventory[seedIndex].quantity--;
            if (inventory[seedIndex].quantity <= 0) inventory.splice(seedIndex, 1);
            savePlayerData();
            renderInventory();
            showNotification(langData[currentLang]?.planted || 'Planted!');
            playPlantingSound();
        } else {
            showNotification(langData[currentLang]?.noSeeds || 'No Seeds!');
        }
    } else if (!plot.watered && plot.currentFrame < plot.vegetable.frames) {
        const waterNeeded = plot.vegetable.waterNeeded || 1;
        if (water >= waterNeeded) {
            water -= waterNeeded;
            plot.watered = true;

            const waterImage = createFlyElement('assets/img/ui/water_icon.png', 'water-fly', '40px', '-40px');
            const amountText = createAmountText(`-${waterNeeded}`, 'negative');
            plotContent.append(waterImage, amountText);
            setTimeout(() => {
                waterImage.remove();
                amountText.remove();
            }, 800);

            updateWallet();
            showNotification(langData[currentLang]?.watered || 'Watered!');
            playWateringSound();
            updatePlotDisplay(plotElement, plot);
        } else {
            showNotification(langData[currentLang]?.notEnoughWater || 'Not Enough Water!');
        }
    } else if (plot.currentFrame >= plot.vegetable.frames || plotElement.classList.contains('ready')) {
        const yieldAmount = plot.vegetable.yield;
        addToInventory('harvest', plot.vegetable, yieldAmount);
        plot.planted = false;
        plot.vegetable = null;
        plot.currentFrame = 1;
        plot.countdown = 0;

        const flyImage = createFlyElement(plot.vegetable.shopImage, 'plant-fly', '60px');
        document.body.appendChild(flyImage);
        const rect = plotContent.getBoundingClientRect();
        flyImage.style.left = `${rect.left + rect.width / 2 - 30}px`;
        flyImage.style.top = `${rect.top}px`;

        const amountText = createAmountText(`+${yieldAmount}`, 'positive');
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

// Buat elemen terbang
function createFlyElement(src, className, width, top = '0') {
    const img = document.createElement('img');
    img.src = src;
    img.onerror = () => img.src = 'assets/img/ui/placeholder.png';
    img.classList.add(className);
    img.style.width = width;
    img.style.top = top;
    return img;
}

// Buat teks jumlah
function createAmountText(text, className) {
    const div = document.createElement('div');
    div.textContent = text;
    div.classList.add('amount-text', className);
    return div;
}

// Render shop
function renderShop() {
    const shopContent = document.getElementById('shop-content');
    if (!shopContent) return;
    shopContent.innerHTML = '';

    vegetables.forEach(veg => {
        const item = document.createElement('div');
        item.classList.add('shop-item');
        item.innerHTML = `
            <img src="${veg.shopImage}" alt="${veg.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
            <h3>${veg.name[currentLang]}</h3>
            <p>Farm Price: ${veg.farmPrice || 0} Coins</p>
            <p>PI Price: ${veg.piPrice || 0} PI</p>
            <button class="buy-btn" data-id="${veg.id}">Buy (Farm)</button>
            <button class="buy-pi-btn" data-id="${veg.id}">Buy (PI)</button>
        `;
        shopContent.appendChild(item);
    });

    const waterItem = document.createElement('div');
    waterItem.classList.add('shop-item');
    waterItem.innerHTML = `
        <img src="assets/img/ui/water_icon.png" alt="Water" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
        <h3>Water</h3>
        <p>Farm Price: 100 Coins</p>
        <p>PI Price: 0.0001 PI</p>
        <button class="buy-btn" data-id="water">Buy (Farm)</button>
        <button class="buy-pi-btn" data-id="water">Buy (PI)</button>
    `;
    shopContent.appendChild(waterItem);

    document.querySelectorAll('.buy-btn').forEach(btn => addSafeClickListener(btn, () => buyVegetable(btn.dataset.id, 'farm')));
    document.querySelectorAll('.buy-pi-btn').forEach(btn => addSafeClickListener(btn, () => buyVegetable(btn.dataset.id, 'pi')));
}

// Tambah ke inventory
function addToInventory(type, veg, qty = 1) {
    const index = inventory.findIndex(item => item?.type === type && item.vegetable.id === veg.id);
    if (index !== -1) {
        inventory[index].quantity += qty;
    } else {
        inventory.push({ type, vegetable: veg, quantity: qty });
    }
    savePlayerData();
}

// Beli item
function buyVegetable(id, currency) {
    if (id === 'water') {
        if (currency === 'farm' && farmCoins >= 100) {
            farmCoins -= 100;
            water += 10;
            showTransactionAnimation('-100', false, document.querySelector(`.buy-btn[data-id="water"]`));
        } else if (currency === 'pi' && pi >= 0.0001) {
            pi -= 0.0001;
            water += 10;
            showTransactionAnimation('-0.0001 PI', false, document.querySelector(`.buy-pi-btn[data-id="water"]`));
        } else {
            showNotification(currency === 'farm' ? 'Not Enough Coins!' : 'Not Enough PI!');
            return;
        }
        updateWallet();
        playBuyingSound();
        return;
    }

    const veg = vegetables.find(v => v.id === id);
    if (!veg) return;

    const price = currency === 'farm' ? veg.farmPrice : veg.piPrice;
    const currencyValue = currency === 'farm' ? farmCoins : pi;

    if (currencyValue >= price) {
        if (currency === 'farm') farmCoins -= price;
        else pi -= price;
        addToInventory('seed', veg);
        updateWallet();
        renderInventory();
        showTransactionAnimation(`-${price} ${currency.toUpperCase()}`, false, document.querySelector(`.${currency === 'farm' ? 'buy-btn' : 'buy-pi-btn'}[data-id="${id}"]`));
        playBuyingSound();
    } else {
        showNotification(`Not Enough ${currency.toUpperCase()}!`);
    }
}

// Render inventory
function renderInventory() {
    const content = document.getElementById('inventory-content');
    if (!content) return;
    content.innerHTML = '';

    if (inventory.length) {
        inventory.forEach(item => {
            if (!item?.vegetable) return;
            const div = document.createElement('div');
            div.classList.add('inventory-item');
            div.innerHTML = `
                <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img" onerror="this.src='assets/img/ui/placeholder.png';">
                <h3>${item.type === 'seed' ? `${item.vegetable.name[currentLang]} Seed` : item.vegetable.name[currentLang]}</h3>
                <p>Quantity: ${item.quantity}</p>
            `;
            content.appendChild(div);
        });
    } else {
        content.innerHTML = '<p>No items in inventory.</p>';
    }

    const sellBtn = document.createElement('button');
    sellBtn.textContent = 'Sell to Shop';
    sellBtn.classList.add('sell-to-shop-btn');
    addSafeClickListener(sellBtn, openSellTab);
    content.appendChild(sellBtn);
}

// Render sell section
function renderSellSection() {
    const content = document.getElementById('sell-content');
    if (!content) return;
    content.innerHTML = '';

    const groupedHarvest = {};
    inventory.forEach((item, index) => {
        if (item?.type === 'harvest') {
            if (!groupedHarvest[item.vegetable.id]) groupedHarvest[item.vegetable.id] = { ...item, index };
            else groupedHarvest[item.vegetable.id].quantity += item.quantity;
        }
    });

    if (Object.keys(groupedHarvest).length) {
        Object.values(groupedHarvest).forEach(item => {
            const div = document.createElement('div');
            div.classList.add('sell-item');
            div.innerHTML = `
                <img src="${item.vegetable.shopImage}" alt="${item.vegetable.name[currentLang]}" class="shop-item-img">
                <h3>${item.vegetable.name[currentLang]}</h3>
                <p>Quantity: ${item.quantity}</p>
                <p>Sell Price: ${item.vegetable.sellPrice || 0} Coins</p>
                <button class="sell-btn" data-index="${item.index}">Sell</button>
            `;
            content.appendChild(div);
        });
        document.querySelectorAll('.sell-btn').forEach(btn => addSafeClickListener(btn, () => sellItem(parseInt(btn.dataset.index))));
    } else {
        content.innerHTML = '<p>No items to sell.</p>';
    }
}

// Jual item
function sellItem(index) {
    const item = inventory[index];
    if (!item || item.type !== 'harvest' || !item.vegetable.sellPrice) {
        showNotification('Cannot sell: Invalid item.');
        return;
    }
    const totalGain = item.vegetable.sellPrice * item.quantity;
    farmCoins += totalGain;
    xp += 10;
    inventory.splice(index, 1);
    savePlayerData();
    updateWallet();
    renderInventory();
    renderSellSection();
    showTransactionAnimation(`+${totalGain}`, true, document.querySelector(`.sell-btn[data-index="${index}"]`));
    playCoinSound();
    checkLevelUp();
    checkCoinAchievement();
}

// Buka tab Sell
function openSellTab() {
    switchTab('shop');
    document.getElementById('shop-sell-tab').classList.add('active');
    document.getElementById('shop-buy-tab').classList.remove('active');
    document.getElementById('shop-content').style.display = 'none';
    document.getElementById('sell-section').style.display = 'block';
    renderSellSection();
    playMenuSound();
}

// Cek level up
function checkLevelUp() {
    while (xp >= level * 100) {
        xp -= level * 100;
        level++;
        showNotification(`Level Up! ${level}`);
    }
    updateWallet();
}

// Switch tab
function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(tab)?.classList.add('active');
    document.querySelector(`.tab-btn[data-tab="${tab}"]`)?.classList.add('active');
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

// Tukar PI ke Farm Coins
function exchangePi() {
    const amount = parseFloat(document.getElementById('exchange-amount').value);
    if (isNaN(amount) || amount <= 0) {
        showNotification('Invalid amount!');
        return;
    }
    if (pi >= amount) {
        pi -= amount;
        farmCoins += amount * piToFarmRate;
        updateWallet();
        showNotification('Exchanged!');
        playCoinSound();
        checkCoinAchievement();
        updateExchangeResult();
    } else {
        showNotification('Not Enough PI!');
    }
}

// Update hasil tukar
function updateExchangeResult() {
    const amount = parseFloat(document.getElementById('exchange-amount').value) || 0;
    document.getElementById('exchange-result').textContent = amount * piToFarmRate;
}

// Cek dan tampilkan modal reward harian
function checkAndShowRewardModal() {
    if (!userId || isClaiming) return;
    const playerRef = ref(database, `players/${userId}/lastClaim`);
    get(playerRef).then(snapshot => {
        lastClaim = snapshot.val();
        const today = new Date().toISOString().split('T')[0];
        if (lastClaim === today) {
            document.getElementById('claim-reward-btn').classList.add('claimed');
            document.getElementById('claim-reward-btn').textContent = 'Claimed!';
            document.getElementById('claim-reward-btn').disabled = true;
            claimedToday = true;
            return;
        }
        isClaiming = true;
        rewardModal.style.display = 'block';
        document.getElementById('daily-reward-text').textContent = 'You got +100 Farm Coins & +50 Water!';
    }).catch(error => {
        console.error('Error checking last claim:', error.message);
        showNotification('Error checking daily reward.');
        isClaiming = false;
    });
}

// Klaim reward harian
addSafeClickListener(claimModalBtn, () => {
    if (!userId) return;
    farmCoins += 100;
    water += 50;
    xp += 20;
    lastClaim = new Date().toISOString();
    claimedToday = true;
    const playerRef = ref(database, `players/${userId}`);
    update(playerRef, { farmCoins, water, xp, lastClaim, claimedToday })
        .then(() => {
            updateWallet();
            rewardModal.style.display = 'none';
            document.getElementById('claim-reward-btn').classList.add('claimed');
            document.getElementById('claim-reward-btn').textContent = 'Claimed!';
            document.getElementById('claim-reward-btn').disabled = true;
            playCoinSound();
            showNotification('Reward Claimed!');
        })
        .catch(error => {
            console.error('Error claiming reward:', error.message);
            showNotification('Error claiming reward.');
        })
        .finally(() => isClaiming = false);
});

// Cek status reward harian
function checkDailyReward() {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    const btn = document.getElementById('claim-reward-btn');
    if (lastClaim === today) {
        btn.classList.add('claimed');
        btn.textContent = 'Claimed!';
        btn.disabled = true;
    } else {
        btn.classList.remove('claimed');
        btn.textContent = 'Claim Daily Reward';
        btn.disabled = false;
    }
}

// Tampilkan notifikasi
function showNotification(message) {
    const notification = document.getElementById('notification');
    if (!notification) return;
    notification.textContent = message;
    notification.style.display = 'block';
    setTimeout(() => notification.style.display = 'none', 3000);
}

// Tampilkan animasi transaksi
function showTransactionAnimation(amount, isPositive, buttonElement) {
    const animation = document.createElement('div');
    animation.classList.add('transaction-animation', isPositive ? 'positive' : 'negative');
    animation.textContent = amount;
    document.body.appendChild(animation);
    const rect = buttonElement.getBoundingClientRect();
    animation.style.left = `${rect.left + rect.width / 2}px`;
    animation.style.top = `${rect.top - 20}px`;
    setTimeout(() => animation.remove(), 1000);
}

// Cek pencapaian panen
function checkHarvestAchievement() {
    if (harvestCount >= 10 && !achievements.harvest) {
        achievements.harvest = true;
        farmCoins += 500;
        showNotification('Achievement Unlocked: Harvest Master! +500 Coins');
        updateWallet();
        renderAchievements();
    }
}

// Cek pencapaian koin
function checkCoinAchievement() {
    if (farmCoins >= 1000 && !achievements.coins) {
        achievements.coins = true;
        water += 100;
        showNotification('Achievement Unlocked: Coin Collector! +100 Water');
        updateWallet();
        renderAchievements();
    }
}

// Render pencapaian
function renderAchievements() {
    const content = document.getElementById('achievements-content');
    if (!content) return;
    content.innerHTML = `
        <div class="achievement">
            <h3>Harvest Master</h3>
            <p>Harvest 10 crops</p>
            <p>Status: ${achievements.harvest ? 'Unlocked' : 'Locked'}</p>
        </div>
        <div class="achievement">
            <h3>Coin Collector</h3>
            <p>Collect 1000 Farm Coins</p>
            <p>Status: ${achievements.coins ? 'Unlocked' : 'Locked'}</p>
        </div>
    `;
    savePlayerData();
}

// Update teks UI berdasarkan bahasa
function updateUIText() {
    if (!langData[currentLang]) return;
    document.getElementById('title').textContent = langData[currentLang].title || 'Harvest Pi';
    document.getElementById('game-title').textContent = langData[currentLang].title || 'Harvest Pi';
    document.getElementById('start-text').textContent = langData[currentLang].startGame || 'Start Game';
    document.querySelector('.tab-btn[data-tab="farm"]').textContent = langData[currentLang].farmTab || 'Farm';
    document.querySelector('.tab-btn[data-tab="shop"]').textContent = langData[currentLang].shopTab || 'Shop';
    document.querySelector('.tab-btn[data-tab="upgrades"]').textContent = langData[currentLang].upgradesTab || 'Upgrades';
    document.querySelector('.tab-btn[data-tab="inventory"]').textContent = langData[currentLang].inventoryTab || 'Inventory';
    document.querySelector('.tab-btn[data-tab="exchange"]').textContent = langData[currentLang].exchangeTab || 'Exchange';
    document.querySelector('.tab-btn[data-tab="depositPi"]').textContent = langData[currentLang].depositPiTab || 'Deposit Pi Coin';
    document.querySelector('.tab-btn[data-tab="leaderboard"]').textContent = langData[currentLang].leaderboardTab || 'Leaderboard';
    document.querySelector('.tab-btn[data-tab="achievements"]').textContent = langData[currentLang].achievementsTab || 'Achievements';
    document.getElementById('lang-toggle').textContent = langData[currentLang].switchLang || 'Switch Language (EN/ID)';
    document.getElementById('game-lang-toggle').textContent = langData[currentLang].switchLang || 'Switch Language (EN/ID)';
    document.getElementById('upgrades-title').textContent = langData[currentLang].upgradesTitle || 'Upgrades';
    document.getElementById('upgrades-content').textContent = langData[currentLang].comingSoon || 'Coming soon...';
    document.getElementById('exchange-title').textContent = langData[currentLang].exchangeTitle || 'Exchange';
    document.getElementById('exchange-rate').textContent = `1 PI = 1,000,000 ${langData[currentLang].coinLabel || 'Coins'}`;
    document.getElementById('exchange-amount').placeholder = langData[currentLang].enterPiAmount || 'Enter PI amount';
    document.getElementById('exchange-result-label').textContent = `${langData[currentLang].farmCoinsLabel || 'Farm Coins'}: `;
    document.getElementById('exchange-btn').textContent = langData[currentLang].exchangeButton || 'Exchange to Farm Coins';
    document.getElementById('leaderboard-title').textContent = langData[currentLang].leaderboardTitle || 'Leaderboard';
    document.getElementById('leaderboard-content').textContent = langData[currentLang].comingSoon || 'Coming soon...';
    document.getElementById('settings-title').textContent = langData[currentLang].settingsTitle || 'Settings';
    document.getElementById('music-volume-label').textContent = langData[currentLang].musicVolumeLabel || 'Music Volume:';
    document.getElementById('voice-volume-label').textContent = langData[currentLang].voiceVolumeLabel || 'Voice/SFX Volume:';
    document.getElementById('exit-game-btn').textContent = langData[currentLang].exitGame || 'Exit';
    document.getElementById('daily-reward-title').textContent = langData[currentLang].dailyRewardTitle || 'Daily Reward';
    document.getElementById('claim-modal-btn').textContent = langData[currentLang].claimButton || 'Claim';
    document.getElementById('shop-buy-tab').textContent = langData[currentLang].buyTab || 'Buy';
    document.getElementById('shop-sell-tab').textContent = langData[currentLang].sellTab || 'Sell';
    document.getElementById('sell-section-title').textContent = langData[currentLang].sellSectionTitle || 'Sell Items';
    updateWallet();
    renderShop();
    renderInventory();
    renderSellSection();
    renderAchievements();
    checkDailyReward();
}

// Toggle bahasa
function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'id' : 'en';
    localStorage.setItem('language', currentLang);
    updateUIText();
}

// Mulai game
function startGame() {
    if (!userId) {
        console.warn('Login required!');
        showModal();
        return;
    }
    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');
    if (startScreen && gameScreen) {
        startScreen.style.display = 'none';
        gameScreen.style.display = 'flex';
        gameScreen.classList.add('fade-in');
        setTimeout(() => gameScreen.classList.remove('fade-in'), 600); // Match fade-in duration
        document.getElementById('exit-game-btn').style.display = 'block';
        isAudioPlaying = false;
        playBgMusic();
        playBgVoice();
        switchTab('farm');
        enterFullScreen();
    }
}

// Inisialisasi game
async function initializeGame() {
    try {
        await loadData();
        updateUIText();
        setTimeout(() => {
            const loadingScreen = document.getElementById('loading-screen');
            const loginScreen = document.getElementById('login-screen');
            const startScreen = document.getElementById('start-screen');
            if (loadingScreen && loginScreen && startScreen) {
                loadingScreen.style.display = 'none';
                // Selalu tampilkan login screen terlebih dahulu
                loginScreen.style.display = 'flex';
                startScreen.style.display = 'none'; // Pastikan start screen disembunyikan
                // Jika userId sudah ada, langsung ke start screen setelah login
                if (userId) {
                    loginScreen.style.display = 'none';
                    startScreen.style.display = 'flex';
                    loadPlayerData();
                }
            }
        }, 1000);
    } catch (error) {
        console.error('Error initializing game:', error.message);
        showNotification('Error initializing game.');
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

// Toggle fullscreen
function enterFullScreen() {
    document.documentElement.requestFullscreen?.() || document.documentElement.mozRequestFullScreen?.() ||
    document.documentElement.webkitRequestFullscreen?.() || document.documentElement.msRequestFullscreen?.();
}

function exitFullScreen() {
    document.exitFullscreen?.() || document.mozCancelFullScreen?.() || document.webkitExitFullscreen?.() ||
    document.msExitFullscreen?.();
}

// Tambahan volume slider
document.getElementById('music-volume').addEventListener('input', () => {
    localStorage.setItem('musicVolume', document.getElementById('music-volume').value);
    updateVolumes();
});
document.getElementById('voice-volume').addEventListener('input', () => {
    localStorage.setItem('voiceVolume', document.getElementById('voice-volume').value);
    updateVolumes();
});
