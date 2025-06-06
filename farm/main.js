import { initializeGame } from '/core/init.js'; // versi final
import { updateVolumes, initAudioControls } from '/ui/volume-control.js';
import { loadExchangeRate } from '/features/exchange.js';
import { setupGlobalEventHandlers } from '/ui/event-bindings.js';
import { setupStartGameHandler } from '/ui/start-handler.js';
import { setupLoginHandler } from '/ui/login-handler.js';
import { initSessionToggle } from '/auth/session.js';

document.addEventListener('DOMContentLoaded', () => {
  initAudioControls();             // Inisialisasi slider audio
  updateVolumes();                // Set volume awal dari localStorage
  initializeGame();               // Load game data dan tampilkan login/start screen
  loadExchangeRate();            // Fetch nilai tukar Pi↔FarmCoin
  setupGlobalEventHandlers();    // Bind tombol-tombol UI
  setupStartGameHandler();       // Start game handler (klik "Start Game")
  setupLoginHandler();           // ⬅️ Penting: login / register event handler
});
