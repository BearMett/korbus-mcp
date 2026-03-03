import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
import type { Arrival, Route, Station, StationRef } from '../types.js';

const BASE_URL = 'http://ws.bus.go.kr/api/rest';

export function createSeoulAdapter(apiKey: string) {
  const client = axios.create({ timeout: 10000 });
  const parser = new XMLParser({ parseTagValue: false });
  const key = decodeURIComponent(apiKey);

  function parseItemList(xml: string): any[] {
    const parsed = parser.parse(xml);
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
        .map((item: any) => ({
          routeId: String(item.busRouteId),
          routeName: String(item.rtNm || item.busRouteAbrv),
          stationId: String(item.stId),
          vehicleId: item.vehId1 ? String(item.vehId1) : undefined,
          arrivalSec: Number(item.exps1 || 0),
          arrivalMsg: String(item.arrmsg1),
        }));
    },
  };
}

export type SeoulAdapter = ReturnType<typeof createSeoulAdapter>;
