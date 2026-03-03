import axios from 'axios';
import type { Arrival, Route, Station, StationRef } from '../types.js';
import { apiKeyError, apiKeyExpiredError, rateLimitError } from '../errors.js';

const BASE_URL = 'https://apis.data.go.kr/6410000';

export function createGyeonggiAdapter(apiKey: string) {
  const client = axios.create({ timeout: 10000 });
  const key = decodeURIComponent(apiKey);

  function extractBody(data: any, bodyKey: string): any[] {
    const header = data?.response?.msgHeader;
    if (header) {
      const code = String(header.resultCode ?? '');
      const msg = String(header.resultMessage ?? '');
      if (code === '20' || code === '30') throw apiKeyError('경기', msg);
      if (code === '21' || code === '31') throw apiKeyExpiredError('경기');
      if (code === '22') throw rateLimitError('경기');
    }
    const body = data?.response?.msgBody;
    if (!body) return [];
    const items = body[bodyKey];
    if (!items) return [];
    return Array.isArray(items) ? items : [items];
  }

  return {
    region: 'GYEONGGI' as const,

    async searchStations(name: string): Promise<Station[]> {
      const res = await client.get(`${BASE_URL}/busstationservice/v2/getBusStationListv2`, {
        params: { keyword: name, serviceKey: key, format: 'json' },
      });
      return extractBody(res.data, 'busStationList').map((item: any) => ({
        id: String(item.stationId),
        name: String(item.stationName),
        region: 'GYEONGGI' as const,
        posX: item.x != null ? Number(item.x) : undefined,
        posY: item.y != null ? Number(item.y) : undefined,
      }));
    },

    async searchRoutes(name: string): Promise<Route[]> {
      const res = await client.get(`${BASE_URL}/busrouteservice/v2/getBusRouteListv2`, {
        params: { keyword: name, serviceKey: key, format: 'json' },
      });
      return extractBody(res.data, 'busRouteList').map((item: any) => ({
        id: String(item.routeId),
        name: String(item.routeName),
        region: 'GYEONGGI' as const,
      }));
    },

    async getArrivalsByStation(stationRef: StationRef): Promise<Arrival[]> {
      const res = await client.get(`${BASE_URL}/busarrivalservice/v2/getBusArrivalListv2`, {
        params: { stationId: stationRef.id, serviceKey: key, format: 'json' },
      });
      return extractBody(res.data, 'busArrivalList').map((item: any) => {
        const predictMinutes = Number(item.predictTime1);
        return {
          routeId: String(item.routeId),
          routeName: String(item.routeName),
          stationId: String(item.stationId),
          vehicleId: item.plateNo1 ? String(item.plateNo1) : undefined,
          arrivalSec: predictMinutes * 60,
          arrivalMsg: `${predictMinutes}분 후 도착`,
        };
      });
    },
  };
}

export type GyeonggiAdapter = ReturnType<typeof createGyeonggiAdapter>;
