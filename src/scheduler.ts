import cron from 'node-cron';
import { listActiveAlarms, hasRecentNotification, createNotificationLog, markAlarmFired } from './db.js';
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
    return { checkedAlarms: 0, groupedQueries: 0, notificationsSent: 0, skippedAlarms: [], dryRun };
  }

  // 2. Group by stationId:routeId to minimize API calls
  const groups = new Map<string, AlarmWithRelations[]>();
  for (const alarm of alarms) {
    const key = `${alarm.stationId}:${alarm.routeId}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(alarm);
  }

  let notificationsSent = 0;
  const skippedAlarms: { alarmId: string; reason: string }[] = [];

  // 3. Process each group
  const since = new Date(now.getTime() - 10 * 60 * 1000);
  const results = await Promise.allSettled(
    [...groups.values()].map(async (groupAlarms) => {
      const first = groupAlarms[0];
      const stationRef: StationRef = {
        id: first.station.id,
        name: first.station.name,
        region: first.station.region as Region,
        arsId: first.station.arsId,
      };

      const arrivals = await deps.gateway.getArrivals(stationRef, first.route.id);
      // Sort by arrivalSec ascending (API order not guaranteed)
      const sorted = [...arrivals].sort((a, b) => a.arrivalSec - b.arrivalSec);

      for (const alarm of groupAlarms) {
        let alarmFired = false;
        const thresholdSec = alarm.alertMinutes * 60;
        const minCatchableSec = alarm.type === 'ONCE' ? 60 : alarm.alertMinutes * 30;

        // Separate actionable arrivals (with prediction) from no-prediction entries
        const actionable = sorted.filter((a) => a.arrivalSec > 0);

        for (let i = 0; i < actionable.length; i++) {
          const arrival = actionable[i];
          if (arrival.arrivalSec > thresholdSec) continue;    // too far
          if (arrival.arrivalSec < minCatchableSec) continue;  // missed bus

          const vehicleId = arrival.vehicleId || `route:${arrival.routeId}`;

          // Dedup once per alarm+vehicle, then dispatch to all channels
          const hasRecent = await hasRecentNotification(alarm.id, vehicleId, since);
          if (hasRecent) continue;

          // Find next bus after this one
          const next = actionable.find((a, j) => j > i && a.arrivalSec > arrival.arrivalSec);
          const nextArrival = next
            ? { arrivalSec: next.arrivalSec, arrivalMsg: next.arrivalMsg }
            : undefined;

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
                  nextArrival,
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
            alarmFired = true;
          }
        }

        // No-prediction: route exists in API but no actionable arrivals
        if (sorted.length > 0 && actionable.length === 0) {
          const noPredVehicleId = 'no-prediction';
          const hasRecent = await hasRecentNotification(alarm.id, noPredVehicleId, since);
          if (!hasRecent) {
            for (const channel of alarm.channels) {
              if (!dryRun) {
                await deps.dispatcher.dispatch(
                  { type: channel.type, config: channel.config },
                  {
                    type: 'NO_PREDICTION',
                    alarmId: alarm.id,
                    stationName: alarm.station.name,
                    routeName: alarm.route.name,
                    arrivalSec: -1,
                    arrivalMsg: '도착 정보 없음',
                    vehicleId: noPredVehicleId,
                  },
                );
              }
              notificationsSent += 1;
            }
            if (!dryRun) {
              await createNotificationLog({
                alarmId: alarm.id,
                vehicleId: noPredVehicleId,
                message: '도착 예측 정보 없음',
                channel: alarm.channels.map((c) => c.type).join(','),
              });
            }
            skippedAlarms.push({ alarmId: alarm.id, reason: 'NO_PREDICTION' });
          }
        }

        // Mark ONCE alarms as fired after successful notification
        if (alarmFired && alarm.type === 'ONCE') {
          await markAlarmFired(alarm.id);
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
    skippedAlarms,
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
