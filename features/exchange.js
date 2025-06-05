import { ref, get, onValue, update } from '/firebase/firebase-config.js';
import { getUsername, getFarmCoins, getPiBalance, setFarmCoins, setPiBalance } from '/core/global-state.js';
import { updateWallet } from '/ui/tab-switcher.js';
import { showNotification } from '/ui/notification.js';
import { playCoinSound } from '/core/audio.js';

let currentExchangeRate = 1000000;
export function loadExchangeRate() {
  const rateRef = ref(database, 'exchangeRate/liveRate');
  onValue(rateRef, (snapshot) => {
    currentExchangeRate = snapshot.val() || currentExchangeRate;
    const rateEl = document.getElementById('live-rate');
    if (rateEl) rateEl.textContent = `1 Pi = ${currentExchangeRate.toLocaleString()} FC`;
    updateExchangeResult();
  });
}

export function updateExchangeResult() {
  const rawAmount = document.getElementById('exchange-amount')?.value.replace(',', '.') || '0';
  const amount = parseFloat(rawAmount);
  const direction = document.getElementById('exchange-direction')?.value || 'piToFc';

  const result = direction === 'piToFc'
    ? Math.floor(amount * currentExchangeRate)
    : amount / currentExchangeRate;

  const resultText = direction === 'piToFc'
    ? `You will get: ${result.toLocaleString()}`
    : `You will get: ${result.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;

  const resultDiv = document.getElementById('exchange-result');
  if (resultDiv) {
    resultDiv.textContent = resultText.length > 25 ? resultText.substring(0, 25) + '…' : resultText;
    resultDiv.title = resultText;
  }
}

export async function handleExchange() {
  const username = getUsername();
  if (!username) return showNotification('Login required');

  const rawAmount = document.getElementById('exchange-amount')?.value.replace(',', '.') || '0';
  const amount = parseFloat(rawAmount);
  if (isNaN(amount) || amount <= 0) return showNotification('Invalid amount!');

  const direction = document.getElementById('exchange-direction')?.value || 'piToFc';
  const playerRef = ref(database, `players/${username}`);
  const snapshot = await get(playerRef);
  const data = snapshot.val();

  if (!data) return showNotification('Player data not found!');

  let pi = data.piBalance || 0;
  let fc = data.farmCoins || 0;

  if (direction === 'piToFc') {
    if (pi < amount) return showNotification('Not enough Pi!');
    const converted = Math.floor(amount * currentExchangeRate);
    pi -= amount;
    fc += converted;
  } else {
    if (fc < amount) return showNotification('Not enough FC!');
    const converted = amount / currentExchangeRate;
    fc -= amount;
    pi += converted;
  }

  pi = Math.round(pi * 1e6) / 1e6;
  fc = Math.floor(fc);

  document.getElementById('exchange-loading').style.display = 'block';

  try {
    await update(playerRef, { piBalance: pi, farmCoins: fc });
    setPiBalance(pi);
    setFarmCoins(fc);
    updateWallet();
    document.getElementById('exchange-amount').value = '';
    updateExchangeResult();
    try { await playCoinSound(); } catch (err) { console.warn('Sound error:', err); }
    showNotification('Exchange success!');
  } catch (err) {
    console.error('Exchange failed:', err.message);
    showNotification('Exchange failed: ' + err.message);
  } finally {
    document.getElementById('exchange-loading').style.display = 'none';
  }
}

export function initExchangeEvents() {
  const exchangeBtn = document.getElementById('exchange-btn');
  const directionSelect = document.getElementById('exchange-direction');
  const inputAmount = document.getElementById('exchange-amount');

  if (exchangeBtn) exchangeBtn.addEventListener('click', handleExchange);
  if (directionSelect) directionSelect.addEventListener('change', () => {
    exchangeBtn.textContent = directionSelect.value === 'piToFc' ? 'Exchange to FC' : 'Exchange to Pi';
    updateExchangeResult();
  });
  if (inputAmount) inputAmount.addEventListener('input', updateExchangeResult);

  directionSelect?.dispatchEvent(new Event('change'));
  updateExchangeResult();
}
