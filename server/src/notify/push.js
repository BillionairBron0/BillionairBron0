import { Expo } from 'expo-server-sdk';

const expo = new Expo();
const subscribers = new Set();

export function addPushToken(token) { if (Expo.isExpoPushToken(token)) subscribers.add(token); }
export async function broadcastActionable(event) {
  const messages = Array.from(subscribers).map(to => ({ to, sound:'default', title:`${event.side} Signal`, body:`${event.symbol||''} @ ${event.price}` }));
  const chunks = expo.chunkPushNotifications(messages);
  for (const c of chunks) { try { await expo.sendPushNotificationsAsync(c); } catch(e){ /* log */ } }
}