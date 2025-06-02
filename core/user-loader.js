import { ref, onValue } from '/firebase/firebase-config.js';
import { updateWallet } from '/ui/tab-switcher.js';
import { getUsername, setFarmCoins, setPiBalance } from './global-state.js';

export function loadUserBalances() {
  const username = getUsername();
  if (!username) return;

  const playerRef = ref(database, `players/${username}`);
  onValue(playerRef, (snapshot) => {
    const data = snapshot.val() || {};
    setFarmCoins(data.farmCoins || 0);
    setPiBalance(data.piBalance || 0);
    updateWallet();
  });
}
