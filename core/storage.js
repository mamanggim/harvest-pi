import { ref, onValue } from '/firebase/firebase-config.js';
import { updateWallet } from '/ui/tab-switcher.js';
import { getUsername } from './global-state.js'; // getter modular (nanti kita buat juga)

export function loadUserBalances() {
  const username = getUsername(); // ambil dari global getter
  if (!username) return;

  const playerRef = ref(database, `players/${username}`);
  onValue(playerRef, (snapshot) => {
    const data = snapshot.val() || {};
    const piBalance = data.piBalance || 0;
    const farmCoins = data.farmCoins || 0;

    // Update elemen UI
    const piBalanceElement = document.getElementById('pi-balance');
    const fcBalanceElement = document.getElementById('fc-balance');
    if (piBalanceElement) piBalanceElement.textContent = piBalance.toLocaleString(undefined, { maximumFractionDigits: 6 });
    if (fcBalanceElement) fcBalanceElement.textContent = farmCoins.toLocaleString();

    // Update ke global state
    setFarmCoins(farmCoins);
    setPiBalance(piBalance);

    updateWallet(); // update tampilan
  });
}
