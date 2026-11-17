import * as webpush from 'web-push';

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '';
const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:admin@pocketlog.app';

if (vapidPublicKey && vapidPrivateKey) {
  try {
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  } catch (err) {
    console.warn('Could not set VAPID details in webPush:', err);
  }
}

export { webpush };
export const sendNotification = webpush.sendNotification;
export const setVapidDetails = webpush.setVapidDetails;
