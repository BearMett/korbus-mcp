import type { Arrival, Region, Route, Station, StationRef } from '../types.js';
import { createSeoulAdapter, type SeoulAdapter } from './seoul.js';
import { createGyeonggiAdapter, type GyeonggiAdapter } from './gyeonggi.js';

type Adapter = SeoulAdapter | GyeonggiAdapter;

export interface BusGateway {
  searchStations(query: string): Promise<Station[]>;
  searchRoutes(query: string): Promise<Route[]>;
  getArrivals(stationRef: StationRef, routeId?: string): Promise<Arrival[]>;
}

export function createBusGateway(config: { seoulApiKey: string; gyeonggiApiKey: string }): BusGateway {
  const adapters: Adapter[] = [
    createSeoulAdapter(config.seoulApiKey),
    createGyeonggiAdapter(config.gyeonggiApiKey),
  ];

  function getAdapter(region: Region): Adapter {
    const adapter = adapters.find((a) => a.region === region);
    if (!adapter) throw new Error(`No adapter for region: ${region}`);
    return adapter;
  }

  return {
    async searchStations(query) {
      const results = await Promise.allSettled(adapters.map((a) => a.searchStations(query)));
      return results
        .filter((r): r is PromiseFulfilledResult<Station[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);
    },
    async searchRoutes(query) {
      const results = await Promise.allSettled(adapters.map((a) => a.searchRoutes(query)));
      return results
        .filter((r): r is PromiseFulfilledResult<Route[]> => r.status === 'fulfilled')
        .flatMap((r) => r.value);
    },
    async getArrivals(stationRef, routeId?) {
      const adapter = getAdapter(stationRef.region);
      const arrivals = await adapter.getArrivalsByStation(stationRef);
      if (routeId) return arrivals.filter((a) => a.routeId === routeId);
      return arrivals;
    },
  };
}
