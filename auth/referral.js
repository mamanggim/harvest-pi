export function generateReferralLink(username) {
  return `https://www.harvestpi.biz.id/?ref=${username}`;
}

import { showNotification } from '/ui/notification.js';
import { copyToClipboard } from '/core/utils.js';

export function initReferralHandler() {
  const copyBtn = document.getElementById('copy-link-btn');
  const linkEl = document.getElementById('referral-link');

  if (!copyBtn || !linkEl) return;

  copyBtn.addEventListener('click', () => {
    if (linkEl.textContent) {
      copyToClipboard(linkEl.textContent);
      showNotification('Referral link copied!');
    } else {
      console.error('Referral link empty or missing');
    }
  });
}
