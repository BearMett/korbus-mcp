import axios from 'axios';
import type { NotificationPayload } from '../types.js';

const client = axios.create({ timeout: 10000 });

function formatMessage(payload: NotificationPayload): string {
  return (
    `Bus ${payload.routeName} → ${payload.stationName}\n` +
    `${payload.arrivalMsg} (${payload.arrivalSec}s)\n` +
    `Vehicle: ${payload.vehicleId}`
  );
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
