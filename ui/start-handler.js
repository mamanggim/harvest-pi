import { addSafeClickListener } from '/core/utils.js';
import { playBgMusic, playBgVoice } from '/core/audio.js';
import { showNotification } from '/ui/notification.js';
import { switchTab } from '/ui/tab-switcher.js';
import { enterFullScreen } from '/ui/fullscreen.js';
import { getUsername, getIsDataLoaded, setIsAudioPlaying } from '/core/global-state.js';

export function setupStartGameHandler() {
  const startTextElement = document.getElementById('start-text');
  if (!startTextElement) return;

  addSafeClickListener(startTextElement, () => {
    const isDataLoaded = getIsDataLoaded();
    const username = getUsername();

    console.log('Start Text clicked, isDataLoaded:', isDataLoaded, 'username:', username);

    if (isDataLoaded && username) {
      showNotification('Game started!');
      const startScreenElement = document.getElementById('start-screen');
      const gameScreenElement = document.getElementById('game-screen');

      if (startScreenElement && gameScreenElement) {
        startScreenElement.style.display = 'none';
        startScreenElement.classList.remove('center-screen');
        gameScreenElement.style.display = 'flex';
        gameScreenElement.classList.add('fade-in');
      } else {
        console.error('Start or Game screen element not found');
      }

      setIsAudioPlaying(false);
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
