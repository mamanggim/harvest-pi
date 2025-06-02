import { ref, onValue, update } from '/firebase/firebase-config.js';
import { showNotification } from '/ui/notification.js';

export function setupRealtimeNotifications(username) {
  if (!username) return;

  const notifRef = ref(database, `notifications/${username}`);
  onValue(notifRef, (snapshot) => {
    const notifications = snapshot.val();
    if (notifications) {
      Object.entries(notifications).forEach(([id, notif]) => {
        if (!notif.read) {
          showNotification(notif.message);
          update(ref(database, `notifications/${username}/${id}`), { read: true });
        }
      });
    }
  });
}
