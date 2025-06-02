import { initAudioControls, updateVolumes } from '/ui/volume-control.js';
import { loadData } from '/core/loader.js';
import { switchToLogin } from '/auth/session.js'; // bukan login.js, karena ini logic UI session
import { setupGlobalEventHandlers } from '/ui/event-bindings.js'; // kamu bikin nanti
import { setupStartGameHandler } from '/ui/start-handler.js';
setupStartGameHandler();

async function initializeGame() {
  try {
    initAudioControls();
    updateVolumes();
    await loadData();
    switchToLogin(); // tampilkan login screen default
  } catch (e) {
    console.error('Init error:', e.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initializeGame();
  setupGlobalEventHandlers(); // misalnya: tab switch, tombol setting, dll
});

import { initializeGame } from '/core/init.js';
import { updateVolumes } from '/ui/volume-control.js';
import { loadExchangeRate } from '/features/exchange.js';

document.addEventListener('DOMContentLoaded', () => {
  initializeGame();
  loadExchangeRate();
  updateVolumes();
});
