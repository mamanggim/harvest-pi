export const encodeEmail = (email) =>
  email.replace('@', '_at_').replace(/\./g, '_dot_');

export const resolveUserKey = (role, email, username) =>
  role === 'admin' ? encodeEmail(email) : username;

import { showNotification } from '/ui/notification.js';

export function copyToClipboard(text, button = null) {
  navigator.clipboard.writeText(text).then(() => {
    if (button) {
      const originalText = button.textContent;
      button.textContent = 'Copied!';
      setTimeout(() => { button.textContent = originalText; }, 1000);
    }
    showNotification('Copied to clipboard!');
  }).catch(err => {
    console.error('Copy failed:', err);
    showNotification('Copy failed.');
  });
}
