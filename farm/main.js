// Ambil database dan auth dari firebase-config.js
import { auth, database, messaging, ref, onValue, set, update, get, push } from '/firebase/firebase-config.js';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, sendEmailVerification } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
let username = null;
let lastClaim = null;
const plotCount = 4;
const piToFarmRate = 1000000;
let claimedToday = false;
let isClaiming = false;
let isAudioPlaying = false;

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

    const loginEmailBtnElement = document.getElementById('login-email-btn');
    if (loginEmailBtnElement) addSafeClickListener(loginEmailBtnElement, () => {});

    const registerEmailBtnElement = document.getElementById('register-email-btn');
    if (registerEmailBtnElement) addSafeClickListener(registerEmailBtnElement, () => {});

    initializeGame();
});

// Deklarasi variabel (jangan hapus)
const registerEmailBtn = document.getElementById('register-email-btn');
const registerEmailInput = document.getElementById('register-email-input');
const registerPasswordInput = document.getElementById('register-password-input');
const registerError = document.getElementById('register-error');
const registerUsernameInput = document.getElementById('register-username-input');
const loginEmailBtn = document.getElementById('login-email-btn');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginError = document.getElementById('login-error');
const verifyEmailMsg = document.getElementById('verify-status');

// Fungsi untuk switch antara login dan register screen
function switchToLogin() {
    const loginScreenElement = document.getElementById('login-screen');
    const registerScreenElement = document.getElementById('register-screen');
    if (loginScreenElement && registerScreenElement) {
        loginScreenElement.style.display = 'flex';
        loginScreenElement.classList.add('active');
        registerScreenElement.style.display = 'none';
        registerScreenElement.classList.remove('active');
        console.log('switchToLogin called, login screen displayed');
    } else {
        console.error('Login or Register screen element not found');
    }
}

function switchToRegister() {
    const loginScreenElement = document.getElementById('login-screen');
    const registerScreenElement = document.getElementById('register-screen');
    if (loginScreenElement && registerScreenElement) {
        loginScreenElement.style.display = 'none';
        loginScreenElement.classList.remove('active');
        registerScreenElement.style.display = 'flex';
        registerScreenElement.classList.add('active');
        console.log('switchToRegister called, register screen displayed');
    } else {
        console.error('Login or Register screen element not found');
    }
}

// Event listener untuk link switch
document.addEventListener('DOMContentLoaded', () => {
    const registerLink = document.getElementById('register-link');
    const loginLink = document.getElementById('login-link');
    if (registerLink) {
        addSafeClickListener(registerLink, switchToRegister);
    }
    if (loginLink) {
        addSafeClickListener(loginLink, switchToLogin);
    }
    switchToLogin();
});

// Update referral link setelah login
function updateReferralLink() {
    const referralLinkElement = document.getElementById('referral-link');
    const copyReferralBtn = document.getElementById('copy-referral-btn');
    if (referralLinkElement && username) {
        const link = generateReferralLink(username);
        referralLinkElement.textContent = link;
        if (copyReferralBtn) {
            addSafeClickListener(copyReferralBtn, () => {
                copyToClipboard(link, copyReferralBtn);
                showNotification('Referral link copied!');
            });
        }
    } else {
        console.warn('Referral link element or username not found');
    }
}

// Listener untuk LOGIN
if (loginEmailBtn) {
  addSafeClickListener(loginEmailBtn, async (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
      loginError.style.display = 'block';
      loginError.textContent = 'Please enter email and password.';
      console.log('Login failed: Empty email or password');
      return;
    }

    try {
      // Login dengan Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Cek verifikasi email
      if (!user.emailVerified) {
        await sendEmailVerification(user);
        loginError.style.display = 'block';
        loginError.textContent = 'Please verify your email. Check your inbox.';
        verifyEmailMsg.style.display = 'block';
        console.log('Login failed: Email not verified, verification sent');
        return;
      }

      // Cari username berdasarkan email
      const playersRef = ref(database, 'players');
      const snapshot = await get(playersRef);
      const playersData = snapshot.val() || {};
      console.log('Players data:', playersData); // Debug
      let foundUsername = null;
      for (const playerUsername in playersData) {
        console.log('Checking:', playerUsername, 'Email:', playersData[playerUsername].email); // Debug
        if (playersData[playerUsername].email === email) {
          foundUsername = playerUsername;
          break;
        }
      }

      // Fallback ke encodedEmail
      if (!foundUsername) {
        const encodedEmail = email.replace('@', '_at_').replace(/\./g, '_dot_');
        const playerRef = ref(database, `players/${encodedEmail}`);
        const playerSnapshot = await get(playerRef);
        if (playerSnapshot.exists()) {
          foundUsername = encodedEmail;
        }
      }

      if (!foundUsername) {
        loginError.style.display = 'block';
        loginError.textContent = 'Account data not found in database. Please register.';
        console.log('Login failed: No player data for email', email);
        return;
      }

      // Cek player data
      const playerRef = ref(database, `players/${foundUsername}`);
      const playerSnapshot = await get(playerRef);
      const playerData = playerSnapshot.val();

      if (!playerData) {
        loginError.style.display = 'block';
        loginError.textContent = 'Player data not found. Please register.';
        console.log('Login failed: Player data missing for username', foundUsername);
        return;
      }

      // Cek status
      if (playerData.status !== 'approved') {
        loginError.style.display = 'block';
        loginError.textContent = `Account ${playerData.status}. Please contact support.`;
        console.log('Login failed: Account status', playerData.status, { email, foundUsername });
        return;
      }

      // Simpan ke localStorage
      const encodedEmail = email.replace('@', '_at_').replace(/\./g, '_dot_');
      localStorage.setItem('encodedEmail', encodedEmail);
      localStorage.setItem('email', email);
      localStorage.setItem('username', foundUsername); // Tambah username
      console.log('Login success:', { email, foundUsername, role: playerData.role }); // Debug

      // Setup notifikasi listener
      onValue(ref(database, `notifications/${foundUsername}`), (snapshot) => {
        const notifications = snapshot.val();
        if (notifications) {
          for (const id in notifications) {
            const notif = notifications[id];
            if (!notif.read) {
              showNotification(notif.message);
              update(ref(database, `notifications/${foundUsername}/${id}`), { read: true });
            }
          }
        }
      });

      // Redirect berdasarkan role
      const role = playerData.role || 'user';
      showNotification('Logged in as ' + email);

      if (role === 'admin') {
        console.log('Redirecting to admin.html');
        window.location.href = 'admin.html';
      } else {
        const loginScreenElement = document.getElementById('login-screen');
        const startScreenElement = document.getElementById('start-screen');
        if (loginScreenElement && startScreenElement) {
          loginScreenElement.style.display = 'none';
          startScreenElement.style.display = 'flex';
          console.log('Redirected to start screen');
        } else {
          console.error('Start or login screen element not found');
          loginError.style.display = 'block';
          loginError.textContent = 'Error: Start screen not found.';
        }
      }

      // Load data player
      loadPlayerData();
      updateReferralLink();
    } catch (error) {
      loginError.style.display = 'block';
      let errorMessage = 'Login failed. Please try again.';
      console.error('Login error:', error.code, error.message);
      switch (error.code) {
        case 'auth/invalid-credential':
          errorMessage = 'Invalid email or password.';
          break;
        case 'auth/user-not-found':
          errorMessage = 'Account not found.';
          break;
        case 'auth/wrong-password':
          errorMessage = 'Incorrect password.';
          break;
        case 'auth/too-many-requests':
          errorMessage = 'Too many attempts. Try again later.';
          break;
        case 'auth/network-request-failed':
          errorMessage = 'Network error. Check your connection.';
          break;
      }
      loginError.textContent = errorMessage;
      verifyEmailMsg.style.display = 'none';
    }
  });
}

// Tambah di main.js, setelah login sukses
if (username) {
  onValue(ref(database, `notifications/${username}`), (snapshot) => {
    const notifications = snapshot.val();
    if (notifications) {
      for (const id in notifications) {
        const notif = notifications[id];
        if (!notif.read) {
          showNotification(notif.message);
          update(ref(database, `notifications/${username}/${id}`), { read: true });
        }
      }
    }
  });
}

// Perbaiki startGame untuk pakai username, bukan userId
const startTextElement = document.getElementById('start-text');
if (startTextElement) {
    addSafeClickListener(startTextElement, () => {
        console.log('Start Text clicked, isDataLoaded:', isDataLoaded, 'username:', username);
        if (isDataLoaded && username) { // Ganti userId jadi username
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

// Load player data langsung dari username
function loadPlayerData() {
    try {
        if (!username) {
            console.warn('No username, please login first!');
            showNotification('Please login first.');
            return;
        }
        console.log('Loading data for username:', username);
        const playerRef = ref(database, `players/${username}`);
        console.log('Attempting to load from:', playerRef.toString());

        onValue(playerRef, (snapshot) => {
            console.log('Snapshot received:', snapshot.val());
            if (isDataLoaded) return;

            const data = snapshot.val();
            if (data) {
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
                referralEarnings = data.referralEarnings || 0;
                console.log('Player data loaded:', data);
            } else {
                console.log('No data found, initializing new data...');
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
                    totalDeposit: 0,
                    referralEarnings: 0,
                    username: username,
                    email: emailInput.value
                };
                set(playerRef, initialData).catch(err => {
                    console.error('Initial set failed:', err);
                    showNotification('Error initializing player data.');
                });
            }

            isDataLoaded = true;
            console.log('Data loading completed, isDataLoaded:', isDataLoaded);
            updateWallet();
            initializePlots();
            renderShop();
            renderInventory();
            renderSellSection();
            renderAchievements();
            checkDailyReward();
        }, (error) => {
            console.error('OnValue error:', error.message);
            showNotification('Failed to load data: ' + error.message);
        }, { onlyOnce: false });
    } catch (error) {
        console.error('Error in loadPlayerData:', error.message);
        showNotification('Failed to connect to Firebase: ' + error.message);
        isDataLoaded = false;
    }
}

// Fungsi generate referral link
function generateReferralLink(username) {
    return `https://www.harvestpi.biz.id/?ref=${username}`;
}

// Register dengan username dan email
if (registerEmailBtn) {
  addSafeClickListener(registerEmailBtn, async (e) => {
    e.preventDefault();
    const email = registerEmailInput.value;
    const password = registerPasswordInput.value;
    const inputUsername = registerUsernameInput ? registerUsernameInput.value : '';

    if (!email || !password || !inputUsername) {
      registerError.style.display = 'block';
      registerError.textContent = 'Please enter email, password, and username.';
      return;
    }

    try {
      // Validasi username
      const normalizedUsername = inputUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (!normalizedUsername || normalizedUsername.length < 3) {
        throw new Error('Username must be at least 3 characters and use letters/numbers only.');
      }

      // Encode email sebagai fallback
      const encodedEmail = email.replace('@', '_at_').replace('.', '_dot_');

      // Cek duplikat username
      const playerRef = ref(database, `players/${normalizedUsername}`);
      const snapshot = await get(playerRef);
      if (snapshot.exists()) {
        throw new Error('Username already taken.');
      }

      // Buat akun di Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Simpan data
      console.log('Saving player data:', { email, normalizedUsername, encodedEmail }); // Debug
      await set(playerRef, {
        email: email,
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

      await sendEmailVerification(user);
      registerError.style.display = 'block';
      registerError.textContent = 'Registration successful! Please verify your email.';
      showNotification('Registration successful! Check your email for verification.');
      registerEmailInput.value = '';
      registerPasswordInput.value = '';
      if (registerUsernameInput) registerUsernameInput.value = '';
      switchToLogin();
    } catch (error) {
      registerError.style.display = 'block';
      registerError.textContent = 'Registration failed: ' + error.message;
      console.error('Registration error:', error.message);
    }
  });
}

// Fungsi pendukung lainnya
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

const copyLinkBtn = document.getElementById('copy-link-btn');
if (copyLinkBtn) {
    addSafeClickListener(copyLinkBtn, () => {
        const referralLinkElement = document.getElementById('referral-link');
        if (referralLinkElement) {
            copyToClipboard(referralLinkElement.textContent);
        } else {
            console.error('Referral link element not found');
        }
    });
}

// Fungsi pendukung yang hilang
async function handleDeposit(username, amount) {
    if (!username || amount <= 0) return;
    const playerRef = ref(database, `players/${username}`);
    try {
        const snapshot = await get(playerRef);
        const playerData = snapshot.val() || {};
        const newBalance = (playerData.piBalance || 0) + amount;
        await update(playerRef, { piBalance: newBalance });
        console.log(`Deposit successful: ${amount} PI added to ${username}, new balance: ${newBalance} PI`);
        showNotification('Deposit successful!');
        loadUserBalances(); // Update UI
    } catch (error) {
        console.error('Error handling deposit:', error.message);
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

    const shortDisplay = resultText.length > 25 ? resultText.substring(0, 25) + "…" : resultText;

    resultDiv.textContent = shortDisplay;
    resultDiv.title = resultText;
}

async function handleExchange() {
  const rawAmount = document.getElementById("exchange-amount").value.replace(",", ".");
  const amount = parseFloat(rawAmount);
  const direction = document.getElementById("exchange-direction").value;
  const playerRef = ref(database, `players/${username}`);
  const snapshot = await get(playerRef);
  const data = snapshot.val();

  if (!data) return showNotification("Player data not found!");
  if (isNaN(amount) || amount <= 0) return showNotification("Invalid amount!");

  let piBalance = Number(data.piBalance || 0);
  let fc = Number(data.farmCoins || 0);
  let resultText = "";

  if (direction === "piToFc") {
    if (piBalance < amount) return showNotification("Not enough Pi!");
    const converted = Math.floor(amount * currentExchangeRate);
    piBalance -= amount;
    fc += converted;
    resultText = converted.toLocaleString();
  } else {
    if (fc < amount) return showNotification("Not enough FC!");
    const converted = amount / currentExchangeRate;
    fc -= amount;
    piBalance += converted;
    resultText = converted.toFixed(6);
  }

  piBalance = Math.round(piBalance * 1000000) / 1000000;
  fc = Math.floor(fc);

  document.getElementById("exchange-loading").style.display = "block";

  setTimeout(() => {
    (async () => {
      try {
        await update(playerRef, {
          piBalance: piBalance,
          farmCoins: fc
        });

        const piElem = document.getElementById("pi-balance");
        const fcElem = document.getElementById("fc-balance");

        if (piElem) piElem.textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
        if (fcElem) fcElem.textContent = fc.toLocaleString();
        document.getElementById("exchange-amount").value = "";

        updateExchangeResult(resultText);
       
        try {
          await coinSound.play();
        } catch (err) {
          console.error("Error playing sound:", err);
        }

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
    exchangeBtn.textContent = "Exchange to Pi";
  }
});

directionSelect.dispatchEvent(new Event("change"));

// Modal untuk daily reward
if (claimModalBtn) {
    addSafeClickListener(document.getElementById('claim-reward-btn'), async () => {
        const playerRef = ref(database, `players/${username}/lastClaim`);
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
    if (!username) return;

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
    if (harvestCount >= 100 && !achievements.harvest) {
        achievements.harvest = true;
        farmCoins += 500;
        showNotification(langData[currentLang]?.harvestAchievement || 'Achievement Unlocked: Harvest Master! +500 Coins');
        updateWallet();
        renderAchievements();
    }
}

// Check coin achievement
function checkCoinAchievement() {
    if (farmCoins >= 10000 && !achievements.coins) {
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
        exchangeTitleElement.textContent = langData[currentLang]?.exchangeTitle || 'Live Exchange';
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

    const financeTitleElement = document.getElementById('finance-title');
    if (financeTitleElement) {
        financeTitleElement.textContent = langData[currentLang]?.financeTitle || 'Finance';
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

// Initialize game
async function initializeGame() {
    try {
        await loadData();
        updateUIText();

        setTimeout(() => {
            const loadingScreenElement = document.getElementById('loading-screen');
            const loginScreenElement = document.getElementById('login-screen');
            if (loadingScreenElement && loginScreenElement) {
                console.log('Hiding loading screen, showing login screen');
                loadingScreenElement.style.display = 'none';
                switchToLogin(); // Ganti pake fungsi switch
                console.log('Login screen display:', loginScreenElement.style.display);
                console.log('Login screen opacity:', loginScreenElement.style.opacity);
            } else {
                console.error('Loading or Login screen element not found:', { loadingScreenElement, loginScreenElement });
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

// Fungsi encode email
function encodeEmail(email) {
  return email.replace('@', '_at_').replace('.', '_dot_');
}

// Fungsi copy ke clipboard
function copyToClipboard(text, button) {
  navigator.clipboard.writeText(text).then(() => {
    button.textContent = 'Copied!';
    setTimeout(() => {
      button.textContent = 'Copy';
    }, 2000);
  }).catch(err => {
    console.error('Gagal copy: ', err);
  });
}

// Tunggu DOM siap
document.addEventListener('DOMContentLoaded', () => {
  // Tab Switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      tabContents.forEach(content => content.classList.remove('active'));
      tabButtons.forEach(btn => btn.classList.remove('active'));
      const tabId = button.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
      button.classList.add('active');
    });
  });
  document.querySelector('[data-tab="finance"]').click();

  // Fitur Deposit
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

  // Logging untuk debug
  console.log('Elemen deposit:', {
    realDepositBtn,
    realDepositMsg,
    depositAmountInput,
    depositPopup,
    popupAmount,
    popupMemo,
    popupUsername,
    popupTransferAmount,
    popupTransferMemo,
    popupWalletAddress,
    countdownTimer,
    copyWalletBtn,
    copyMemoBtn,
    confirmDepositBtn,
    cancelDepositBtn
  });

  // Pengecekan elemen
  if (!realDepositBtn || !realDepositMsg || !depositAmountInput || !depositPopup || !popupAmount || !popupMemo || !popupUsername || !popupTransferAmount || !popupTransferMemo || !popupWalletAddress || !countdownTimer || !copyWalletBtn || !copyMemoBtn || !confirmDepositBtn || !cancelDepositBtn) {
    console.error('Salah satu elemen tidak ditemukan. Cek ID di HTML.');
    return;
  }

  // Setup Deposit Request
  let countdownInterval = null;
  const countdownDuration = 100; // 100 detik countdown

  realDepositBtn.addEventListener('click', async () => {
    console.log('Tombol deposit diklik');

    const user = auth.currentUser;
    if (!user) {
        realDepositMsg.textContent = 'Please login first.';
        console.log('Validasi gagal: User belum login');
        return;
    }

    // Ambil username dari database berdasarkan email
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
        realDepositMsg.textContent = 'Username not found. Please register.';
        console.log('Validasi gagal: Username ga ketemu');
        return;
    }

    const amount = parseFloat(depositAmountInput.value);
    if (!amount || amount < 1) {
        realDepositMsg.textContent = 'Minimum deposit is 1 PI.';
        console.log('Validasi gagal: Amount < 1');
        return;
    }

    // Cek limit deposit harian
    const today = new Date().toISOString().split('T')[0];
    const depositLimitRef = ref(database, `depositLimits/${encodedEmail}/${today}`);
    const depositSnapshot = await get(depositLimitRef);
    const depositData = depositSnapshot.val();
    let dailyTotal = depositData ? depositData.total : 0;

    if (dailyTotal + amount > 1000) {
        realDepositMsg.textContent = 'Daily deposit limit exceeded (1000 PI).';
        console.log('Validasi gagal: Melebihi limit harian');
        return;
    }

    realDepositMsg.textContent = '';
    realDepositBtn.disabled = true;
    depositAmountInput.disabled = true;

    const walletAddress = 'GCUPGJNSX6GQDI7MTNBVES6LHDCTP3QHZHPWJG4BKBQVG4L2CW6ZULPN';
    const memo = `deposit_${username}_${Date.now()}`;

    // Tampilkan popup
    popupAmount.textContent = amount;
    popupMemo.textContent = memo;
    popupUsername.textContent = username;
    popupTransferAmount.textContent = amount;
    popupTransferMemo.textContent = memo;
    popupWalletAddress.textContent = walletAddress;
    depositPopup.style.display = 'block';

    // Mulai countdown
    let timeLeft = countdownDuration;
    countdownTimer.textContent = `Time left: ${timeLeft}s`;
    countdownInterval = setInterval(() => {
        timeLeft--;
        countdownTimer.textContent = `Time left: ${timeLeft}s`;
        if (timeLeft <= 0) {
            clearInterval(countdownInterval);
            depositPopup.style.display = 'none';
            realDepositBtn.disabled = false;
            depositAmountInput.disabled = false;
            realDepositMsg.textContent = 'Deposit request timed out.';
        }
    }, 1000);

    // Copy Wallet Address
    copyWalletBtn.addEventListener('click', () => {
        copyToClipboard(walletAddress, copyWalletBtn);
    });

    // Copy Memo
    copyMemoBtn.addEventListener('click', () => {
        copyToClipboard(memo, copyMemoBtn);
    });

    // Confirm Deposit
    confirmDepositBtn.addEventListener('click', async () => {
        clearInterval(countdownInterval);
        depositPopup.style.display = 'none';

        try {
            const playerRef = ref(database, `players/${username}`);
            const snapshot = await get(playerRef);
            let totalDeposit; // Deklarasikan di sini

            if (!snapshot.exists()) {
                console.log('Player data not found, creating new entry');
                await set(playerRef, { totalDeposit: amount, piBalance: 0, farmCoins: 0 });
                totalDeposit = amount;
            } else {
                const playerData = snapshot.val();
                totalDeposit = playerData.totalDeposit || 0;
            }

            totalDeposit += amount;
            dailyTotal += amount;

            await update(playerRef, { totalDeposit });
            await set(depositLimitRef, { total: dailyTotal });

            const depositHistoryRef = ref(database, `depositHistory/${encodedEmail}`);
            await push(depositHistoryRef, {
                amount,
                timestamp: Date.now(),
                memo,
                status: 'pending'
            });

            realDepositMsg.textContent = 'Deposit request submitted. Awaiting confirmation...';
            console.log('Deposit request submitted:', { amount, memo });
        } catch (error) {
            console.error('Error submitting deposit:', error.message);
            realDepositMsg.textContent = 'Error submitting deposit: ' + error.message;
        } finally {
            realDepositBtn.disabled = false;
            depositAmountInput.disabled = false;
            depositAmountInput.value = '';
        }
    });

    // Cancel Deposit
    cancelDepositBtn.addEventListener('click', () => {
        clearInterval(countdownInterval);
        depositPopup.style.display = 'none';
        realDepositBtn.disabled = false;
        depositAmountInput.disabled = false;
        realDepositMsg.textContent = 'Deposit request cancelled.';
    });
});

  // Fitur Withdraw
  const withdrawBtn = document.getElementById("withdraw-btn");
  const withdrawAmountInput = document.getElementById("withdraw-amount");
  const withdrawMsg = document.getElementById("withdraw-msg");
  const withdrawPopup = document.getElementById("withdraw-popup");
  const withdrawPopupAmount = document.getElementById("withdraw-popup-amount");
  const withdrawPopupUsername = document.getElementById("withdraw-popup-username"); // Perbaiki typo
  const withdrawPopupWallet = document.getElementById("withdraw-popup-wallet");
  const withdrawWalletInput = document.getElementById("withdraw-wallet-input");
  const withdrawCountdownTimer = document.getElementById("withdraw-countdown-timer");
  const confirmWithdrawBtn = document.getElementById("confirm-withdraw");
  const cancelWithdrawBtn = document.getElementById("cancel-withdraw");

  console.log('Elemen withdraw:', {
    withdrawBtn,
    withdrawAmountInput,
    withdrawMsg,
    withdrawPopup,
    withdrawPopupAmount,
    withdrawPopupUsername, // Perbaiki typo di log
    withdrawPopupWallet,
    withdrawWalletInput,
    withdrawCountdownTimer,
    confirmWithdrawBtn,
    cancelWithdrawBtn
  });

  if (!withdrawBtn || !withdrawAmountInput || !withdrawMsg || !withdrawPopup || !withdrawPopupAmount || !withdrawPopupUsername || !withdrawPopupWallet || !withdrawWalletInput || !withdrawCountdownTimer || !confirmWithdrawBtn || !cancelWithdrawBtn) {
    console.error('Salah satu elemen withdraw tidak ditemukan. Cek ID di HTML.');
    return;
  }

  let withdrawCountdownInterval = null;
  const withdrawCountdownDuration = 100; // 100 detik countdown

  withdrawBtn.addEventListener('click', async () => {
    console.log('Tombol withdraw diklik');

    const user = auth.currentUser;
    if (!user) {
      withdrawMsg.textContent = 'Please login first.';
      console.log('Validasi gagal: User belum login');
      return;
    }

    // Ambil username dari database berdasarkan email
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
      console.log('Validasi gagal: Username ga ketemu');
      return;
    }

    const amount = parseFloat(withdrawAmountInput.value);
    if (!amount || amount < 1) {
      withdrawMsg.textContent = 'Minimum withdraw is 1 PI.';
      console.log('Validasi gagal: Amount < 1');
      return;
    }

    const playerRef = ref(database, `players/${username}`);
    const playerSnapshot = await get(playerRef);
    if (!playerSnapshot.exists()) {
      withdrawMsg.textContent = 'Player data not found.';
      console.log('Validasi gagal: Player data ga ketemu');
      return;
    }
    const playerData = playerSnapshot.val();
    const piBalance = playerData.piBalance || 0;

    if (amount > piBalance) {
      withdrawMsg.textContent = 'Insufficient PI balance.';
      console.log('Validasi gagal: Saldo tidak cukup');
      return;
    }

    const walletAddress = withdrawWalletInput.value.trim();
    if (!walletAddress) {
      withdrawMsg.textContent = 'Please enter a valid wallet address.';
      console.log('Validasi gagal: Wallet address kosong');
      return;
    }

    withdrawMsg.textContent = '';
    withdrawBtn.disabled = true;
    withdrawAmountInput.disabled = true;
    withdrawWalletInput.disabled = true;

    // Tampilkan popup
    withdrawPopupAmount.textContent = amount;
    withdrawPopupUsername.textContent = username;
    withdrawPopupWallet.textContent = walletAddress;
    withdrawPopup.style.display = 'block';

    // Mulai countdown
    let timeLeft = withdrawCountdownDuration;
    withdrawCountdownTimer.textContent = `Time left: ${timeLeft}s`;
    withdrawCountdownInterval = setInterval(() => {
      timeLeft--;
      withdrawCountdownTimer.textContent = `Time left: ${timeLeft}s`;
      if (timeLeft <= 0) {
        clearInterval(withdrawCountdownInterval);
        withdrawPopup.style.display = 'none';
        withdrawBtn.disabled = false;
        withdrawAmountInput.disabled = false;
        withdrawWalletInput.disabled = false;
        withdrawMsg.textContent = 'Withdraw request timed out.';
      }
    }, 1000);

    // Confirm Withdraw
    confirmWithdrawBtn.addEventListener('click', async () => {
      clearInterval(withdrawCountdownInterval);
      withdrawPopup.style.display = 'none';

      try {
        const updatedPiBalance = piBalance - amount;
        await update(playerRef, { piBalance: updatedPiBalance });

        const encodedEmail = encodeEmail(user.email);
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
        withdrawBtn.disabled = false;
        withdrawAmountInput.disabled = false;
        withdrawWalletInput.disabled = false;
        withdrawAmountInput.value = '';
        withdrawWalletInput.value = '';
      }
    });

    // Cancel Withdraw
    cancelWithdrawBtn.addEventListener('click', () => {
      clearInterval(withdrawCountdownInterval);
      withdrawPopup.style.display = 'none';
      withdrawBtn.disabled = false;
      withdrawAmountInput.disabled = false;
      withdrawWalletInput.disabled = false;
      withdrawMsg.textContent = 'Withdraw request cancelled.';
    });
});

  // Load user balances
  auth.onAuthStateChanged(user => {
    if (user) {
      username = user.displayName || user.email; // Ganti jadi displayName atau email sebagai fallback
      localStorage.setItem('username', username);
      loadUserBalances();
    }
  });
});

// Handle referral link from URL
function handleReferral() {
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
          .catch(err => {
            console.error('Error updating referral earnings:', err);
          });
      }
    }).catch(err => {
      console.error('Error fetching referrer data:', err);
    });
  }
}

// Check referral on load
document.addEventListener('DOMContentLoaded', () => {
  const storedUsername = localStorage.getItem('username');
  if (storedUsername) {
    username = storedUsername;
    loadPlayerData();
    updateReferralLink();
    handleReferral();
  }
});
