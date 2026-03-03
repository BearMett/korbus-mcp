import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { BusGateway } from '../bus/gateway.js';
import { findStationById, upsertRoutes } from '../db.js';
import { CoreError } from '../errors.js';
import { textResult, errorResult } from './helpers.js';

export function registerArrivalTools(server: McpServer, gateway: BusGateway) {
  server.tool(
    'get_arrivals',
    'Get real-time bus arrival info for a station (optionally filtered by route). Response includes `direction` (행선지/방면) per route. When presenting results, always group or label by direction so the user knows which way each bus is headed (e.g. "강남역 → 복정역 방면: 452(3분)").',
    {
      station_id: z.string().min(1).describe('Station ID (from search_stations)'),
      route_id: z.string().optional().describe('Route ID to filter (from search_routes)'),
    },
    async ({ station_id, route_id }) => {
      try {
        const stationRef = await findStationById(station_id);
        if (!stationRef) {
          throw new CoreError({
            code: 'NOT_FOUND',
            message: `Station not found: ${station_id}. Use search_stations first.`,
            retryable: false,
          });
        }
        const arrivals = await gateway.getArrivals(stationRef, route_id);

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
  );
}
