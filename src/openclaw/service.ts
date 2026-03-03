import { initDb, closeDb } from '../db.js';
import { startScheduler, type PollDeps } from '../scheduler.js';

export interface KorbusServiceConfig {
  pollEnabled: boolean;
  databaseUrl?: string;
}

export function createKorbusService(
  deps: PollDeps,
  config: KorbusServiceConfig,
) {
  let stopScheduler: (() => void) | null = null;

  return {
    id: 'korbus',

    async start() {
      if (config.databaseUrl) {
        process.env.DATABASE_URL = config.databaseUrl;
      }
      await initDb();
      console.error('[korbus] database initialized');

      if (config.pollEnabled) {
        stopScheduler = startScheduler(deps);
        console.error('[korbus] scheduler started');
      }
    },

    async stop() {
      if (stopScheduler) {
        stopScheduler();
        stopScheduler = null;
      }
      await closeDb();
      console.error('[korbus] stopped');
    },
  };
}
