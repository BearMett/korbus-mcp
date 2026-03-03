import type { Dispatcher } from '../notifier/dispatcher.js';
import type { NotificationPayload } from '../types.js';
import { sendWebhook } from '../notifier/webhook.js';

// ---------------------------------------------------------------------------
// OpenClaw Plugin API shape (channel + system subset)
// ---------------------------------------------------------------------------

export interface OpenClawRuntimeApi {
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
  runtime: {
    system: {
      enqueueSystemEvent(event: { text: string }): void;
    };
    channel: {
      telegram: {
        sendMessageTelegram(to: string, text: string, opts?: Record<string, unknown>): Promise<{ messageId: string }>;
      };
      discord: {
        sendMessageDiscord(to: string, text: string, opts?: Record<string, unknown>): Promise<{ messageId: string }>;
      };
      slack: {
        sendMessageSlack(to: string, text: string, opts?: Record<string, unknown>): Promise<{ messageId: string }>;
      };
      signal: {
        sendMessageSignal(to: string, text: string, opts?: Record<string, unknown>): Promise<{ messageId: string }>;
      };
    };
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessage(p: NotificationPayload): string {
  return `🚌 ${p.routeName} → ${p.stationName}\n${p.arrivalMsg} (${p.arrivalSec}s)`;
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function createOpenClawDispatcher(api: OpenClawRuntimeApi): Dispatcher {
  return {
    async dispatch(channel, payload) {
      const text = formatMessage(payload);
      const cfg = channel.config ? JSON.parse(channel.config) : {};

      switch (channel.type) {
        case 'TELEGRAM':
          if (cfg.chatId) {
            await api.runtime.channel.telegram.sendMessageTelegram(cfg.chatId, text, {});
            return;
          }
          break;
        case 'DISCORD':
          if (cfg.channelId) {
            await api.runtime.channel.discord.sendMessageDiscord(cfg.channelId, text, {});
            return;
          }
          break;
        case 'SLACK':
          if (cfg.channelId) {
            await api.runtime.channel.slack.sendMessageSlack(cfg.channelId, text, {});
            return;
          }
          break;
        case 'SIGNAL':
          if (cfg.to) {
            await api.runtime.channel.signal.sendMessageSignal(cfg.to, text, {});
            return;
          }
          break;
        case 'WEBHOOK':
          if (cfg.url) {
            await sendWebhook(cfg.url, payload);
            return;
          }
          break;
        case 'CONSOLE':
          api.logger.info(`[KorBus] ${text}`);
          return;
      }

      // Fallback: no target configured → delegate to agent
      api.runtime.system.enqueueSystemEvent({
        text: `[KorBus 알림] ${text}\n\n이 알림을 적절한 채널(${channel.type})로 전달해주세요.`,
      });
    },
  };
}
