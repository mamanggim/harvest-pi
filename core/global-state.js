import { ref, update } from '/firebase/firebase-config.js';
import { updateWallet } from '../ui/tab-switcher.js'; // Ubah jika updateWallet ada di file lain
import { ref, update, database } from '/firebase/firebase-config.js';

// ========== Internal State ========== //
const state = {
  isDataLoaded: false,
  piInitialized: false,
  referralEarnings: 0,
  farmCoins: 0,
  piBalance: 0,
  water: 0,
  level: 1,
  xp: 0,
  inventory: [],
  vegetables: [],
  langData: {},
  currentLang: 'en',
  farmPlots: [],
  harvestCount: 0,
  achievements: { harvest: false, coins: false },
  username: null,
  lastClaim: null,
  claimedToday: false,
  isClaiming: false,
  isAudioPlaying: false,
};

export const plotCount = 4;
export const piToFarmRate = 1000000;

// ========== Getter / Setter Umum ========== //
export function getState() {
  return state;
}

// Data Loaded //
export function setIsDataLoaded(value) {
  state.isDataLoaded = value;
}

export function getIsDataLoaded() {
  return isDataLoaded;
}

// Langsung Getter/Setter untuk username
export function getUsername() {
  return state.username;
}
export function setUsername(name) {
  state.username = name;
}

// farmCoins
export function getFarmCoins() {
  return state.farmCoins;
}
export function setFarmCoins(value) {
  state.farmCoins = value;
  saveToFirebase('farmCoins', value);
  updateWallet();
}

// piBalance
export function getPiBalance() {
  return state.piBalance;
}
export function setPiBalance(value) {
  state.piBalance = value;
  saveToFirebase('piBalance', value);
  updateWallet();
}

// water
export function getWater() {
  return state.water;
}
export function setWater(value) {
  state.water = value;
  saveToFirebase('water', value);
  updateWallet();
}

// xp
export function getXP() {
  return state.xp;
}
export function setXP(value) {
  state.xp = value;
  saveToFirebase('xp', value);
  updateWallet();
}

// level
export function getLevel() {
  return state.level;
}
export function setLevel(value) {
  state.level = value;
  saveToFirebase('level', value);
  updateWallet();
}

// inventory
export function getInventory() {
  return state.inventory;
}
export function setInventory(items) {
  state.inventory = items;
  saveToFirebase('inventory', items);
}

// vegetables
export function getVegetables() {
  return state.vegetables;
}
export function setVegetables(data) {
  state.vegetables = data;
}

// langData
export function getLangData() {
  return state.langData;
}
export function setLangData(data) {
  state.langData = data;
}

// currentLang
export function getLang() {
  return state.currentLang;
}
export function setLang(lang) {
  state.currentLang = lang;
}

// farmPlots
export function getFarmPlots() {
  return state.farmPlots;
}
export function setFarmPlots(plots) {
  state.farmPlots = plots;
  saveToFirebase('farmPlots', plots);
}

// harvestCount
export function getHarvestCount() {
  return state.harvestCount;
}
export function setHarvestCount(count) {
  state.harvestCount = count;
  saveToFirebase('harvestCount', count);
}

// achievements
export function getAchievements() {
  return state.achievements;
}
export function setAchievements(data) {
  state.achievements = data;
  saveToFirebase('achievements', data);
}

// lastClaim
export function getLastClaim() {
  return state.lastClaim;
}
export function setLastClaim(date) {
  state.lastClaim = date;
  saveToFirebase('lastClaim', date);
}

// claimedToday
export function isClaimedToday() {
  return state.claimedToday;
}
export function setClaimedToday(val) {
  state.claimedToday = val;
  saveToFirebase('claimedToday', val);
}

// isAudioPlaying (tidak disimpan di Firebase)
export function isBgAudioPlaying() {
  return state.isAudioPlaying;
}
export function setAudioPlaying(val) {
  state.isAudioPlaying = val;
}

// isClaiming
export function isClaimingReward() {
  return state.isClaiming;
}
export function setIsClaiming(val) {
  state.isClaiming = val;
}

// ========== Firebase Updater ========== //
function saveToFirebase(field, value) {
  if (!state.username) return;
  const playerRef = ref(database, `players/${state.username}`);
  update(playerRef, { [field]: value }).catch((err) =>
    console.warn(`Failed to update ${field} in Firebase:`, err.message)
  );
}
