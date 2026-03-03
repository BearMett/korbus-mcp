import type { NotificationPayload } from '../types.js';

export function sendConsole(payload: NotificationPayload): void {
  console.error(
    `[KorBus] ${payload.routeName} → ${payload.stationName}: ${payload.arrivalMsg} (vehicle: ${payload.vehicleId})`
  );
}
