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
          body: `User: ${deposit.username}, Amount: ${deposit.amount} PI`
        },
        data: {
          username: deposit.username,
          amount: deposit.amount,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        }
      };

      console.log('New deposit request:', deposit);

      return admin.database().ref('adminTokens').once('value').then((snapshot) => {
        const tokens = snapshot.val();
        if (tokens) {
          const tokenArray = Object.values(tokens);
          console.log('Sending to tokens:', tokenArray);
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
        console.log('No admin tokens found');
        return null;
      });
    }
    return null;
  });
