export type Region = 'SEOUL' | 'GYEONGGI';

export type DayOfWeek =
  | 'MON'
  | 'TUE'
  | 'WED'
  | 'THU'
  | 'FRI'
  | 'SAT'
  | 'SUN';

export type ChannelType = 'CONSOLE' | 'WEBHOOK' | 'TELEGRAM';

export type AlarmType = 'RECURRING' | 'ONCE';

export interface ScheduleWindow {
  dayOfWeek: DayOfWeek[];
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface ConsoleChannelConfig {
  type: 'CONSOLE';
  config?: Record<string, never>;
}

export interface WebhookChannelConfig {
  type: 'WEBHOOK';
  config: { url: string };
}

export interface TelegramChannelConfig {
  type: 'TELEGRAM';
  config: { chatId: string };
}

export type ChannelConfig =
  | ConsoleChannelConfig
  | WebhookChannelConfig
  | TelegramChannelConfig;

export interface StationRef {
  id: string;
  region: Region;
  arsId?: string | null;
}

export interface Station {
  id: string;
  name: string;
  region: Region;
  arsId?: string | null;
  posX?: number;
  posY?: number;
}

export interface Route {
  id: string;
  name: string;
  region: Region;
}

export interface Arrival {
  routeId: string;
  routeName: string;
  stationId: string;
  vehicleId?: string;
  direction?: string;
  arrivalSec: number;
  arrivalMsg: string;
}

export interface AlarmChannel {
  type: ChannelType;
  config: string;
}

export interface Alarm {
  id: string;
  label?: string | null;
  stationId: string;
  routeId: string;
  alertMinutes: number;
  type: AlarmType;
  activeUntil?: Date | null;
  firedAt?: Date | null;
  enabled: boolean;
  schedules: ScheduleWindow[];
  channels: AlarmChannel[];
  createdAt: Date;
}

export interface AlarmWithRelations extends Alarm {
  station: Station;
  route: Route;
}

export interface CreateAlarmInput {
  label?: string;
  stationId: string;
  routeId: string;
  alertMinutes: number;
  schedules: ScheduleWindow[];
  channels: ChannelConfig[];
}

export interface CreateOnceAlarmInput {
  label?: string;
  stationId: string;
  routeId: string;
  alertMinutes: number;
  activeUntil?: string; // "HH:mm" or ISO datetime
  channels: ChannelConfig[];
}

export interface UpdateAlarmInput {
  label?: string;
  alertMinutes?: number;
  enabled?: boolean;
  schedules?: ScheduleWindow[];
  channels?: ChannelConfig[];
}

export interface NotificationPayload {
  alarmId: string;
  stationName: string;
  routeName: string;
  arrivalSec: number;
  arrivalMsg: string;
  vehicleId: string;
}

export interface PollResult {
  checkedAlarms: number;
  groupedQueries: number;
  notificationsSent: number;
  dryRun: boolean;
}

// --- Time utilities ---

const DAY_MAP: DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

export function getNowSlot(now: Date): { day: DayOfWeek; time: string } {
  const day = DAY_MAP[now.getDay()];
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return { day, time: `${hh}:${mm}` };
}

export function includesNow(schedule: ScheduleWindow, now: Date): boolean {
  const { day, time } = getNowSlot(now);
  if (!schedule.dayOfWeek.includes(day)) {
    return false;
  }
  return schedule.startTime <= time && schedule.endTime >= time;
}
