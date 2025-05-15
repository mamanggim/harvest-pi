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
let piInitialized = false;
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

function loadUserBalances() {
    const playerRef = ref(database, `players/${userId}`);
    onValue(playerRef, (snapshot) => {
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
async function initializePiSDK() {
    if (!window.Pi) {
        console.error('Pi SDK not loaded');
        showNotification('Pi Network SDK not available. Please try again later.');
        return false;
    }

    try {
        await Pi.init({
            version: "2.0",
            sandbox: false,
            appId: "0k7py9pfz2zpndv3azmsx3utawgrfdkc1e1dlgfrbl4fywolpdl8q9s9c9iguvos" // Pi API key
        });
        piInitialized = true;
        console.log('Pi SDK initialized successfully');
        return true;
    } catch (error) {
        console.error('Pi init failed:', error);
        showNotification('Failed to initialize Pi SDK: ' + error.message);
        return false;
    }
}

// Update fungsi authenticateWithPi
async function authenticateWithPi() {
    if (!window.Pi) {
        console.error('Pi SDK not loaded');
        showNotification('Pi Network SDK not available. Please try again later.');
        return;
    }

    if (!piInitialized) {
        const initialized = await initializePiSDK();
        if (!initialized) return;
    }

    const scopes = ['username', 'payments'];
    Pi.authenticate(scopes, onIncompletePaymentFound)
        .then(authResult => {
            console.log('Pi Auth success:', authResult);
            const user = authResult.user;
            userId = user.uid; // Gunain UID, lebih unik
            const playerRef = ref(database, `players/${userId}`);

            loadUserBalances(); // Tampilkan saldo Pi & FC dari database
            
            update(playerRef, {
                piUser: {
                    uid: user.uid,
                    username: user.username
                },
                pi: pi || 0
            }).then(() => {
                showNotification(`Logged in as ${user.username}`);
                localStorage.setItem('userId', userId); // Simpan userId
                const loginScreenElement = document.getElementById('login-screen');
                const startScreenElement = document.getElementById('start-screen');
                if (loginScreenElement && startScreenElement) {
                    loginScreenElement.style.display = 'none';
                    startScreenElement.style.display = 'flex';
                }
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
}

function onIncompletePaymentFound(payment) {
    console.log("onIncompletePaymentFound triggered:", payment, "at", new Date().toISOString());
    // Cek kalau paymentId ada, coba resolve manual (opsional)
    if (payment && payment.paymentId) {
        console.log("Incomplete payment detected with paymentId:", payment.paymentId);
        realDepositMsg.textContent = 'Terdeteksi pembayaran sebelumnya yang belum selesai. Coba lagi atau hubungi support.';
        // Kalau mau handle, bisa panggil backend di sini, tapi skip dulu kalau gak perlu
    } else {
        console.log("No valid payment data in onIncompletePaymentFound.");
    }
}

// Document ready event listener
document.addEventListener('DOMContentLoaded', () => {
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
    
    const exchangeBtnElement = document.getElementById('exchange-btn');
    if (exchangeBtnElement) addSafeClickListener(exchangeBtnElement, handleExchange);
    
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

    const loginPiBtnElement = document.getElementById('login-pi-btn');
    if (loginPiBtnElement) addSafeClickListener(loginPiBtnElement, authenticateWithPi);

initializePiSDK().catch(error => console.error('Initial Pi SDK init failed:', error));

// Fitur Deposit
const realDepositBtn = document.getElementById("real-deposit-btn");
const realDepositMsg = document.getElementById("real-deposit-msg");
const depositAmountInput = document.getElementById("deposit-amount");

// Load nilai input dari localStorage kalau ada
if (depositAmountInput) {
    const savedAmount = localStorage.getItem("depositAmount");
    if (savedAmount) {
        depositAmountInput.value = savedAmount;
    } else {
        depositAmountInput.value = "0"; // Default nol
    }

    depositAmountInput.addEventListener("input", () => {
        localStorage.setItem("depositAmount", depositAmountInput.value);
    });
}

if (realDepositBtn) {
    console.log("Real deposit button found, attaching click listener...");
    addSafeClickListener(realDepositBtn, async () => {
        console.log("Deposit button clicked at", new Date().toISOString());
        realDepositMsg.textContent = '';

        if (!userId || !window.Pi || !Pi.createPayment) {
            console.log("Pi SDK or user not ready:", { userId, Pi: window.Pi });
            realDepositMsg.textContent = 'Pi SDK tidak siap atau user belum login. Silakan login lagi.';
            return;
        }

        try {
            console.log("Verifying 'payments' scope with onIncompletePaymentFound...");
            const scopes = ['payments'];
            const authResult = await Pi.authenticate(scopes, onIncompletePaymentFound);
            console.log("Scope 'payments' verified:", authResult);
            userId = authResult.user.uid;
        } catch (authError) {
            console.error("Failed to verify 'payments' scope:", authError.message);
            realDepositMsg.textContent = 'Gagal verifikasi scope. Silakan login lagi.';
            return;
        }

        const amount = parseFloat(depositAmountInput?.value || "1");
        if (isNaN(amount) || amount < 1) {
            console.log("Invalid amount:", amount);
            realDepositMsg.textContent = 'Minimal 1 Pi diperlukan.';
            return;
        }

        localStorage.setItem("depositAmount", amount.toString());

        const memo = "Deposit to Harvest Pi";
        const metadata = { userId, redirectUrl: "https://harvestpi.biz.id" };

        try {
            realDepositBtn.disabled = true;
            realDepositBtn.textContent = "Memproses...";
            console.log("Starting deposit process with Pi.createPayment...");

            const withTimeout = (promise, message, timeout) => {
                return Promise.race([
                    promise,
                    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), timeout))
                ]);
            };

            const wakeUpServer = async () => {
                const maxRetries = 5;
                let attempt = 0;
                while (attempt < maxRetries) {
                    try {
                        console.log(`Membangunkan server Glitch, percobaan ${attempt + 1}...`);
                        const wakeStart = Date.now();
                        const response = await fetch('https://harvestpi-backend.glitch.me/', { method: 'GET', timeout: 5000 });
                        if (!response.ok) throw new Error(`Wake up failed: ${response.statusText}`);
                        console.log(`Server Glitch aktif dalam ${Date.now() - wakeStart}ms`);
                        return true;
                    } catch (wakeError) {
                        attempt++;
                        console.error(`Percobaan bangun server ke-${attempt} gagal:`, wakeError.message);
                        if (attempt === maxRetries) throw new Error('Gagal membangunkan server Glitch setelah 5 percobaan');
                        await new Promise(resolve => setTimeout(resolve, 3000 * attempt));
                    }
                }
            };

            await wakeUpServer();

            const paymentPromise = Pi.createPayment(
                {
                    amount,
                    memo,
                    metadata
                },
                {
                    onReadyForClientReview: (paymentId) => {
                        console.log("onReadyForClientReview triggered:", paymentId, "at", new Date().toISOString());
                        realDepositMsg.textContent = 'Menunggu Pi Wallet terbuka untuk konfirmasi biometrik dalam 31 detik...';
                        let timeLeft = 30;
                        const interval = setInterval(() => {
                            if (timeLeft > 0) {
                                realDepositMsg.textContent = `Menunggu Pi Wallet terbuka untuk konfirmasi biometrik... (${timeLeft}s)`;
                                timeLeft--;
                            } else {
                                clearInterval(interval);
                            }
                        }, 1000);

                        setTimeout(() => {
                            if (realDepositMsg.textContent.includes('31 detik')) {
                                console.error("Pi Wallet gagal merespons setelah 30 detik.");
                                realDepositMsg.textContent = 'Pi Wallet gagal merespons. Cek backend atau coba lagi nanti.';
                                realDepositBtn.disabled = false;
                                realDepositBtn.textContent = "Deposit with Pi Testnet";
                                window.location.href = "https://harvestpi.biz.id";
                            }
                        }, 30000);
                    },
                    onReadyForServerApproval: async (paymentId) => {
                        console.log("onReadyForServerApproval triggered:", paymentId, "at", new Date().toISOString());
                        if (!paymentId) throw new Error("Invalid paymentId di onReadyForServerApproval");

                        const maxRetries = 5;
                        let attempt = 0;
                        while (attempt < maxRetries) {
                            try {
                                const approvalStart = Date.now();
                                const response = await withTimeout(
                                    fetch('https://harvestpi-backend.glitch.me/approve-payment', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ paymentId })
                                    }),
                                    "Permintaan approval timeout",
                                    30000
                                );
                                const result = await response.json();
                                if (!response.ok || !result.success) throw new Error(`Approval gagal: ${result.message || response.statusText}`);
                                console.log(`Pembayaran disetujui oleh backend dalam ${Date.now() - approvalStart}ms:`, paymentId);
                                return;
                            } catch (approvalError) {
                                attempt++;
                                console.error(`Percobaan approval ke-${attempt} gagal:`, approvalError.message);
                                if (attempt === maxRetries) throw new Error("Gagal menyetujui pembayaran setelah 5 percobaan: " + approvalError.message);
                                await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
                            }
                        }
                    },
                    onReadyForServerCompletion: async (paymentId, txid) => {
                        console.log("onReadyForServerCompletion triggered:", paymentId, txid, "at", new Date().toISOString());
                        if (!paymentId || !txid) throw new Error("Invalid paymentId atau txid di onReadyForServerCompletion");

                        const maxRetries = 5;
                        let attempt = 0;
                        while (attempt < maxRetries) {
                            try {
                                const completeStart = Date.now();
                                const response = await withTimeout(
                                    fetch('https://harvestpi-backend.glitch.me/complete-payment', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ paymentId, txid })
                                    }),
                                    "Permintaan completion timeout",
                                    30000
                                );
                                const result = await response.json();
                                if (!response.ok || !result.success) throw new Error(`Completion gagal: ${result.message || response.statusText}`);
                                console.log(`Pembayaran selesai oleh backend dalam ${Date.now() - completeStart}ms:`, paymentId);

                                if (response.ok && result.success) {
                                    const dbStart = Date.now();
                                    const playerRef = ref(database, `players/${userId}`);
                                    const snapshot = await withTimeout(get(playerRef), "Pembacaan database timeout", 2000);
                                    const data = snapshot.val() || {};
                                    const currentPi = data.piBalance || 0;
                                    const currentDeposit = data.totalDeposit || 0;

                                    const newPiBalance = currentPi + amount;
                                    await withTimeout(
                                        update(playerRef, {
                                            piBalance: newPiBalance,
                                            totalDeposit: currentDeposit + amount
                                        }),
                                        "Update database timeout",
                                        2000
                                    );
                                    console.log(`Database diperbarui dalam ${Date.now() - dbStart}ms`);

                                    window.piBalance = newPiBalance;
                                    updateWallet();
                                    realDepositMsg.textContent = `Deposit berhasil! +${amount} Pi`;
                                }
                                return;
                            } catch (completeError) {
                                attempt++;
                                console.error(`Percobaan completion ke-${attempt} gagal:`, completeError.message);
                                if (attempt === maxRetries) throw new Error("Gagal menyelesaikan pembayaran setelah 5 percobaan: " + completeError.message);
                                await new Promise(resolve => setTimeout(resolve, 5000 * attempt));
                            }
                        }
                    },
                    onCancel: (paymentId) => {
                        console.log("onCancel triggered:", paymentId, "at", new Date().toISOString());
                        realDepositMsg.textContent = 'Deposit dibatalkan. Kembali ke aplikasi...';
                        realDepositBtn.disabled = false;
                        realDepositBtn.textContent = "Deposit with Pi Testnet";
                        window.location.href = "https://harvestpi.biz.id";
                    },
                    onError: (error, paymentId) => {
                        console.error("onError triggered:", error.message, "Payment ID:", paymentId, "at", new Date().toISOString());
                        realDepositMsg.textContent = `Error saat deposit: ${error.message}. Kembali ke aplikasi...`;
                        realDepositBtn.disabled = false;
                        realDepositBtn.textContent = "Deposit with Pi Testnet";
                        window.location.href = "https://harvestpi.biz.id";
                    }
                }
            );

            await withTimeout(paymentPromise, "Proses deposit timeout", 120000);
            console.log("Pi.createPayment berhasil dijalankan");
        } catch (err) {
            console.error("Deposit gagal:", err.message, "at", new Date().toISOString());
            realDepositMsg.textContent = `Gagal memproses deposit: ${err.message}. Kembali ke aplikasi...`;
            realDepositBtn.disabled = false;
            realDepositBtn.textContent = "Deposit with Pi Testnet";
            window.location.href = "https://harvestpi.biz.id";
        }
    });
}

initializeGame();
});

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

    if (farmCoinsElement) {
        farmCoinsElement.textContent = `${farmCoins} ${langData[currentLang]?.coinLabel || 'Coins'}`;
    } else {
        console.warn('Element with ID "farm-coins" not found');
    }

    if (piCoinsElement) {
        piCoinsElement.textContent = `${pi.toFixed(6)} PI`;
    } else {
        console.warn('Element with ID "pi-coins" not found');
    }

    if (waterElement) {
        waterElement.textContent = `${water} ${langData[currentLang]?.waterLabel || 'Water'}`;
    } else {
        console.warn('Element with ID "water" not found');
    }

    if (levelElement) {
        levelElement.textContent = `Level: ${level} | XP: ${xp}`;
    } else {
        console.warn('Element with ID "level" not found');
    }

    if (xpFillElement) {
        const xpPercentage = (xp / (level * 100)) * 100;
        xpFillElement.style.width = `${xpPercentage}%`;
    } else {
        console.warn('Element with ID "xp-fill" not found');
    }

    // Update elemen di tab depositPi
    const farmCoinBalanceElement = document.getElementById('farm-coin-balance');
    const piCoinBalanceElement = document.getElementById('pi-coin-balance');
    if (farmCoinBalanceElement) {
        farmCoinBalanceElement.textContent = farmCoins;
    }
    if (piCoinBalanceElement) {
        piCoinBalanceElement.textContent = pi.toFixed(6);
    }

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
                if (pi >= 0.0001) {
                    pi -= 0.0001;
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
    }

    playMenuSound();
}

// Exchange PI to Farm Coins to PI
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

    // Bikin versi singkat kalau terlalu panjang
    const shortDisplay = resultText.length > 25 ? resultText.substring(0, 25) + "…" : resultText;

    resultDiv.textContent = shortDisplay;
    resultDiv.title = resultText; // tooltip jika dihover
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

  pi = Math.round(pi * 1000000) / 1000000;
  fc = Math.floor(fc);

  // Tampilkan loading
  document.getElementById("exchange-loading").style.display = "block";

  // Delay 3 detik
  setTimeout(() => {
    (async () => {
      try {
        await update(playerRef, {
          piBalance: pi,
          farmCoins: fc
        });

        const piElem = document.getElementById("pi-balance");
        const fcElem = document.getElementById("fc-balance");

        if (piElem) piElem.textContent = pi.toLocaleString(undefined, { maximumFractionDigits: 6 });
        if (fcElem) fcElem.textContent = fc.toLocaleString();
        document.getElementById("exchange-amount").value = "";

        updateExchangeResult(resultText);
       
        // Mainkan suara
        try {
          await coinSound.play();
        } catch (err) {
          console.error("Error playing sound:", err);
        }

        // Tampilkan notifikasi
        showNotification("Exchange success!");
      } catch (error) {
        console.error("Exchange failed:", error.message);
        showNotification("Exchange failed: " + error.message);
      } finally {
        // Sembunyikan loading setelah semua selesai
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
    exchangeBtn.textContent = "Exchange to Pi";
  }
});

// Trigger sekali pas awal halaman dimuat
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

// Show transaction animation
function showTransactionAnimation(amount, isPositive, buttonElement) {
    const animation = document.createElement('div');
    animation.classList.add('transaction-animation');
    animation.classList.add(isPositive ? 'positive' : 'negative');
    animation.textContent = amount;

    document.body.appendChild(animation);

    const rect = buttonElement ? buttonElement.getBoundingClientRect() : { left: 0, top: 0, width: 0 };
    animation.style.left = `${rect.left + rect.width / 2}px`;
    animation.style.top = `${rect.top - 20}px`;

    setTimeout(() => {
        if (animation.parentNode) animation.remove();
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
    const achievementsContentElement = document.getElementById('achievements-content');
    if (!achievementsContentElement) return;

    achievementsContentElement.innerHTML = '';

    const harvestAchievement = document.createElement('div');
    harvestAchievement.classList.add('achievement');
    harvestAchievement.innerHTML = `
        <h3>${langData[currentLang]?.harvestAchievementTitle || 'Harvest Master'}</h3>
        <p>${langData[currentLang]?.harvestAchievementDesc || 'Harvest 10 crops'}</p>
        <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.harvest ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
    `;
    achievementsContentElement.appendChild(harvestAchievement);

    const coinAchievement = document.createElement('div');
    coinAchievement.classList.add('achievement');
    coinAchievement.innerHTML = `
        <h3>${langData[currentLang]?.coinAchievementTitle || 'Coin Collector'}</h3>
        <p>${langData[currentLang]?.coinAchievementDesc || 'Collect 1000 Farm Coins'}</p>
        <p>${langData[currentLang]?.statusLabel || 'Status'}: ${achievements.coins ? langData[currentLang]?.unlocked || 'Unlocked' : langData[currentLang]?.locked || 'Locked'}</p>
    `;
    achievementsContentElement.appendChild(coinAchievement);

    savePlayerData();
}

// Update UI text based on language
function updateUIText() {
    if (!langData[currentLang]) return;

    const titleElement = document.getElementById('title');
    if (titleElement) {
        titleElement.textContent = langData[currentLang]?.title || 'Harvest Pi';
    }

    const gameTitleElement = document.getElementById('game-title');
    if (gameTitleElement) {
        gameTitleElement.textContent = langData[currentLang]?.title || 'Harvest Pi';
    }

    const startTextElement = document.getElementById('start-text');
    if (startTextElement) {
        startTextElement.textContent = langData[currentLang]?.startGame || 'Start Game';
    }

    const farmTabElement = document.querySelector('.tab-btn[data-tab="farm"]');
    if (farmTabElement) {
        farmTabElement.textContent = langData[currentLang]?.farmTab || 'Farm';
    }

    const shopTabElement = document.querySelector('.tab-btn[data-tab="shop"]');
    if (shopTabElement) {
        shopTabElement.textContent = langData[currentLang]?.shopTab || 'Shop';
    }

    const upgradesTabElement = document.querySelector('.tab-btn[data-tab="upgrades"]');
    if (upgradesTabElement) {
        upgradesTabElement.textContent = langData[currentLang]?.upgradesTab || 'Upgrades';
    }

    const inventoryTabElement = document.querySelector('.tab-btn[data-tab="inventory"]');
    if (inventoryTabElement) {
        inventoryTabElement.textContent = langData[currentLang]?.inventoryTab || 'Inventory';
    }

    const exchangeTabElement = document.querySelector('.tab-btn[data-tab="exchange"]');
    if (exchangeTabElement) {
        exchangeTabElement.textContent = langData[currentLang]?.exchangeTab || 'Exchange';
    }

    const financeTabElement = document.querySelector('.tab-btn[data-tab="finance"]');
    if (financeTabElement) {
        financeTabElement.textContent = langData[currentLang]?.financeTab || 'Finance';
    }

    const leaderboardTabElement = document.querySelector('.tab-btn[data-tab="leaderboard"]');
    if (leaderboardTabElement) {
        leaderboardTabElement.textContent = langData[currentLang]?.leaderboardTab || 'Leaderboard';
    }

    const achievementsTabElement = document.querySelector('.tab-btn[data-tab="achievements"]');
    if (achievementsTabElement) {
        achievementsTabElement.textContent = langData[currentLang]?.achievementsTab || 'Achievements';
    }

    const langToggleElement = document.getElementById('lang-toggle');
    if (langToggleElement) {
        langToggleElement.textContent = langData[currentLang]?.switchLang || 'Switch Language (EN/ID)';
    }

    const gameLangToggleElement = document.getElementById('game-lang-toggle');
    if (gameLangToggleElement) {
        gameLangToggleElement.textContent = langData[currentLang]?.switchLang || 'Switch Language (EN/ID)';
    }

    const upgradesTitleElement = document.getElementById('upgrades-title');
    if (upgradesTitleElement) {
        upgradesTitleElement.textContent = langData[currentLang]?.upgradesTitle || 'Upgrades';
    }

    const upgradesContentElement = document.getElementById('upgrades-content');
    if (upgradesContentElement) {
        upgradesContentElement.textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    }

    const exchangeTitleElement = document.getElementById('exchange-title');
    if (exchangeTitleElement) {
        exchangeTitleElement.textContent = langData[currentLang]?.exchangeTitle || 'Exchange';
    }

    const exchangeRateElement = document.getElementById('exchange-rate');
    if (exchangeRateElement) {
        exchangeRateElement.textContent = `${langData[currentLang]?.exchangeRate || '1 PI = 1,000,000 Farm Coins'}`;
    }

    const exchangeAmountElement = document.getElementById('exchange-amount');
    if (exchangeAmountElement) {
        exchangeAmountElement.placeholder = langData[currentLang]?.enterPiAmount || 'Enter PI amount';
    }

    const exchangeResultLabelElement = document.getElementById('exchange-result-label');
    if (exchangeResultLabelElement) {
        exchangeResultLabelElement.textContent = `${langData[currentLang]?.farmCoinsLabel || 'Farm Coins'}: `;
    }

    const exchangeBtnElement = document.getElementById('exchange-btn');
    if (exchangeBtnElement) {
        exchangeBtnElement.textContent = langData[currentLang]?.exchangeButton || 'Exchange to Farm Coins';
    }

    const leaderboardTitleElement = document.getElementById('leaderboard-title');
    if (leaderboardTitleElement) {
        leaderboardTitleElement.textContent = langData[currentLang]?.leaderboardTitle || 'Leaderboard';
    }

    const leaderboardContentElement = document.getElementById('leaderboard-content');
    if (leaderboardContentElement) {
        leaderboardContentElement.textContent = langData[currentLang]?.comingSoon || 'Coming soon...';
    }

    const settingsTitleElement = document.getElementById('settings-title');
    if (settingsTitleElement) {
        settingsTitleElement.textContent = langData[currentLang]?.settingsTitle || 'Settings';
    }

    const musicVolumeLabelElement = document.getElementById('music-volume-label');
    if (musicVolumeLabelElement) {
        musicVolumeLabelElement.textContent = langData[currentLang]?.musicVolumeLabel || 'Music Volume:';
    }

    const voiceVolumeLabelElement = document.getElementById('voice-volume-label');
    if (voiceVolumeLabelElement) {
        voiceVolumeLabelElement.textContent = langData[currentLang]?.voiceVolumeLabel || 'Voice/SFX Volume:';
    }

    const exitGameBtnElement = document.getElementById('exit-game-btn');
    if (exitGameBtnElement) {
        exitGameBtnElement.textContent = langData[currentLang]?.exitGame || 'Exit';
    }

    const dailyRewardTitleElement = document.getElementById('daily-reward-title');
    if (dailyRewardTitleElement) {
        dailyRewardTitleElement.textContent = langData[currentLang]?.dailyRewardTitle || 'Daily Reward';
    }

    const claimModalBtnElement = document.getElementById('claim-modal-btn');
    if (claimModalBtnElement) {
        claimModalBtnElement.textContent = langData[currentLang]?.claimButton || 'Claim';
    }

    const shopBuyTabElement = document.getElementById('shop-buy-tab');
    if (shopBuyTabElement) {
        shopBuyTabElement.textContent = langData[currentLang]?.buyTab || 'Buy';
    }

    const shopSellTabElement = document.getElementById('shop-sell-tab');
    if (shopSellTabElement) {
        shopSellTabElement.textContent = langData[currentLang]?.sellTab || 'Sell';
    }

    const sellSectionTitleElement = document.getElementById('sell-section-title');
    if (sellSectionTitleElement) {
        sellSectionTitleElement.textContent = langData[currentLang]?.sellSectionTitle || 'Sell Items';
    }

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

// Initialize game
async function initializeGame() {
    try {
        await loadData();
        updateUIText();

        setTimeout(() => {
            const loadingScreenElement = document.getElementById('loading-screen');
            const loginScreenElement = document.getElementById('login-screen');
            if (loadingScreenElement && loginScreenElement) {
                loadingScreenElement.style.display = 'none';
                loginScreenElement.style.display = 'flex';
            }
        }, 1000);

        const loginPiBtnElement = document.getElementById('login-pi-btn');
        if (loginPiBtnElement) {
            addSafeClickListener(loginPiBtnElement, authenticateWithPi);
        }
    } catch (error) {
        console.error('Error initializing game:', error.message);
        showNotification('Error initializing game. Please reload.');
        setTimeout(() => {
            const loadingScreenElement = document.getElementById('loading-screen');
            const loginScreenElement = document.getElementById('login-screen');
            if (loadingScreenElement && loginScreenElement) {
                loadingScreenElement.style.display = 'none';
                loginScreenElement.style.display = 'flex';
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

//Fitur Deposit
const realDepositBtn = document.getElementById("real-deposit-btn");
const realDepositMsg = document.getElementById("real-deposit-msg");

if (realDepositBtn) {
  addSafeClickListener(realDepositBtn, async () => {
    realDepositMsg.textContent = '';

    if (!userId || !window.Pi) {
      realDepositMsg.textContent = 'Pi SDK not available or user not logged in.';
      return;
    }

    const amount = 1; // Bisa diubah sesuai jumlah Pi testnet yang diminta
    const memo = "Deposit to Harvest Pi";
    const metadata = { userId };

    try {
      realDepositBtn.disabled = true;
      realDepositBtn.textContent = "Processing...";

      // Inisiasi transaksi (testnet)
      const payment = await Pi.createPayment({
        amount,
        memo,
        metadata,
        onReadyForServerApproval: async (paymentId) => {
          console.log("Payment ready for server approval", paymentId);
          // Simulasi approve otomatis (testnet)
          await Pi.approvePayment(paymentId);
        },
        onReadyForServerCompletion: async (paymentId, txid) => {
          console.log("Payment approved, ready to complete", paymentId, txid);

          // Tambahkan Pi ke database
          const playerRef = ref(database, `players/${userId}`);
          const snapshot = await get(playerRef);
          const data = snapshot.val() || {};
          const currentPi = data.pi || 0;
          const currentDeposit = data.totalDeposit || 0;

          await update(playerRef, {
            pi: currentPi + amount,
            piBalance: currentPi + amount,
            totalDeposit: currentDeposit + amount
          });

          window.pi = currentPi + amount;
          window.piBalance = currentPi + amount;
          updateWallet();

          await Pi.completePayment(paymentId, txid);
          realDepositMsg.textContent = `Deposit success! +${amount} Pi`;
        },
        onCancel: (paymentId) => {
          console.warn("Payment cancelled", paymentId);
          realDepositMsg.textContent = 'Deposit cancelled.';
        },
        onError: (error) => {
          console.error("Payment error", error);
          realDepositMsg.textContent = 'Error during deposit.';
        }
      });
    } catch (error) {
      console.error("Deposit failed:", error);
      realDepositMsg.textContent = 'Failed to process deposit.';
    } finally {
      realDepositBtn.disabled = false;
      realDepositBtn.textContent = "Deposit with Pi Testnet";
    }
  });
}

// Fitur Withdraw
const realWithdrawBtn = document.getElementById("real-withdraw-btn");
const withdrawMsg = document.getElementById("withdraw-message");
const withdrawNoteElement = document.getElementById("withdraw-note");

function checkWithdrawEligibility(level, farmCoins, totalDeposit, piBalance) {
    const eligible = level >= 10 && farmCoins >= 10000000 && totalDeposit >= 10 && piBalance >= 1;
    if (realWithdrawBtn && withdrawNoteElement) {
        realWithdrawBtn.disabled = !eligible;
        withdrawNoteElement.style.display = eligible ? 'none' : 'block';
    }
}

async function updateWithdrawStatus() {
    if (!userId) return;

    try {
        const userRef = ref(database, 'players/' + userId);
        const snapshot = await get(userRef);
        const data = snapshot.val() || {};

        const level = data.level || 1;
        const farmCoins = data.farmCoins || 0;
        const totalDeposit = data.totalDeposit || 0;
        const piBalance = data.piBalance || 0;

        checkWithdrawEligibility(level, farmCoins, totalDeposit, piBalance);
    } catch (error) {
        console.error('Withdraw check error:', error);
    }
}
updateWithdrawStatus();

// Real withdraw via Pi testnet
if (realWithdrawBtn) {
    addSafeClickListener(realWithdrawBtn, async () => {
        withdrawMsg.textContent = '';

        if (!userId || !window.Pi) {
            withdrawMsg.textContent = 'User not authenticated or Pi SDK unavailable.';
            return;
        }

        const amount = 1; // Nominal withdraw testnet (misal 1 Pi)
        const memo = "Withdraw from Harvest Pi";
        const metadata = { userId };

        try {
            realWithdrawBtn.disabled = true;
            realWithdrawBtn.textContent = "Processing...";

            const playerRef = ref(database, `players/${userId}`);
            const snapshot = await get(playerRef);
            const data = snapshot.val() || {};

            let currentPi = data.piBalance || 0;
            if (currentPi < amount) {
                withdrawMsg.textContent = "Not enough Pi balance.";
                return;
            }

            // Buat payment ke user (testnet)
            const payment = await Pi.createPayment({
                amount,
                memo,
                metadata,
                to: userId, // pengirimannya ke user sendiri
                onReadyForServerApproval: async (paymentId) => {
                    console.log("Ready for approval:", paymentId);
                    await Pi.approvePayment(paymentId);
                },
                onReadyForServerCompletion: async (paymentId, txid) => {
                    console.log("Completing payment:", paymentId, txid);

                    // Kurangi saldo Pi
                    await update(playerRef, {
                        pi: currentPi - amount,
                        piBalance: currentPi - amount
                    });

                    window.pi = currentPi - amount;
                    window.piBalance = currentPi - amount;

                    updateWallet();
                    await Pi.completePayment(paymentId, txid);
                    withdrawMsg.textContent = `Withdraw success! -${amount} Pi`;
                    updateWithdrawStatus(); // Cek ulang kelayakan
                },
                onCancel: (paymentId) => {
                    console.warn("Payment cancelled:", paymentId);
                    withdrawMsg.textContent = 'Withdraw cancelled.';
                },
                onError: (error) => {
                    console.error("Payment error:", error);
                    withdrawMsg.textContent = 'Error during withdraw.';
                }
            });
        } catch (error) {
            console.error("Withdraw failed:", error);
            withdrawMsg.textContent = 'Failed to process withdraw.';
        } finally {
            realWithdrawBtn.disabled = false;
            realWithdrawBtn.textContent = "Withdraw Real Pi";
        }
    });
}

// Jalankan saat halaman siap
updateWithdrawStatus();
