import axios from 'axios';
import type { NotificationPayload } from '../types.js';

const client = axios.create({ timeout: 10000 });

function formatMessage(payload: NotificationPayload): string {
  let msg =
    `Bus ${payload.routeName} → ${payload.stationName}\n` +
    `${payload.arrivalMsg} (${payload.arrivalSec}s)\n` +
    `Vehicle: ${payload.vehicleId}`;
  if (payload.nextArrival) {
    msg += `\nNext: ${payload.nextArrival.arrivalMsg} (${payload.nextArrival.arrivalSec}s)`;
  }
  return msg;
}

export async function sendTelegram(
  botToken: string,
  chatId: string,
  payload: NotificationPayload,
): Promise<void> {
  await client.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    chat_id: chatId,
    text: formatMessage(payload),
  });
}
