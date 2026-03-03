import { execSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import type {
  Station,
  Route,
  StationRef,
  Region,
  DayOfWeek,
  AlarmType,
  AlarmWithRelations,
  CreateAlarmInput,
  CreateOnceAlarmInput,
  UpdateAlarmInput,
  ScheduleWindow,
  AlarmChannel,
} from './types.js';

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

let prisma: PrismaClient | null = null;

/**
 * Initialise PrismaClient singleton.
 * Automatically runs `prisma migrate deploy` so the DB schema is up-to-date.
 */
export async function initDb(): Promise<PrismaClient> {
  if (prisma) return prisma;

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(currentDir, '..');
  const schemaPath = path.resolve(repoRoot, 'prisma/schema.prisma');

  const defaultDbDir = path.resolve(os.homedir(), '.korbus-mcp');
  mkdirSync(defaultDbDir, { recursive: true });
  const defaultDbUrl = `file:${path.resolve(defaultDbDir, 'korbus.db')}`;
  const databaseUrl = process.env.DATABASE_URL ?? defaultDbUrl;

  if (existsSync(schemaPath)) {
    try {
      const require = createRequire(import.meta.url);
      const prismaPkg = path.dirname(require.resolve('prisma/package.json'));
      const prismaBin = path.resolve(prismaPkg, 'build', 'index.js');
      execSync(`node "${prismaBin}" migrate deploy --schema "${schemaPath}"`, {
        cwd: repoRoot,
        stdio: 'pipe',
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
    } catch {
      // Ignore migrate errors — the DB may already be up-to-date
    }
  }

  prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  await prisma.$connect();
  console.error('[db] connected');
  return prisma;
}

/** Return the initialised PrismaClient. Throws if `initDb()` has not been called. */
export function getDb(): PrismaClient {
  if (!prisma) {
    throw new Error('Database not initialised. Call initDb() first.');
  }
  return prisma;
}

/** Disconnect PrismaClient and reset the singleton. */
export async function closeDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
    console.error('[db] disconnected');
  }
}

// ---------------------------------------------------------------------------
// Mapping helpers
// ---------------------------------------------------------------------------

interface PrismaAlarmRow {
  id: string;
  label: string | null;
  stationId: string;
  routeId: string;
  alertMinutes: number;
  type: string;
  activeUntil: Date | null;
  firedAt: Date | null;
  enabled: boolean;
  createdAt: Date;
  station: {
    id: string;
    name: string;
    region: string;
    arsId: string | null;
    posX: number | null;
    posY: number | null;
  };
  route: {
    id: string;
    name: string;
    region: string;
  };
  schedules: {
    id: string;
    alarmId: string;
    dayOfWeek: string;
    startTime: string;
    endTime: string;
  }[];
  channels: {
    id: string;
    alarmId: string;
    type: string;
    config: string;
  }[];
}

function mapAlarmWithRelations(row: PrismaAlarmRow): AlarmWithRelations {
  const schedules: ScheduleWindow[] = row.schedules.map((s) => ({
    dayOfWeek: s.dayOfWeek.split(',') as DayOfWeek[],
    startTime: s.startTime,
    endTime: s.endTime,
  }));

  const channels: AlarmChannel[] = row.channels.map((c) => ({
    type: c.type as AlarmChannel['type'],
    config: c.config,
  }));

  return {
    id: row.id,
    label: row.label,
    stationId: row.stationId,
    routeId: row.routeId,
    alertMinutes: row.alertMinutes,
    type: row.type as AlarmType,
    activeUntil: row.activeUntil,
    firedAt: row.firedAt,
    enabled: row.enabled,
    schedules,
    channels,
    createdAt: row.createdAt,
    station: {
      id: row.station.id,
      name: row.station.name,
      region: row.station.region as Region,
      arsId: row.station.arsId,
    },
    route: {
      id: row.route.id,
      name: row.route.name,
      region: row.route.region as Region,
    },
  };
}

/** Standard Prisma `include` clause used for every alarm query. */
const ALARM_INCLUDE = {
  station: true,
  route: true,
  schedules: true,
  channels: true,
} as const;

// ---------------------------------------------------------------------------
// Station helpers
// ---------------------------------------------------------------------------

function mapStation(row: {
  id: string;
  name: string;
  region: string;
  arsId: string | null;
  posX: number | null;
  posY: number | null;
}): Station {
  return {
    id: row.id,
    name: row.name,
    region: row.region as Region,
    arsId: row.arsId,
  };
}

function mapRoute(row: { id: string; name: string; region: string }): Route {
  return {
    id: row.id,
    name: row.name,
    region: row.region as Region,
  };
}

// ---------------------------------------------------------------------------
// CRUD — Stations & Routes
// ---------------------------------------------------------------------------

/** Upsert an array of stations, returning the mapped results. */
export async function upsertStations(stations: Station[]): Promise<Station[]> {
  const db = getDb();
  const results: Station[] = [];

  for (const s of stations) {
    const row = await db.station.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        name: s.name,
        region: s.region,
        arsId: s.arsId ?? null,
        posX: s.posX ?? null,
        posY: s.posY ?? null,
      },
      update: {
        name: s.name,
        region: s.region,
        arsId: s.arsId ?? null,
        posX: s.posX ?? null,
        posY: s.posY ?? null,
      },
    });
    results.push(mapStation(row));
  }

  return results;
}

/** Upsert an array of routes, returning the mapped results. */
export async function upsertRoutes(routes: Route[]): Promise<Route[]> {
  const db = getDb();
  const results: Route[] = [];

  for (const r of routes) {
    const row = await db.route.upsert({
      where: { id: r.id },
      create: {
        id: r.id,
        name: r.name,
        region: r.region,
      },
      update: {
        name: r.name,
        region: r.region,
      },
    });
    results.push(mapRoute(row));
  }

  return results;
}

/** Find a station by id and return a lightweight StationRef. */
export async function findStationById(
  stationId: string,
): Promise<StationRef | null> {
  const db = getDb();
  const row = await db.station.findUnique({ where: { id: stationId } });
  if (!row) return null;
  return {
    id: row.id,
    region: row.region as Region,
    arsId: row.arsId,
  };
}

// ---------------------------------------------------------------------------
// CRUD — Alarms
// ---------------------------------------------------------------------------

/** Create an alarm with nested schedules and channels. */
export async function createAlarm(
  input: CreateAlarmInput,
): Promise<AlarmWithRelations> {
  const db = getDb();

  const row = await db.alarm.create({
    data: {
      stationId: input.stationId,
      routeId: input.routeId,
      label: input.label ?? null,
      alertMinutes: input.alertMinutes,
      schedules: {
        create: input.schedules.map((s) => ({
          dayOfWeek: s.dayOfWeek.join(','),
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      },
      channels: {
        create: input.channels.map((c) => ({
          type: c.type,
          config: JSON.stringify(c.config ?? {}),
        })),
      },
    },
    include: ALARM_INCLUDE,
  });

  return mapAlarmWithRelations(row as PrismaAlarmRow);
}

/** List all alarms with their station, route, schedules, and channels. */
export async function listAlarms(): Promise<AlarmWithRelations[]> {
  const db = getDb();
  const rows = await db.alarm.findMany({ include: ALARM_INCLUDE });
  return rows.map((r) => mapAlarmWithRelations(r as PrismaAlarmRow));
}

/** Find a single alarm by id, or return null. */
export async function findAlarm(
  alarmId: string,
): Promise<AlarmWithRelations | null> {
  const db = getDb();
  const row = await db.alarm.findUnique({
    where: { id: alarmId },
    include: ALARM_INCLUDE,
  });
  if (!row) return null;
  return mapAlarmWithRelations(row as PrismaAlarmRow);
}

/**
 * Update an alarm. If `schedules` or `channels` are provided in the input
 * the existing child rows are deleted and recreated.
 */
export async function updateAlarm(
  alarmId: string,
  input: UpdateAlarmInput,
): Promise<AlarmWithRelations> {
  const db = getDb();

  // Delete existing children when replacements are provided
  const deleteOps: Promise<unknown>[] = [];
  if (input.schedules) {
    deleteOps.push(
      db.alarmSchedule.deleteMany({ where: { alarmId } }),
    );
  }
  if (input.channels) {
    deleteOps.push(
      db.alarmChannel.deleteMany({ where: { alarmId } }),
    );
  }
  if (deleteOps.length > 0) {
    await Promise.all(deleteOps);
  }

  const row = await db.alarm.update({
    where: { id: alarmId },
    data: {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.alertMinutes !== undefined && {
        alertMinutes: input.alertMinutes,
      }),
      ...(input.enabled !== undefined && { enabled: input.enabled }),
      ...(input.schedules && {
        schedules: {
          create: input.schedules.map((s) => ({
            dayOfWeek: s.dayOfWeek.join(','),
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        },
      }),
      ...(input.channels && {
        channels: {
          create: input.channels.map((c) => ({
            type: c.type,
            config: JSON.stringify(c.config ?? {}),
          })),
        },
      }),
    },
    include: ALARM_INCLUDE,
  });

  return mapAlarmWithRelations(row as PrismaAlarmRow);
}

/** Delete an alarm by id. Cascading deletes handle children. */
export async function deleteAlarm(alarmId: string): Promise<void> {
  const db = getDb();
  await db.alarm.delete({ where: { id: alarmId } });
}

/** Create a one-time alarm (no schedules). */
export async function createOnceAlarm(
  input: CreateOnceAlarmInput,
): Promise<AlarmWithRelations> {
  const db = getDb();

  let activeUntil: Date | null = null;
  if (input.activeUntil) {
    if (/^\d{2}:\d{2}$/.test(input.activeUntil)) {
      const [hh, mm] = input.activeUntil.split(':').map(Number);
      const d = new Date();
      d.setHours(hh, mm, 0, 0);
      activeUntil = d;
    } else {
      activeUntil = new Date(input.activeUntil);
    }
  }

  const row = await db.alarm.create({
    data: {
      stationId: input.stationId,
      routeId: input.routeId,
      label: input.label ?? null,
      alertMinutes: input.alertMinutes,
      type: 'ONCE',
      activeUntil,
      channels: {
        create: input.channels.map((c) => ({
          type: c.type,
          config: JSON.stringify(c.config ?? {}),
        })),
      },
    },
    include: ALARM_INCLUDE,
  });

  return mapAlarmWithRelations(row as PrismaAlarmRow);
}

/** Mark a one-time alarm as fired. */
export async function markAlarmFired(alarmId: string): Promise<void> {
  const db = getDb();
  await db.alarm.update({
    where: { id: alarmId },
    data: { firedAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// Scheduling helpers
// ---------------------------------------------------------------------------

/**
 * List all *active* alarms whose schedule matches the given `now` timestamp.
 *
 * "Active" means:
 *   - RECURRING: `enabled` is true and at least one schedule row matches now.
 *   - ONCE: `enabled` is true, `firedAt` is null, and `activeUntil` is null or >= now.
 */
export async function listActiveAlarms(
  now: Date,
): Promise<AlarmWithRelations[]> {
  const db = getDb();

  const dayNames: DayOfWeek[] = [
    'SUN',
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT',
  ];
  const currentDay = dayNames[now.getDay()];
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const currentTime = `${hh}:${mm}`;

  // RECURRING alarms: match by schedule
  const recurringRows = await db.alarm.findMany({
    where: {
      enabled: true,
      type: 'RECURRING',
      schedules: {
        some: {
          dayOfWeek: { contains: currentDay },
          startTime: { lte: currentTime },
          endTime: { gte: currentTime },
        },
      },
    },
    include: ALARM_INCLUDE,
  });

  // ONCE alarms: not yet fired, within activeUntil window
  const onceRows = await db.alarm.findMany({
    where: {
      enabled: true,
      type: 'ONCE',
      firedAt: null,
      OR: [
        { activeUntil: null },
        { activeUntil: { gte: now } },
      ],
    },
    include: ALARM_INCLUDE,
  });

  const allRows = [...recurringRows, ...onceRows];
  return allRows.map((r) => mapAlarmWithRelations(r as PrismaAlarmRow));
}

// ---------------------------------------------------------------------------
// Notification log
// ---------------------------------------------------------------------------

/**
 * Check whether a notification log exists for the given alarm + vehicle
 * combination since the provided timestamp.
 */
export async function hasRecentNotification(
  alarmId: string,
  vehicleId: string,
  since: Date,
): Promise<boolean> {
  const db = getDb();
  const count = await db.notificationLog.count({
    where: {
      alarmId,
      vehicleId,
      sentAt: { gte: since },
    },
  });
  return count > 0;
}

/** Create a notification log entry. */
export async function createNotificationLog(input: {
  alarmId: string;
  vehicleId: string;
  message: string;
  channel: string;
}): Promise<void> {
  const db = getDb();
  await db.notificationLog.create({ data: input });
}
