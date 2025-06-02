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

export function enterFullScreen() {
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

export function exitFullScreen() {
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
