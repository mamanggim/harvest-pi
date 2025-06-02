const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.sendDepositNotification = functions.database.ref('/deposits/{depositId}')
  .onCreate((snapshot, context) => {
    const deposit = snapshot.val();
    if (!deposit || deposit.status !== 'pending') return null;

    const payload = {
      notification: {
        title: 'New Deposit Request',
        body: `User: ${deposit.username}, Amount: ${deposit.amount} PI`
      },
      data: {
        username: deposit.username || '',
        amount: String(deposit.amount || 0),
        click_action: 'FLUTTER_NOTIFICATION_CLICK'
      }
    };

    console.log('📥 New deposit detected:', deposit);

    return admin.database().ref('adminTokens').once('value')
      .then(snapshot => {
        const tokensObj = snapshot.val();
        if (!tokensObj) {
          console.warn('⚠️ No admin tokens found');
          return null;
        }

        const tokens = Object.values(tokensObj).filter(Boolean);
        if (tokens.length === 0) {
          console.warn('⚠️ Token list is empty');
          return null;
        }

        return admin.messaging().sendMulticast({
          tokens,
          notification: payload.notification,
          data: payload.data
        }).then(response => {
          console.log(`✅ Notification sent to ${response.successCount} devices`);
          if (response.failureCount > 0) {
            response.responses.forEach((resp, idx) => {
              if (!resp.success) {
                console.error(`❌ Token ${tokens[idx]} failed:`, resp.error.message);
              }
            });
          }
          return null;
        });
      }).catch(error => {
        console.error('❌ Error sending deposit notification:', error.message);
        return null;
      });
  });
