import axios from 'axios';
import type { NotificationPayload } from '../types.js';

const client = axios.create({ timeout: 10000 });

export async function sendWebhook(url: string, payload: NotificationPayload): Promise<void> {
  await client.post(url, payload);
}
