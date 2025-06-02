import { playMenuSound } from '/core/audio.js';

// === Tampilan Modal Settings ===
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

// === Toggle Fullscreen ===
export function toggleFullScreen() {
  if (!document.fullscreenElement) {
    enterFullScreen();
  } else {
    exitFullScreen();
  }
  playMenuSound();
}

// === Masuk Fullscreen ===
export function enterFullScreen() {
  const elem = document.documentElement;
  if (elem.requestFullscreen) {
    elem.requestFullscreen();
  } else if (elem.mozRequestFullScreen) { // Firefox
    elem.mozRequestFullScreen();
  } else if (elem.webkitRequestFullscreen) { // Chrome, Safari, Opera
    elem.webkitRequestFullscreen();
  } else if (elem.msRequestFullscreen) { // IE/Edge
    elem.msRequestFullscreen();
  }
}

// === Keluar Fullscreen ===
export function exitFullScreen() {
  if (document.exitFullscreen) {
    document.exitFullscreen();
  } else if (document.mozCancelFullScreen) { // Firefox
    document.mozCancelFullScreen();
  } else if (document.webkitExitFullscreen) { // Chrome, Safari, Opera
    document.webkitExitFullscreen();
  } else if (document.msExitFullscreen) { // IE/Edge
    document.msExitFullscreen();
  }
}
