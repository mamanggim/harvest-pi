import { addSafeClickListener } from '/core/helpers.js';
import { startGame, toggleLanguage } from './language.js';
import { showSettings, hideSettings } from './fullscreen.js';
import { playMenuSound } from '/core/audio.js';
import { handleExchange, updateExchangeResult } from '/features/exchange.js';
import { switchTab, updateWallet } from './tab-switcher.js';
import { renderShop } from '/features/shop.js';
import { renderSellSection } from '/features/sell.js';
import { updateVolumes } from './volume-control.js'; // Tambahan: supaya slider langsung berefek

export function setupGlobalEventHandlers() {
  const elementsWithHandlers = [
    { id: 'start-text', handler: startGame },
    { id: 'lang-toggle', handler: toggleLanguage },
    { id: 'game-lang-toggle', handler: toggleLanguage },
    { id: 'settings-btn', handler: showSettings },
    { id: 'game-settings-btn', handler: showSettings },
    { id: 'close-settings', handler: hideSettings },
    {
      id: 'reward-modal-close',
      handler: () => {
        const rewardModal = document.getElementById('reward-modal');
        if (rewardModal) rewardModal.style.display = 'none';
        playMenuSound();
      }
    },
    {
      id: 'fullscreen-toggle',
      handler: () => {
        document.fullscreenElement
          ? document.exitFullscreen()
          : document.documentElement.requestFullscreen();
        playMenuSound();
      }
    },
    {
      id: 'exit-game-btn',
      handler: () => {
        const bgMusic = document.getElementById('bg-music');
        const bgVoice = document.getElementById('bg-voice');
        if (bgMusic) bgMusic.pause();
        if (bgVoice) bgVoice.pause();
        window.location.reload(); // bisa diganti confirm dulu kalau mau
      }
    },
    { id: 'exchange-btn', handler: handleExchange },

    // Login/Register handled in their own modules
    // { id: 'login-email-btn', handler: () => {} },
    // { id: 'register-email-btn', handler: () => {} },
  ];

  elementsWithHandlers.forEach(({ id, handler }) => {
    const el = document.getElementById(id);
    if (el) addSafeClickListener(el, handler);
  });

  // Volume sliders
  const musicSlider = document.getElementById('music-volume');
  if (musicSlider) {
    musicSlider.value = localStorage.getItem('musicVolume') || 50;
    musicSlider.addEventListener('input', () => {
      localStorage.setItem('musicVolume', musicSlider.value);
      updateVolumes(); // update volume live
    });
  }

  const voiceSlider = document.getElementById('voice-volume');
  if (voiceSlider) {
    voiceSlider.value = localStorage.getItem('voiceVolume') || 50;
    voiceSlider.addEventListener('input', () => {
      localStorage.setItem('voiceVolume', voiceSlider.value);
      updateVolumes(); // update volume live
    });
  }

  // Exchange input
  const exchangeInput = document.getElementById('exchange-amount');
  if (exchangeInput) exchangeInput.addEventListener('input', updateExchangeResult);

  const directionSelect = document.getElementById('exchange-direction');
  if (directionSelect) directionSelect.addEventListener('change', updateExchangeResult);

  // Tab switching
  const tabButtons = document.querySelectorAll('.tab-btn');
  tabButtons.forEach(btn => {
    addSafeClickListener(btn, () => {
      const tab = btn.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Shop tab buy/sell toggle
  const buyTab = document.getElementById('shop-buy-tab');
  const sellTab = document.getElementById('shop-sell-tab');
  const shopContent = document.getElementById('shop-content');
  const sellSection = document.getElementById('sell-section');

  if (buyTab) {
    addSafeClickListener(buyTab, () => {
      buyTab.classList.add('active');
      sellTab?.classList.remove('active');
      if (shopContent) shopContent.style.display = 'block';
      if (sellSection) sellSection.style.display = 'none';
      renderShop();
      playMenuSound();
    });
  }

  if (sellTab) {
    addSafeClickListener(sellTab, () => {
      sellTab.classList.add('active');
      buyTab?.classList.remove('active');
      if (shopContent) shopContent.style.display = 'none';
      if (sellSection) sellSection.style.display = 'block';
      renderSellSection();
      playMenuSound();
    });
  }
}
