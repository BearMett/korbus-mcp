import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BusGateway } from '../bus/gateway.js';
import { upsertStations, upsertRoutes } from '../db.js';
import { textResult, errorResult } from './helpers.js';

export function registerSearchTools(server: McpServer, gateway: BusGateway) {
  server.tool(
    'search_stations',
    'Search bus stations by name (Seoul + Gyeonggi)',
    { query: z.string().min(1).describe('Station name to search') },
    async ({ query }) => {
      try {
        const stations = await gateway.searchStations(query.trim());
        const saved = await upsertStations(stations);
        return textResult(saved);
      } catch (error) {
        return errorResult(error);
      }
    },
  );

  server.tool(
    'search_routes',
    'Search bus routes by name/number (Seoul + Gyeonggi)',
    { query: z.string().min(1).describe('Route name/number to search') },
    async ({ query }) => {
      try {
        const routes = await gateway.searchRoutes(query.trim());
        const saved = await upsertRoutes(routes);
        return textResult(saved);
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
