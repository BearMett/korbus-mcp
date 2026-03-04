import type { NotificationPayload } from '../types.js';

export function sendConsole(payload: NotificationPayload): void {
  if (payload.type === 'NO_PREDICTION') {
    console.error(`[KorBus] ${payload.routeName} → ${payload.stationName}: 도착 예측 정보 없음`);
    return;
  }
  let msg = `[KorBus] ${payload.routeName} → ${payload.stationName}: ${payload.arrivalMsg} (vehicle: ${payload.vehicleId})`;
  if (payload.nextArrival) {
    msg += ` | next: ${payload.nextArrival.arrivalMsg}`;
  }
  console.error(msg);
}
