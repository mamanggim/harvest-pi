const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendDepositNotification = functions.database.ref('/deposits/{depositId}')
  .onCreate((snapshot, context) => {
    const deposit = snapshot.val();
    if (deposit.status === 'pending') {
      const payload = {
        notification: {
          title: 'New Deposit Request',
          body: `User: ${deposit.userId}, Amount: ${deposit.amount} PI`
        },
        data: {
          userId: deposit.userId,
          amount: deposit.amount,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      };

      // Ambil semua token admin dari database
      return admin.database().ref('adminTokens').once('value').then((snapshot) => {
        const tokens = snapshot.val();
        if (tokens) {
          const tokenArray = Object.values(tokens);
          return admin.messaging().sendMulticast({
            tokens: tokenArray,
            notification: payload.notification,
            data: payload.data
          }).then((response) => {
            console.log('Notif sent to:', response.successCount, 'devices');
            return null;
          }).catch((error) => {
            console.log('Error sending notif:', error);
            return null;
          });
        }
        return null;
      });
    }
    return null;
  });
