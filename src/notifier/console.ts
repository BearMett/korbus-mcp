import type { NotificationPayload } from '../types.js';

export function sendConsole(payload: NotificationPayload): void {
  let msg = `[KorBus] ${payload.routeName} → ${payload.stationName}: ${payload.arrivalMsg} (vehicle: ${payload.vehicleId})`;
  if (payload.nextArrival) {
    msg += ` | next: ${payload.nextArrival.arrivalMsg}`;
  }
  console.error(msg);
}
