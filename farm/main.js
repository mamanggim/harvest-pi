// Import Firebase dari firebase-config.js
import { database } from '../firebase/firebase-config.js';
import { ref, onValue, set, update, get } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';

// Elemen global
const rewardModal = document.getElementById('reward-modal');
const claimModalBtn = document.getElementById('claim-modal-btn');

// Helper: Tambah event listener aman
function addSafeClickListener(element, callback) {
    if (!element) return;
    element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        callback();
    });
}

// Spinner loading (durasi 3 detik)
function showLoadingSpinner(duration = 3000, callback) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) {
        spinner.style.display = 'block';
        setTimeout(() => {
            spinner.style.display = 'none';
            if (callback) callback();
        }, duration);
    } else if (callback) {
        callback();
    }
}

// Contoh penggunaan saat login
function authenticateWithPi() {
    showLoadingSpinner(3000, () => {
        // Lanjutkan proses login di sini...
        startGame();
    });
}

// Elemen UI
const loginScreen = document.getElementById('login-screen');
const startScreen = document.getElementById('start-screen');
const gameScreen = document.getElementById('game-screen');
const loginBtn = document.getElementById('login-btn');

// Navigasi antar layar
function showScreen(screen) {
    loginScreen.style.display = 'none';
    startScreen.style.display = 'none';
    gameScreen.style.display = 'none';
    screen.style.display = 'block';
}

// Saat pertama kali buka, tampilkan loading 3 detik, lalu ke login
window.addEventListener('load', () => {
    showLoadingSpinner(3000, () => {
        showScreen(loginScreen);
    });
});

// Simulasi login dengan Pi Network
addSafeClickListener(loginBtn, () => {
    authenticateWithPi();
});

// Setelah login sukses
function startGame() {
    showScreen(startScreen);
    setupStartButtons();
}

// Data tanaman
let vegetableData = {};
let plantedPlots = [];
let coins = 0;

// Ambil data tanaman dari JSON
fetch('data/vegetables.json')
    .then(res => res.json())
    .then(data => {
        vegetableData = data;
        console.log("Data tanaman dimuat:", vegetableData);
    });

// Inisialisasi ladang
const fieldContainer = document.getElementById('field');
const plotCount = 6;

function createPlots() {
    for (let i = 0; i < plotCount; i++) {
        const plot = document.createElement('div');
        plot.classList.add('plot');
        plot.dataset.index = i;
        plot.addEventListener('click', onPlotClick);
        fieldContainer.appendChild(plot);
        plantedPlots.push(null);
    }
}

// Event klik pada petak
function onPlotClick(e) {
    const index = e.currentTarget.dataset.index;
    if (selectedSeed) {
        plantSeed(index, selectedSeed);
    } else {
        harvestPlant(index);
    }
}

let selectedSeed = null;

function selectSeed(name) {
    if (vegetableData[name]) {
        selectedSeed = name;
        console.log("Bibit dipilih:", name);
    }
}

function plantSeed(index, seedName) {
    if (plantedPlots[index]) return;

    const plantData = {
        name: seedName,
        plantedAt: Date.now(),
        growthTime: vegetableData[seedName].growTime,
        element: fieldContainer.children[index]
    };

    plantedPlots[index] = plantData;
    updatePlotVisual(index);
    setTimeout(() => {
        updatePlotVisual(index);
    }, plantData.growthTime);
}

function updatePlotVisual(index) {
    const plot = fieldContainer.children[index];
    const plant = plantedPlots[index];

    plot.innerHTML = '';
    if (plant) {
        const img = document.createElement('img');
        const isGrown = Date.now() - plant.plantedAt >= plant.growthTime;
        img.src = isGrown ? vegetableData[plant.name].imgHarvest : vegetableData[plant.name].imgSeed;
        plot.appendChild(img);
        plot.classList.toggle('ready', isGrown);
    }
}

function harvestPlant(index) {
    const plant = plantedPlots[index];
    if (!plant) return;

    const isGrown = Date.now() - plant.plantedAt >= plant.growthTime;
    if (!isGrown) return;

    coins += vegetableData[plant.name].price;
    plantedPlots[index] = null;
    updatePlotVisual(index);
    updateUI();
}

const coinDisplay = document.getElementById('coin-display');
const startBtn = document.getElementById('start-btn');

function updateUI() {
    coinDisplay.textContent = coins;
}

function setupStartButtons() {
    startBtn.addEventListener('click', () => {
        showScreen(gameScreen);
        createPlots();
        updateUI();
    });
}

// Tampilkan spinner saat loading screen dan login
function showLoading(duration = 3000) {
    const loading = document.getElementById('loading');
    loading.innerHTML = `<div class="spinner"></div>`;
    showScreen(loading);
    setTimeout(() => {
        showScreen(loginScreen);
    }, duration);
}

function simulateLoginWithPi() {
    const piLoginBtn = document.getElementById('pi-login');
    piLoginBtn.addEventListener('click', () => {
        showLoading(3000);
        setTimeout(() => {
            showScreen(startScreen);
        }, 6000); // total 3 detik loading, 3 detik setelah klik
    });
}

// Fungsi inisialisasi saat halaman dimuat
window.addEventListener('DOMContentLoaded', () => {
    showLoading(3000);
    simulateLoginWithPi();
    setupStartButtons();
    setupSeedButtons();
});

// Tampilkan layar tertentu
function showScreen(screen) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

// Siapkan tombol-tombol bibit
function setupSeedButtons() {
    const seedButtons = document.querySelectorAll('.seed-btn');
    seedButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const seedName = btn.dataset.seed;
            selectSeed(seedName);
        });
    });
}
