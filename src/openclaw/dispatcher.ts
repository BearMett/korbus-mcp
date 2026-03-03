import type { Dispatcher } from '../notifier/dispatcher.js';
import type { NotificationPayload } from '../types.js';

// ---------------------------------------------------------------------------
// OpenClaw Plugin API shape (system event subset)
// ---------------------------------------------------------------------------

export interface OpenClawRuntimeApi {
  logger: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
  runtime: {
    system: {
      enqueueSystemEvent(event: { text: string }): void;
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

      if (channel.type === 'CONSOLE') {
        api.logger.info(`[KorBus] ${text}`);
        return;
      }

      // Delegate to agent → OpenClaw routes response to originating channel
      api.runtime.system.enqueueSystemEvent({
        text: `[KorBus 알림] ${text}\n\n이 알림을 적절한 채널(${channel.type})로 전달해주세요.`,
      });
    },
  };
}
