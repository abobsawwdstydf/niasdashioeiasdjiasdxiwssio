const webPush = require('web-push');

// VAPID keys - generate once with: webPush.generateVAPIDKeys()
const vapidKeys = {
  publicKey: 'BPVXBg4HHqwRgo2rX4fnScnnL1bD0AgeSyAiufQluXGctTM0WsSD8VqJx5DUsUsev4uP1pCH42qRGFg8PsrbDd0',
  privateKey: 'fykh4MzH9dDTD_xK2oTzJG7KIzzmnedIY7I7zs6W9d4'
};

// Initialize web-push with VAPID keys
webPush.setVapidDetails(
  'mailto:support@nexo.app',
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Store subscriptions in memory (use database in production)
const pushSubscriptions = new Map();

// Save subscription
function saveSubscription(userId, subscription) {
  pushSubscriptions.set(userId, subscription);
  console.log(`[Web Push] Subscription saved for user ${userId}`);
}

// Get subscription
function getSubscription(userId) {
  return pushSubscriptions.get(userId);
}

// Remove subscription
function removeSubscription(userId) {
  pushSubscriptions.delete(userId);
}

// Send push notification
async function sendPushNotification(userId, subscription, notification) {
  try {
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/logo.png',
      badge: notification.badge || '/badge.png',
      data: notification.data,
      actions: notification.actions || [
        { action: 'open', title: 'Открыть' }
      ],
      vibrate: [200, 100, 200],
      requireInteraction: true
    });

    await webPush.sendNotification(subscription, payload);
    console.log(`[Web Push] Notification sent to user ${userId}`);
    return true;
  } catch (error) {
    console.error(`[Web Push] Failed to send to user ${userId}:`, error.message);
    
    // Remove invalid subscription
    if (error.statusCode === 404 || error.statusCode === 410) {
      removeSubscription(userId);
    }
    
    return false;
  }
}

// Send call notification
async function sendCallNotification(userId, subscription, callerInfo, callType) {
  const notification = {
    title: callType === 'video' ? '📹 Видеозвонок' : '📞 Звуковой звонок',
    body: callerInfo.displayName || callerInfo.username || 'Входящий звонок',
    data: {
      type: 'incoming_call',
      callerId: callerInfo.id,
      callType,
      timestamp: Date.now()
    },
    actions: [
      { action: 'accept', title: 'Ответить', icon: '/icons/accept.png' },
      { action: 'decline', title: 'Отклонить', icon: '/icons/decline.png' }
    ]
  };

  return await sendPushNotification(userId, subscription, notification);
}

// Send message notification
async function sendMessageNotification(userId, subscription, messageInfo) {
  const notification = {
    title: messageInfo.chatName || 'Новое сообщение',
    body: messageInfo.content || 'У вас новое сообщение',
    data: {
      type: 'new_message',
      chatId: messageInfo.chatId,
      messageId: messageInfo.id,
      senderId: messageInfo.senderId
    },
    actions: [
      { action: 'reply', title: 'Ответить', icon: '/icons/reply.png' },
      { action: 'open', title: 'Открыть', icon: '/icons/open.png' }
    ]
  };

  return await sendPushNotification(userId, subscription, notification);
}

// Send friend request notification
async function sendFriendRequestNotification(userId, subscription, requesterInfo) {
  const notification = {
    title: '👋 Запрос в друзья',
    body: requesterInfo.displayName || requesterInfo.username,
    data: {
      type: 'friend_request',
      requesterId: requesterInfo.id,
      requesterUsername: requesterInfo.username
    },
    actions: [
      { action: 'accept', title: 'Принять', icon: '/icons/accept.png' },
      { action: 'decline', title: 'Отклонить', icon: '/icons/decline.png' }
    ]
  };

  return await sendPushNotification(userId, subscription, notification);
}

module.exports = {
  vapidKeys,
  saveSubscription,
  getSubscription,
  removeSubscription,
  sendPushNotification,
  sendCallNotification,
  sendMessageNotification,
  sendFriendRequestNotification
};
