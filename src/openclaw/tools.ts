import { Type, type TSchema } from '@sinclair/typebox';
import type { BusGateway } from '../bus/gateway.js';
import type { Dispatcher } from '../notifier/dispatcher.js';
import {
  upsertStations,
  upsertRoutes,
  findStationById,
  listAlarms,
  createAlarm,
  createOnceAlarm,
  findAlarm,
  updateAlarm,
  deleteAlarm,
} from '../db.js';
import { pollActiveAlarms } from '../scheduler.js';
import { CoreError, toCoreError } from '../errors.js';
import type { ChannelConfig } from '../types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ToolResult {
  content: { type: 'text'; text: string }[];
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: TSchema;
  execute: (
    toolCallId: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<ToolResult>;
}

interface PluginAPI {
  registerTool(
    tool: ToolDefinition,
    options?: { optional?: boolean },
  ): void;
}

export interface ToolDeps {
  gateway: BusGateway;
  dispatcher: Dispatcher;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function textResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

function errorResult(error: unknown): ToolResult {
  const coreError = toCoreError(error);
  return {
    content: [{ type: 'text', text: JSON.stringify(coreError.toJSON(), null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const DayOfWeekEnum = Type.Unsafe<string>({
  type: 'string',
  enum: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
});

const ScheduleSchema = Type.Object({
  dayOfWeek: Type.Array(DayOfWeekEnum),
  startTime: Type.String({ pattern: '^\\d{2}:\\d{2}$' }),
  endTime: Type.String({ pattern: '^\\d{2}:\\d{2}$' }),
});

const ChannelSchema = Type.Union([
  Type.Object({
    type: Type.Literal('CONSOLE'),
    config: Type.Optional(Type.Object({}, { additionalProperties: false })),
  }),
  Type.Object({
    type: Type.Literal('WEBHOOK'),
    config: Type.Object({ url: Type.String({ format: 'uri' }) }),
  }),
  Type.Object({
    type: Type.Literal('TELEGRAM'),
    config: Type.Optional(Type.Object({ chatId: Type.String({ minLength: 1 }) })),
  }),
  Type.Object({
    type: Type.Literal('DISCORD'),
    config: Type.Optional(Type.Object({ channelId: Type.String({ minLength: 1 }) })),
  }),
  Type.Object({
    type: Type.Literal('SLACK'),
    config: Type.Optional(Type.Object({ channelId: Type.String({ minLength: 1 }) })),
  }),
  Type.Object({
    type: Type.Literal('SIGNAL'),
    config: Type.Optional(Type.Object({ to: Type.String({ minLength: 1 }) })),
  }),
]);

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

export function registerKorbusTools(api: PluginAPI, deps: ToolDeps): void {
  // ── search_stations ──
  api.registerTool(
    {
      name: 'korbus_search_stations',
      description: 'Search bus stations by name (Seoul + Gyeonggi) and cache results',
      parameters: Type.Object({
        query: Type.String({ minLength: 1, description: 'Station name to search' }),
      }),
      async execute(_id, params) {
        try {
          const stations = await deps.gateway.searchStations(
            (params.query as string).trim(),
          );
          const saved = await upsertStations(stations);
          return textResult(saved);
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );

  // ── search_routes ──
  api.registerTool(
    {
      name: 'korbus_search_routes',
      description: 'Search bus routes by name/number (Seoul + Gyeonggi) and cache results',
      parameters: Type.Object({
        query: Type.String({ minLength: 1, description: 'Route name/number to search' }),
      }),
      async execute(_id, params) {
        try {
          const routes = await deps.gateway.searchRoutes(
            (params.query as string).trim(),
          );
          const saved = await upsertRoutes(routes);
          return textResult(saved);
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );

  // ── get_arrivals ──
  api.registerTool(
    {
      name: 'korbus_get_arrivals',
      description:
        'Get real-time bus arrival info for a station (optionally filtered by route)',
      parameters: Type.Object({
        station_id: Type.String({
          minLength: 1,
          description: 'Station ID (from korbus_search_stations)',
        }),
        route_id: Type.Optional(
          Type.String({ description: 'Route ID to filter (from korbus_search_routes)' }),
        ),
      }),
      async execute(_id, params) {
        try {
          const stationRef = await findStationById(params.station_id as string);
          if (!stationRef) {
            throw new CoreError({
              code: 'NOT_FOUND',
              message: `Station not found: ${params.station_id}. Use korbus_search_stations first.`,
              retryable: false,
            });
          }
          const arrivals = await deps.gateway.getArrivals(
            stationRef,
            params.route_id as string | undefined,
          );

          // Auto-cache routes discovered via arrivals
          const seen = new Set<string>();
          const routes = arrivals.flatMap((a) => {
            if (seen.has(a.routeId)) return [];
            seen.add(a.routeId);
            return [{ id: a.routeId, name: a.routeName, region: stationRef.region }];
          });
          if (routes.length) await upsertRoutes(routes);

          return textResult(arrivals);
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );

  // ── list_alarms ──
  api.registerTool(
    {
      name: 'korbus_list_alarms',
      description: 'List all registered bus alarms',
      parameters: Type.Object({}),
      async execute() {
        try {
          const alarms = await listAlarms();
          return textResult(alarms);
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );

  // ── create_alarm ──
  api.registerTool(
    {
      name: 'korbus_create_alarm',
      description: 'Create a recurring bus arrival alarm (notifications delivered via OpenClaw)',
      parameters: Type.Object({
        station_id: Type.String({ minLength: 1, description: 'Station ID' }),
        route_id: Type.String({ minLength: 1, description: 'Route ID' }),
        label: Type.Optional(Type.String({ description: 'Label for this alarm' })),
        alert_minutes: Type.Integer({
          minimum: 1,
          maximum: 30,
          description: 'Alert when bus is within N minutes',
        }),
        schedules: Type.Array(ScheduleSchema, { description: 'When to monitor' }),
        channel: Type.String({
          description:
            'Notification channel (e.g. telegram, discord, slack). Use the current conversation channel if not specified by user.',
        }),
        to: Type.String({
          description:
            'Recipient ID (e.g. chat ID, channel ID). Use the current conversation target if not specified by user.',
        }),
      }),
      async execute(_id, params) {
        try {
          const alarm = await createAlarm({
            stationId: params.station_id as string,
            routeId: params.route_id as string,
            label: params.label as string | undefined,
            alertMinutes: params.alert_minutes as number,
            schedules: params.schedules as any,
            channels: [{ type: params.channel as string, config: { to: params.to as string } }] as unknown as ChannelConfig[],
          });
          return textResult(alarm);
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );

  // ── create_once_alarm ──
  api.registerTool(
    {
      name: 'korbus_create_once_alarm',
      description: 'Create a one-time bus arrival alarm that fires once then expires (notifications delivered via OpenClaw)',
      parameters: Type.Object({
        station_id: Type.String({ minLength: 1, description: 'Station ID' }),
        route_id: Type.String({ minLength: 1, description: 'Route ID' }),
        label: Type.Optional(Type.String({ description: 'Label for this alarm' })),
        alert_minutes: Type.Integer({
          minimum: 1,
          maximum: 30,
          description: 'Alert when bus is within N minutes',
        }),
        active_until: Type.Optional(
          Type.String({
            description:
              'Monitor until this time (HH:mm or ISO datetime). Omit to monitor indefinitely until fired.',
          }),
        ),
        channel: Type.String({
          description:
            'Notification channel (e.g. telegram, discord, slack). Use the current conversation channel if not specified by user.',
        }),
        to: Type.String({
          description:
            'Recipient ID (e.g. chat ID, channel ID). Use the current conversation target if not specified by user.',
        }),
      }),
      async execute(_id, params) {
        try {
          const alarm = await createOnceAlarm({
            stationId: params.station_id as string,
            routeId: params.route_id as string,
            label: params.label as string | undefined,
            alertMinutes: params.alert_minutes as number,
            activeUntil: params.active_until as string | undefined,
            channels: [{ type: params.channel as string, config: { to: params.to as string } }] as unknown as ChannelConfig[],
          });
          return textResult(alarm);
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );

  // ── update_alarm ──
  api.registerTool(
    {
      name: 'korbus_update_alarm',
      description: 'Update an existing bus alarm',
      parameters: Type.Object({
        alarm_id: Type.String({ minLength: 1, description: 'Alarm ID to update' }),
        patch: Type.Object({
          label: Type.Optional(Type.String()),
          alertMinutes: Type.Optional(
            Type.Integer({ minimum: 1, maximum: 30 }),
          ),
          enabled: Type.Optional(Type.Boolean()),
          schedules: Type.Optional(Type.Array(ScheduleSchema)),
          channels: Type.Optional(Type.Array(ChannelSchema)),
        }),
      }),
      async execute(_id, params) {
        try {
          const alarmId = params.alarm_id as string;
          const existing = await findAlarm(alarmId);
          if (!existing) {
            throw new CoreError({
              code: 'NOT_FOUND',
              message: `Alarm not found: ${alarmId}`,
              retryable: false,
            });
          }
          const updated = await updateAlarm(alarmId, params.patch as any);
          return textResult(updated);
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );

  // ── delete_alarm ──
  api.registerTool(
    {
      name: 'korbus_delete_alarm',
      description: 'Delete a bus alarm (confirm=true required)',
      parameters: Type.Object({
        alarm_id: Type.String({ minLength: 1, description: 'Alarm ID to delete' }),
        confirm: Type.Boolean({ description: 'Must be true to confirm deletion' }),
      }),
      async execute(_id, params) {
        try {
          if (!params.confirm) {
            throw new CoreError({
              code: 'VALIDATION_ERROR',
              message: 'confirm=true is required to delete an alarm',
              retryable: false,
            });
          }
          const alarmId = params.alarm_id as string;
          const existing = await findAlarm(alarmId);
          if (!existing) {
            throw new CoreError({
              code: 'NOT_FOUND',
              message: `Alarm not found: ${alarmId}`,
              retryable: false,
            });
          }
          await deleteAlarm(alarmId);
          return textResult({ deleted: true, alarm_id: alarmId });
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );

  // ── poll_now ──
  api.registerTool(
    {
      name: 'korbus_poll_now',
      description:
        'Run immediate polling for active alarms (checks arrivals and sends notifications)',
      parameters: Type.Object({
        dry_run: Type.Optional(
          Type.Boolean({
            description: 'If true, check but do not send notifications',
          }),
        ),
      }),
      async execute(_id, params) {
        try {
          const result = await pollActiveAlarms(deps, {
            dryRun: params.dry_run as boolean | undefined,
          });
          return textResult(result);
        } catch (error) {
          return errorResult(error);
        }
      },
    },
    { optional: true },
  );
}
