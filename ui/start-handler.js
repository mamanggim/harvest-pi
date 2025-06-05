import { addSafeClickListener } from '/core/dom-helper.js';
import { playBgMusic, playBgVoice } from '/core/audio.js';
import { showNotification } from '/ui/notification.js';
import { switchTab } from '/ui/tab-switcher.js';
import { enterFullScreen } from '/ui/fullscreen.js';
import {
  getUsername,
  getIsDataLoaded,
  setIsAudioPlaying
} from '/core/global-state.js';

export function setupStartGameHandler() {
  const startTextElement = document.getElementById('start-text');
  if (!startTextElement) return;

  addSafeClickListener(startTextElement, () => {
    const isDataLoaded = getIsDataLoaded();
    const username = getUsername();

    if (!username) {
      showNotification('Please login first.');
      return;
    }

    if (!isDataLoaded) {
      showNotification('Please wait, loading player data...');
      return;
    }

    showNotification('Game started!');

    const startScreen = document.getElementById('start-screen');
    const gameScreen = document.getElementById('game-screen');

    if (startScreen && gameScreen) {
      startScreen.style.display = 'none';
      startScreen.classList.remove('center-screen');
      gameScreen.style.display = 'flex';
      gameScreen.classList.add('fade-in');
    } else {
      console.warn('Start screen or game screen not found');
    }

    setIsAudioPlaying(true);
    playBgMusic();
    playBgVoice();
    switchTab('farm');
    enterFullScreen();
  });
}
