import { updateUIText } from '/ui/language.js'; // ✅ ini lokasi yang benar jika fungsi updateUIText ada di file language.js
import { renderShop } from '/features/shop.js';
import { renderInventory } from '/features/inventory.js';
import { renderSellSection } from '/features/sell.js';
import { renderAchievements } from '/features/achievements.js';
import { checkDailyReward } from '/features/reward.js';
import { playMenuSound } from '/core/audio.js';
import { getLang, setLang } from '/core/global-state.js';

export function toggleLanguage() {
  const current = getLang();
  const newLang = current === 'en' ? 'id' : 'en';
  setLang(newLang);
  localStorage.setItem('lang', newLang);

  updateUIText();
  renderShop();
  renderInventory();
  renderSellSection();
  renderAchievements();
  checkDailyReward();
  playMenuSound();

  const langToggle = document.getElementById('lang-toggle');
  if (langToggle) {
    langToggle.textContent = `Switch Language (${newLang === 'en' ? 'ID' : 'EN'})`;
  }
}
