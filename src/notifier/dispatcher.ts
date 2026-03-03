import type { NotificationPayload } from '../types.js';
import { sendConsole } from './console.js';
import { sendWebhook } from './webhook.js';
import { sendTelegram } from './telegram.js';

export interface Dispatcher {
  dispatch(channel: { type: string; config: string }, payload: NotificationPayload): Promise<void>;
}

export function createDispatcher(config?: { telegramBotToken?: string }): Dispatcher {
  const telegramBotToken = config?.telegramBotToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '';

  return {
    async dispatch(channel, payload) {
      if (channel.type === 'CONSOLE') {
        sendConsole(payload);
        return;
      }

      if (channel.type === 'WEBHOOK') {
        const cfg = JSON.parse(channel.config || '{}');
        if (!cfg.url) return;
        await sendWebhook(cfg.url, payload);
        return;
      }

      if (channel.type === 'TELEGRAM') {
        const cfg = JSON.parse(channel.config || '{}');
        if (!cfg.chatId || !telegramBotToken) return;
        await sendTelegram(telegramBotToken, cfg.chatId, payload);
      }
    },
  };
}
