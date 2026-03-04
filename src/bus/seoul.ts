import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import type { Arrival, Route, Station, StationRef } from '../types.js';
import { apiKeyError, apiKeyExpiredError, rateLimitError } from '../errors.js';

const BASE_URL = 'http://ws.bus.go.kr/api/rest';

export function createSeoulAdapter(apiKey: string) {
  const client = axios.create({ timeout: 10000 });
  const parser = new XMLParser({ parseTagValue: false });
  const key = decodeURIComponent(apiKey);

  function parseItemList(xml: string): any[] {
    const parsed = parser.parse(xml);
    const header = parsed?.ServiceResult?.msgHeader;
    if (header) {
      const code = String(header.headerCd);
      const msg = String(header.headerMsg ?? '');
      if (code === '3') throw apiKeyError('서울', msg);
      if (code === '4') return []; // "결과가 없습니다" – empty result, not an error
      if (code === '5') throw apiKeyExpiredError('서울');
      if (code === '8') throw rateLimitError('서울');
    }
    const itemList = parsed?.ServiceResult?.msgBody?.itemList;
    if (!itemList) return [];
    return Array.isArray(itemList) ? itemList : [itemList];
  }

  return {
    region: 'SEOUL' as const,

    async searchStations(name: string): Promise<Station[]> {
      const res = await client.get(`${BASE_URL}/stationinfo/getStationByName`, {
        params: { stSrch: name, serviceKey: key },
      });
      return parseItemList(res.data).map((item: any) => ({
        id: String(item.stId),
        arsId: item.arsId ? String(item.arsId) : undefined,
        name: String(item.stNm),
        region: 'SEOUL' as const,
        posX: item.tmX ? Number(item.tmX) : undefined,
        posY: item.tmY ? Number(item.tmY) : undefined,
      }));
    },

    async searchRoutes(name: string): Promise<Route[]> {
      const res = await client.get(`${BASE_URL}/busRouteInfo/getBusRouteList`, {
        params: { strSrch: name, serviceKey: key },
      });
      return parseItemList(res.data).map((item: any) => ({
        id: String(item.busRouteId),
        name: String(item.busRouteNm),
        region: 'SEOUL' as const,
      }));
    },

    async getArrivalsByStation(stationRef: StationRef): Promise<Arrival[]> {
      const res = await client.get(`${BASE_URL}/arrive/getLowArrInfoByStId`, {
        params: { stId: stationRef.id, serviceKey: key },
      });
      return parseItemList(res.data)
        .filter((item: any) => {
          const msg = String(item.arrmsg1 || '');
          return msg !== '운행종료' && msg !== '출발대기';
        })
        .map((item: any) => {
          // 서울 API는 arrmsg1(텍스트 메시지)과 exps1(예측 초)을 독립적으로 제공.
          // exps1이 비어있어도 arrmsg1에 "곧 도착" 등 유효 메시지가 올 수 있으므로
          // arrivalMsg는 arrmsg1을 우선 사용하고, arrivalSec만 hasPrediction으로 제어.
          const rawSec = item.exps1;
          const hasPrediction = rawSec !== undefined && rawSec !== null && String(rawSec) !== '';
          return {
            routeId: String(item.busRouteId),
            routeName: String(item.rtNm || item.busRouteAbrv),
            stationId: String(item.stId),
            vehicleId: item.vehId1 ? String(item.vehId1) : undefined,
            direction: item.dir ? String(item.dir) : undefined,
            arrivalSec: hasPrediction ? Number(rawSec) : -1,
            arrivalMsg: item.arrmsg1 ? String(item.arrmsg1) : '도착 정보 없음',
          };
        });
    },
  };
}

export type SeoulAdapter = ReturnType<typeof createSeoulAdapter>;
