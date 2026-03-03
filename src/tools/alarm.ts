import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createAlarm, createOnceAlarm, listAlarms, findAlarm, updateAlarm, deleteAlarm } from '../db.js';
import { CoreError } from '../errors.js';
import { textResult, errorResult } from './helpers.js';

const dayOfWeekEnum = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);

const scheduleSchema = z.object({
  dayOfWeek: z.array(dayOfWeekEnum),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const channelSchema = z.union([
  z.object({ type: z.literal('CONSOLE'), config: z.record(z.never()).optional() }),
  z.object({ type: z.literal('WEBHOOK'), config: z.object({ url: z.string().url() }) }),
  z.object({ type: z.literal('TELEGRAM'), config: z.object({ chatId: z.string().min(1) }) }),
]);

export function registerAlarmTools(server: McpServer) {
  server.tool('list_alarms', 'List all registered bus alarms', {}, async () => {
    try {
      const alarms = await listAlarms();
      return textResult(alarms.map(a => ({
        id: a.id,
        label: a.label,
        enabled: a.enabled,
        type: a.type,
        alertMinutes: a.alertMinutes,
        stationName: a.station.name,
        routeName: a.route.name,
        schedules: a.schedules,
        channelTypes: a.channels.map(c => c.type),
      })));
    } catch (error) {
      return errorResult(error);
    }
  });

  server.tool(
    'create_alarm',
    'Create a recurring bus arrival alarm',
    {
      station_id: z.string().min(1).describe('Station ID'),
      route_id: z.string().min(1).describe('Route ID'),
      label: z.string().optional().describe('Label for this alarm'),
      alert_minutes: z.number().int().min(1).max(30).describe('Alert when bus is within N minutes'),
      schedules: z.array(scheduleSchema).describe('When to monitor'),
      channels: z.array(channelSchema).describe('How to notify'),
    },
    async (input) => {
      try {
        const alarm = await createAlarm({
          stationId: input.station_id,
          routeId: input.route_id,
          label: input.label,
          alertMinutes: input.alert_minutes,
          schedules: input.schedules,
          channels: input.channels as any,
        });
        return textResult(alarm);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'create_once_alarm',
    'Create a one-time bus arrival alarm (fires once then expires)',
    {
      station_id: z.string().min(1).describe('Station ID'),
      route_id: z.string().min(1).describe('Route ID'),
      label: z.string().optional().describe('Label for this alarm'),
      alert_minutes: z.number().int().min(1).max(30).describe('Alert when bus is within N minutes'),
      active_until: z.string().optional().describe('Monitor until this time (HH:mm or ISO datetime). Omit to monitor indefinitely until fired.'),
      channels: z.array(channelSchema).describe('How to notify'),
    },
    async (input) => {
      try {
        const alarm = await createOnceAlarm({
          stationId: input.station_id,
          routeId: input.route_id,
          label: input.label,
          alertMinutes: input.alert_minutes,
          activeUntil: input.active_until,
          channels: input.channels as any,
        });
        return textResult(alarm);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'update_alarm',
    'Update an existing bus alarm',
    {
      alarm_id: z.string().min(1).describe('Alarm ID to update'),
      patch: z.object({
        label: z.string().optional(),
        alertMinutes: z.number().int().min(1).max(30).optional(),
        enabled: z.boolean().optional(),
        schedules: z.array(scheduleSchema).optional(),
        channels: z.array(channelSchema).optional(),
      }),
    },
    async ({ alarm_id, patch }) => {
      try {
        const existing = await findAlarm(alarm_id);
        if (!existing) {
          throw new CoreError({ code: 'NOT_FOUND', message: `Alarm not found: ${alarm_id}`, retryable: false });
        }
        const updated = await updateAlarm(alarm_id, patch as any);
        return textResult(updated);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'delete_alarm',
    'Delete a bus alarm (confirm=true required)',
    {
      alarm_id: z.string().min(1).describe('Alarm ID to delete'),
      confirm: z.boolean().describe('Must be true to confirm deletion'),
    },
    async ({ alarm_id, confirm }) => {
      try {
        if (!confirm) {
          throw new CoreError({
            code: 'VALIDATION_ERROR',
            message: 'confirm=true is required to delete an alarm',
            retryable: false,
          });
        }
        const existing = await findAlarm(alarm_id);
        if (!existing) {
          throw new CoreError({ code: 'NOT_FOUND', message: `Alarm not found: ${alarm_id}`, retryable: false });
        }
        await deleteAlarm(alarm_id);
        return textResult({ deleted: true, alarm_id });
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
