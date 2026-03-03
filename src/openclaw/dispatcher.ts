import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Dispatcher } from '../notifier/dispatcher.js';
import type { NotificationPayload } from '../types.js';

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// OpenClaw Plugin API shape (logger only — no session needed)
// ---------------------------------------------------------------------------

export interface OpenClawRuntimeApi {
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMessage(p: NotificationPayload): string {
  return `🚌 ${p.routeName} → ${p.stationName}\n${p.arrivalMsg}`;
}

/** Extract recipient ID from a channel config JSON string. */
function parseTarget(configJson: string): string | undefined {
  try {
    const cfg = JSON.parse(configJson || '{}');
    return cfg.to ?? cfg.chatId ?? cfg.channelId ?? undefined;
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export function createOpenClawDispatcher(api: OpenClawRuntimeApi): Dispatcher {
  return {
    async dispatch(channel, payload) {
      const text = formatMessage(payload);

      if (channel.type === 'CONSOLE') {
        api.logger.info(`[KorBus] ${text}`);
        return;
      }

      const target = parseTarget(channel.config);
      if (!target) {
        api.logger.warn(
          `[KorBus] No target for channel ${channel.type}, skipping dispatch`,
        );
        return;
      }

      try {
        await execFileAsync('openclaw', [
          'message', 'send',
          '--channel', channel.type.toLowerCase(),
          '--target', target,
          '--message', `[KorBus 알림] ${text}`,
        ]);
      } catch (err) {
        api.logger.error(
          `[KorBus] dispatch failed (${channel.type}): ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    },
  };
}
