import { showNotification } from '/ui/notification.js';

/**
 * Encode email agar bisa dijadikan key Firebase
 */
function encodeEmail(email) {
  return email.replace('@', '_at_').replace('.', '_dot_'); // ✅ cocok dengan Firebase rules
}

/**
 * Tentukan userKey berdasarkan role
 */
function resolveUserKey(role, email, username) {
  return role === 'admin' ? encodeEmail(email) : username;
}

/**
 * Salin teks ke clipboard, dengan efek tombol & notifikasi
 */
function copyToClipboard(text, button = null) {
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

export {
  encodeEmail,
  resolveUserKey,
  copyToClipboard
};
