import cron from 'node-cron';
import { listActiveAlarms, hasRecentNotification, createNotificationLog } from './db.js';
import type { BusGateway } from './bus/gateway.js';
import type { Dispatcher } from './notifier/dispatcher.js';
import type { AlarmWithRelations, PollResult, StationRef, Region } from './types.js';

export interface PollDeps {
  gateway: BusGateway;
  dispatcher: Dispatcher;
}

interface PollOptions {
  now?: Date;
  dryRun?: boolean;
}

export async function pollActiveAlarms(
  deps: PollDeps,
  options?: PollOptions,
): Promise<PollResult> {
  const now = options?.now ?? new Date();
  const dryRun = options?.dryRun ?? false;

  // 1. Get active alarms for current time
  const alarms = await listActiveAlarms(now);

  if (!alarms.length) {
    return { checkedAlarms: 0, groupedQueries: 0, notificationsSent: 0, dryRun };
  }

  // 2. Group by stationId:routeId to minimize API calls
  const groups = new Map<string, AlarmWithRelations[]>();
  for (const alarm of alarms) {
    const key = `${alarm.stationId}:${alarm.routeId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(alarm);
  }

  let notificationsSent = 0;

  // 3. Process each group
  const since = new Date(now.getTime() - 10 * 60 * 1000);
  const results = await Promise.allSettled(
    [...groups.values()].map(async (groupAlarms) => {
      const first = groupAlarms[0];
      const stationRef: StationRef = {
        id: first.station.id,
        region: first.station.region as Region,
        arsId: first.station.arsId,
      };

      const arrivals = await deps.gateway.getArrivals(stationRef, first.route.id);

      for (const alarm of groupAlarms) {
        for (const arrival of arrivals) {
          if (arrival.arrivalSec > alarm.alertMinutes * 60) continue;

          const vehicleId = arrival.vehicleId || `route:${arrival.routeId}`;

          // Dedup once per alarm+vehicle, then dispatch to all channels
          const hasRecent = await hasRecentNotification(alarm.id, vehicleId, since);
          if (hasRecent) continue;

          for (const channel of alarm.channels) {
            if (!dryRun) {
              await deps.dispatcher.dispatch(
                { type: channel.type, config: channel.config },
                {
                  alarmId: alarm.id,
                  stationName: alarm.station.name,
                  routeName: alarm.route.name,
                  arrivalSec: arrival.arrivalSec,
                  arrivalMsg: arrival.arrivalMsg,
                  vehicleId,
                },
              );
            }

            notificationsSent += 1;
          }

          if (!dryRun) {
            await createNotificationLog({
              alarmId: alarm.id,
              vehicleId,
              message: arrival.arrivalMsg,
              channel: alarm.channels.map((c) => c.type).join(','),
            });
          }
        }
      }
    }),
  );

  for (const r of results) {
    if (r.status === 'rejected') {
      console.error('[scheduler] group poll failed:', r.reason);
    }
  }

  return {
    checkedAlarms: alarms.length,
    groupedQueries: groups.size,
    notificationsSent,
    dryRun,
  };
}

export function startScheduler(deps: PollDeps): () => void {
  let running = false;

  const task = cron.schedule('* * * * *', async () => {
    if (running) {
      console.error('[scheduler] previous poll still running, skipping');
      return;
    }
    running = true;
    try {
      const result = await pollActiveAlarms(deps);
      console.error(
        `[scheduler] poll complete: ${result.checkedAlarms} alarms, ${result.notificationsSent} notifications`,
      );
    } catch (err) {
      console.error('[scheduler] poll error:', err);
    } finally {
      running = false;
    }
  });

  console.error('[scheduler] started (every minute)');

  return () => {
    task.stop();
    console.error('[scheduler] stopped');
  };
}
