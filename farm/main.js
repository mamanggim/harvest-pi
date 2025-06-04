import { initializeGame } from '/core/init.js'; // ini versi final yang udah terintegrasi semua
import { updateVolumes, initAudioControls } from '/ui/volume-control.js';
import { loadExchangeRate } from '/features/exchange.js';
import { setupGlobalEventHandlers } from '/ui/event-bindings.js';
import { setupStartGameHandler } from '/ui/start-handler.js';
import { setupLoginHandler } from '/ui/login-handler.js';
import { setupLogin } from '/auth/login.js';

document.addEventListener('DOMContentLoaded', () => {
  // ...
  setupLoginHandler(); // ← Tambahkan ini
});

document.addEventListener('DOMContentLoaded', () => {
  initAudioControls();
  updateVolumes();
  initializeGame();
  loadExchangeRate();
  setupGlobalEventHandlers();
  setupStartGameHandler();
});
