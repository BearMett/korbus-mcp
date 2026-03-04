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
        arsId: item.mobileNo ? String(item.mobileNo) : undefined,
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
      // 경기 API는 자체 메시지 필드가 없고 predictTime1(예측 분)만 제공.
      // 빈 값이면 Number("")=0 → "0분 후 도착" 버그가 발생하므로 직접 필터링.
      return extractBody(res.data, 'busArrivalList').map((item: any) => {
        const pt = item.predictTime1;
        const hasPrediction = pt !== '' && pt !== undefined && pt !== null;
        const predictMinutes = hasPrediction ? Number(pt) : 0;
        return {
          routeId: String(item.routeId),
          routeName: String(item.routeName),
          stationId: String(item.stationId),
          vehicleId: item.plateNo1 ? String(item.plateNo1) : undefined,
          direction: item.routeDestName ? String(item.routeDestName) : undefined,
          arrivalSec: hasPrediction ? predictMinutes * 60 : -1,
          arrivalMsg: hasPrediction ? `${predictMinutes}분 후 도착` : '도착 정보 없음',
        };
      });
    },
  };
}

export type GyeonggiAdapter = ReturnType<typeof createGyeonggiAdapter>;
