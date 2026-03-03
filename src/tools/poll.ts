import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { pollActiveAlarms, type PollDeps } from '../scheduler.js';
import { textResult, errorResult } from './helpers.js';

export function registerPollTools(server: McpServer, deps: PollDeps) {
  server.tool(
    'poll_now',
    'Run immediate polling for active alarms (checks arrivals and sends notifications)',
    {
      dry_run: z.boolean().optional().describe('If true, check but do not send notifications'),
    },
    async ({ dry_run }) => {
      try {
        const result = await pollActiveAlarms(deps, { dryRun: dry_run });
        return textResult(result);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
