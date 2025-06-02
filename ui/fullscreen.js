import { playMenuSound } from '/core/audio.js';
import { enterFullScreen, exitFullScreen } from './fullscreen-util.js'; // atau core/fullscreen-util.js kalau kamu pecah

export function showSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'block';
    playMenuSound();
  }
}

export function hideSettings() {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.style.display = 'none';
    playMenuSound();
  }
}

export function toggleFullScreen() {
  if (!document.fullscreenElement) {
    enterFullScreen();
  } else {
    exitFullScreen();
  }
  playMenuSound();
}
