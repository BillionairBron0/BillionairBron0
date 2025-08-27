import { Expo } from 'expo-server-sdk';
const pushTokens = new Set<string>();
const expo = new Expo();

export function addPushToken(token:string){ if(Expo.isExpoPushToken(token)) pushTokens.add(token); }
export async function broadcastActionable(payload:any){
	const messages = Array.from(pushTokens).map(token=>({ to:token, title:`Signal ${payload.side}`, body:`${payload.symbol||''} @ ${payload.price}`, data:payload }));
	const chunks = expo.chunkPushNotifications(messages);
	for(const chunk of chunks){ try { await expo.sendPushNotificationsAsync(chunk as any); } catch(e){ /* ignore */ } }
}
export async function sendPush(_userId:string, payload:any){ await broadcastActionable(payload); return { delivered:true }; }