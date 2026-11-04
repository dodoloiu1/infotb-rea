import { Capacitor } from '@capacitor/core';
import type {
  ArrivalItem,
  LatLngTuple,
  LineCategory,
  LiveVehicle,
  PlacePoint,
  PlannedItinerary,
  PlannerOptions,
  RouteLeg,
  RouteShapesMap,
  RouteStopStep,
  StaticTransitData,
  StationArrivalsResult,
  StopItem,
  TransitLine,
  TransitNotification
} from '../types';
import {
  buildWeeklySchedule,
  computeBearing,
  formatClock,
  haversineMeters,
  normalizeRo,
  projectMetersAlongPolyline
} from '../utils/geo';
import { computeLocalRoutes } from './raptorRouter';

const TPBI_ORIGIN = 'https://maps.mo-bi.ro';
const STBSA_LINES_URL = 'https://info.stbsa.ro/rp/api/lines';

function getDataBaseUrl(): string {
  const base = import.meta.env.BASE_URL || './';
  return base.endsWith('/') ? base : `${base}/`;
}

function canCallDirectTpbiRest(): boolean {
  return Boolean(Capacitor.isNativePlatform() || import.meta.env.DEV);
}

function tpbiApiUrl(endpointPath: string): string {
  if (import.meta.env.DEV && !Capacitor.isNativePlatform()) {
    return `/tpbi-api${endpointPath}`;
  }
  return `${TPBI_ORIGIN}/api${endpointPath}`;
}

async function fetchJsonWithTimeout<T>(
  url: string,
  init?: RequestInit,
  timeoutMs = 7000
): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

let staticDataPromise: Promise<StaticTransitData> | null = null;
let shapesPromise: Promise<RouteShapesMap> | null = null;
let bundledAlertsPromise: Promise<TransitNotification[]> | null = null;

export function loadStaticTransitData(): Promise<StaticTransitData> {
  if (!staticDataPromise) {
    const base = getDataBaseUrl();
    staticDataPromise = Promise.all([
      fetch(`${base}data/lines.json`).then(r => {
        if (!r.ok) throw new Error('Failed to load lines.json');
        return r.json();
      }),
      fetch(`${base}data/stops.json`).then(r => {
        if (!r.ok) throw new Error('Failed to load stops.json');
        return r.json();
      })
    ]).then(([linesPayload, stopsList]: [{ routeIdToName: Record<string, string>; lines: TransitLine[] }, StopItem[]]) => {
      const lineByName = new Map<string, TransitLine>();
      for (const l of linesPayload.lines) {
        lineByName.set(l.name, l);
      }
      const stopByCode = new Map<string, StopItem>();
      for (const s of stopsList) {
        stopByCode.set(s.c, s);
      }
      return {
        routeIdToName: linesPayload.routeIdToName || {},
        lines: linesPayload.lines || [],
        lineByName,
        stops: stopsList || [],
        stopByCode
      };
    });
  }
  return staticDataPromise;
}

export function loadRouteShapes(): Promise<RouteShapesMap> {
  if (!shapesPromise) {
    const base = getDataBaseUrl();
    shapesPromise = fetch(`${base}data/shapes.json`)
      .then(r => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return shapesPromise;
}

export function loadBundledAlerts(): Promise<TransitNotification[]> {
  if (!bundledAlertsPromise) {
    const base = getDataBaseUrl();
    bundledAlertsPromise = fetch(`${base}data/alerts.json`)
      .then(r => (r.ok ? r.json() : []))
      .catch(() => []);
  }
  return bundledAlertsPromise;
}

// Track previous GPS coordinates per vehicle to compute live heading bearing
const prevVehicleCoords = new Map<string, { lat: number; lng: number; bearing: number | null }>();

function resolveLineNameFromRouteId(
  rawRouteId: string,
  data: StaticTransitData
): string | undefined {
  const rid = String(rawRouteId || '').trim();
  if (!rid) return undefined;
  if (data.routeIdToName[rid]) return data.routeIdToName[rid];
  if (data.lineByName.has(rid)) return rid;
  const pvMatch = rid.match(/_(\d+[A-Z]?)$/i);
  if (pvMatch) {
    const suffix = pvMatch[1];
    if (data.routeIdToName[suffix]) return data.routeIdToName[suffix];
    if (data.lineByName.has(suffix)) return suffix;
  }
  return undefined;
}

interface RawBusDataEntity {
  id?: string;
  vehicle?: {
    trip?: {
      routeId?: string;
      route_id?: string;
      directionId?: number;
      direction_id?: number;
      startTime?: string;
      start_time?: string;
    };
    position?: {
      latitude?: number;
      longitude?: number;
      bearing?: number;
    };
    timestamp?: number;
    vehicle?: {
      id?: string;
      label?: string;
      licensePlate?: string;
      license_plate?: string;
    };
  };
}

/**
 * Fetches live GPS vehicles from TPBI (`https://maps.mo-bi.ro/api/busData`).
 * Supports CORS `*` directly on Web/GitHub Pages AND native Android HTTP.
 */
export async function fetchLiveVehicles(data: StaticTransitData): Promise<LiveVehicle[]> {
  const url = `${TPBI_ORIGIN}/api/busData`;

  const payload = await fetchJsonWithTimeout<RawBusDataEntity[] | { entity?: RawBusDataEntity[] }>(
    url,
    { cache: 'no-store' },
    8500
  );
  const list: RawBusDataEntity[] | null = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.entity)
      ? payload.entity
      : null;

  if (!list) {
    return [];
  }

  const out: LiveVehicle[] = [];
  for (const ent of list) {
    const v = ent.vehicle;
    if (!v?.position) continue;
    const lat = Number(v.position.latitude);
    const lng = Number(v.position.longitude);
    if (!isFinite(lat) || !isFinite(lng) || lat < 44.0 || lat > 45.0 || lng < 25.5 || lng > 26.8) {
      continue;
    }

    const rawRouteId = String(v.trip?.routeId ?? v.trip?.route_id ?? '').trim();
    if (!rawRouteId || /NO_LINE|_000|_999|^PV\d+_$/i.test(rawRouteId)) continue;

    let lineName = resolveLineNameFromRouteId(rawRouteId, data);
    if (!lineName) {
      const m = rawRouteId.match(/^PV\d+_([4]\d{2}[A-Z]?)$/i);
      if (m) lineName = m[1].toUpperCase();
    }
    if (!lineName) continue;

    const line = data.lineByName.get(lineName);
    const rawDir = v.trip?.directionId ?? v.trip?.direction_id;
    const dir: 0 | 1 = Number(rawDir) === 1 ? 1 : 0;
    const vid = String(ent.id || v.vehicle?.id || `${lineName}-${lat}-${lng}`);
    const label = String(v.vehicle?.label || v.vehicle?.id || vid).trim();
    const licensePlate = String(v.vehicle?.licensePlate ?? v.vehicle?.license_plate ?? '').trim();

    let bearing: number | null =
      typeof v.position.bearing === 'number' && isFinite(v.position.bearing)
        ? v.position.bearing
        : null;

    const prev = prevVehicleCoords.get(vid);
    if (prev) {
      const computed = computeBearing(prev.lat, prev.lng, lat, lng);
      bearing = computed !== null ? computed : prev.bearing;
    }
    prevVehicleCoords.set(vid, { lat, lng, bearing });

    out.push({
      id: vid,
      label,
      licensePlate,
      routeId: rawRouteId,
      lineName,
      category: line?.cat || (/^4\d\d/.test(lineName) ? 'REGIONAL' : 'BUS'),
      color: line?.color || '#0070C0',
      direction: dir,
      destination: dir === 0 ? line?.d0.to || 'Tur' : line?.d1.to || 'Retur',
      lat,
      lng,
      bearing,
      timestamp: Number(v.timestamp || Math.floor(Date.now() / 1000)),
      startTime: v.trip?.startTime ?? v.trip?.start_time
    });
  }

  return out;
}

/**
 * Computes the next scheduled departure seconds from `buildWeeklySchedule`
 * so scheduled `*` fallbacks match the station's `Program săptămânal` table.
 */
function nextScheduledArrivalSeconds(
  stopCode: string,
  lineName: string,
  cat: LineCategory
): { firstSec: number; secondSec?: number } {
  const sched = buildWeeklySchedule(stopCode, lineName, cat);
  const now = new Date();
  const dow = now.getDay(); // 0 = Sun, 6 = Sat
  const rows = dow === 0 ? sched.sunday : dow === 6 ? sched.saturday : sched.weekday;
  const nowTotalSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

  const candidateSecs: number[] = [];
  for (const row of rows) {
    const h = parseInt(row.hour, 10);
    if (isNaN(h)) continue;
    for (const mStr of row.minutes) {
      const m = parseInt(mStr, 10);
      if (isNaN(m)) continue;
      let depSec = h * 3600 + m * 60;
      if (depSec < nowTotalSec - 20) {
        depSec += 86400; // tomorrow wrap
      }
      candidateSecs.push(depSec - nowTotalSec);
    }
  }

  candidateSecs.sort((a, b) => a - b);
  const firstSec = candidateSecs[0] ?? 420;
  const secondSec = candidateSecs[1];
  return { firstSec: Math.max(45, firstSec), secondSec };
}

function getSpeedMetersPerSec(cat: LineCategory): number {
  switch (cat) {
    case 'METRO':
      return 9.5;
    case 'TRAM':
      return 5.4;
    case 'TROLLEY':
      return 4.9;
    case 'REGIONAL':
      return 6.8;
    default:
      return 5.2;
  }
}

export function computeArrivalsFromGps(
  stop: StopItem,
  vehicles: LiveVehicle[],
  data: StaticTransitData,
  shapes: RouteShapesMap | null
): StationArrivalsResult {
  const arrivals: ArrivalItem[] = [];

  for (const [lineName, dir, headsign] of stop.l) {
    const line = data.lineByName.get(lineName);
    const cat: LineCategory = line?.cat || stop.m || 'BUS';
    const color = line?.color || '#0070C0';
    const directionName = headsign || (dir === 0 ? line?.d0.to : line?.d1.to) || lineName;

    const poly = shapes?.[lineName]?.[String(dir) as '0' | '1'];
    const matchingVehicles = vehicles.filter(
      v => v.lineName === lineName && v.direction === dir
    );

    const approachingSecs: { sec: number; label: string }[] = [];
    const speedMps = getSpeedMetersPerSec(cat);

    if (poly && poly.length >= 2 && matchingVehicles.length > 0) {
      const stopProj = projectMetersAlongPolyline(stop.lat, stop.lng, poly);
      for (const v of matchingVehicles) {
        const vProj = projectMetersAlongPolyline(v.lat, v.lng, poly);
        if (vProj.perpMeters > 350) continue;
        const deltaMeters = stopProj.along - vProj.along;
        if (deltaMeters >= -55 && deltaMeters <= 15000) {
          const dist = Math.max(0, deltaMeters);
          // Add ~14s dwell penalty per ~420m segment
          const estStops = Math.floor(dist / 420);
          const sec = Math.max(20, Math.round(dist / speedMps + estStops * 13));
          approachingSecs.push({ sec, label: v.label });
        }
      }
    } else if (matchingVehicles.length > 0) {
      for (const v of matchingVehicles) {
        const d = haversineMeters(v.lat, v.lng, stop.lat, stop.lng);
        if (d <= 6000) {
          const sec = Math.max(30, Math.round((d * 1.25) / speedMps));
          approachingSecs.push({ sec, label: v.label });
        }
      }
    }

    approachingSecs.sort((a, b) => a.sec - b.sec);

    if (approachingSecs.length > 0) {
      arrivals.push({
        lineName,
        lineId: line?.id || lineName,
        category: cat,
        color,
        directionName,
        direction: dir,
        arrivingSeconds: approachingSecs[0].sec,
        secondarySeconds: approachingSecs[1]?.sec,
        isTimetable: false,
        vehicleLabel: approachingSecs[0].label
      });
    } else {
      const sched = nextScheduledArrivalSeconds(stop.c, lineName, cat);
      arrivals.push({
        lineName,
        lineId: line?.id || lineName,
        category: cat,
        color,
        directionName,
        direction: dir,
        arrivingSeconds: sched.firstSec,
        secondarySeconds: sched.secondSec,
        isTimetable: true
      });
    }
  }

  arrivals.sort((a, b) => {
    if (a.isTimetable !== b.isTimetable) return a.isTimetable ? 1 : -1;
    return a.arrivingSeconds - b.arrivingSeconds;
  });

  return {
    stationCode: stop.c,
    name: stop.n,
    address: stop.s,
    hasDisability: stop.m === 'METRO' || stop.m === 'TRAM' || stop.m === 'TROLLEY' || stop.m === 'BUS',
    source: 'gps-computed',
    fetchedAt: Date.now(),
    arrivals
  };
}

interface RawTpbiNextArrivals {
  name?: string;
  address?: string;
  lines?: Array<{
    name?: string;
    type?: string;
    color?: string;
    direction?: string;
    arrivingTime?: number;
    isTimetable?: boolean;
  }>;
}

/**
 * Fetches arrivals for a station:
 * - On Android APK (`CapacitorHttp`) and Dev: calls TPBI `/api/nextArrivals/{code}` directly,
 *   enriched with secondary ETA from live GPS if available.
 * - On GitHub Pages (Static Web): uses our live TPBI GPS polyline ETA engine + timetable fallback.
 */
export async function fetchStationArrivals(
  stop: StopItem,
  liveVehicles: LiveVehicle[],
  data: StaticTransitData,
  shapes: RouteShapesMap | null
): Promise<StationArrivalsResult> {
  const gpsComputed = computeArrivalsFromGps(stop, liveVehicles, data, shapes);

  if (canCallDirectTpbiRest() && !stop.c.startsWith('M_')) {
    const raw = await fetchJsonWithTimeout<RawTpbiNextArrivals>(
      tpbiApiUrl(`/nextArrivals/${encodeURIComponent(stop.c)}`),
      undefined,
      5500
    );

    if (raw && Array.isArray(raw.lines) && raw.lines.length > 0) {
      const merged: ArrivalItem[] = raw.lines.map(item => {
        const lName = String(item.name || '').trim();
        const lineObj = data.lineByName.get(lName);
        const gpsMatch = gpsComputed.arrivals.find(g => g.lineName === lName);
        const cat: LineCategory = lineObj?.cat || gpsMatch?.category || 'BUS';
        const color = lineObj?.color || item.color || '#0070C0';
        const arrivingSeconds =
          typeof item.arrivingTime === 'number' && item.arrivingTime >= 0
            ? item.arrivingTime
            : gpsMatch?.arrivingSeconds ?? 300;
        return {
          lineName: lName,
          lineId: lineObj?.id || lName,
          category: cat,
          color,
          directionName: String(item.direction || gpsMatch?.directionName || ''),
          direction: gpsMatch?.direction ?? 0,
          arrivingSeconds,
          secondarySeconds: gpsMatch?.secondarySeconds,
          isTimetable: Boolean(item.isTimetable),
          vehicleLabel: gpsMatch?.vehicleLabel
        };
      });

      merged.sort((a, b) => {
        if (a.isTimetable !== b.isTimetable) return a.isTimetable ? 1 : -1;
        return a.arrivingSeconds - b.arrivingSeconds;
      });

      return {
        stationCode: stop.c,
        name: raw.name || stop.n,
        address: raw.address || stop.s,
        hasDisability: true,
        source: 'tpbi-live',
        fetchedAt: Date.now(),
        arrivals: merged
      };
    }
  }

  return gpsComputed;
}

interface RawTpbiRouteResponse {
  routes?: Array<{
    duration?: number;
    walkDistance?: number;
    startTime?: string | number;
    endTime?: string | number;
    legs?: Array<{
      mode?: string;
      routeShortName?: string;
      routeColor?: string;
      headsign?: string;
      from?: { name?: string; lat?: number; lon?: number; stopCode?: string };
      to?: { name?: string; lat?: number; lon?: number; stopCode?: string };
      distance?: number;
      duration?: number;
      startTime?: string | number;
      endTime?: string | number;
      intermediateStops?: Array<{ name?: string; lat?: number; lon?: number; stopCode?: string }>;
      legGeometry?: { points?: string } | Array<[number, number]>;
    }>;
  }>;
}

function decodeGooglePolyline(encoded: string): LatLngTuple[] {
  const poly: LatLngTuple[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    poly.push([lat / 1e5, lng / 1e5]);
  }
  return poly;
}

/**
 * Plans optimal multimodal transit routes between `from` and `to`.
 * Calls TPBI `/api/Route` on Android APK / Dev when all modes are enabled,
 * and falls back seamlessly to `computeLocalRoutes` (RAPTOR) on GitHub Pages or custom mode filters.
 */
export async function planTransitRoute(
  from: PlacePoint,
  to: PlacePoint,
  options: PlannerOptions,
  data: StaticTransitData,
  shapes: RouteShapesMap | null
): Promise<PlannedItinerary[]> {
  const allModesOn =
    options.allowedModes.TRAM &&
    options.allowedModes.TROLLEY &&
    options.allowedModes.BUS &&
    options.allowedModes.METRO;

  if (canCallDirectTpbiRest() && allModesOn && options.useCurrentTime) {
    const qs = new URLSearchParams({
      FromLat: String(from.lat),
      FromLng: String(from.lng),
      ToLat: String(to.lat),
      ToLng: String(to.lng)
    });
    const raw = await fetchJsonWithTimeout<RawTpbiRouteResponse>(
      tpbiApiUrl(`/Route?${qs.toString()}`),
      undefined,
      6500
    );

    const rawItins = Array.isArray(raw?.routes)
      ? raw!.routes!
      : Array.isArray((raw as unknown as { plan?: { itineraries?: RawTpbiRouteResponse['routes'] } })?.plan?.itineraries)
        ? (raw as unknown as { plan: { itineraries: NonNullable<RawTpbiRouteResponse['routes']> } }).plan.itineraries
        : null;

    if (rawItins && rawItins.length > 0) {
      const parsed: PlannedItinerary[] = [];
      for (let idx = 0; idx < rawItins.length; idx++) {
        const it = rawItins[idx];
        if (!Array.isArray(it.legs) || it.legs.length === 0) continue;

        const legs: RouteLeg[] = [];
        let walkSum = 0;

        for (const lg of it.legs) {
          const modeUpper = String(lg.mode || 'WALK').toUpperCase();
          const isWalk = modeUpper === 'WALK' || modeUpper === 'FOOT';
          const fLat = Number(lg.from?.lat ?? from.lat);
          const fLng = Number(lg.from?.lon ?? from.lng);
          const tLat = Number(lg.to?.lat ?? to.lat);
          const tLng = Number(lg.to?.lon ?? to.lng);

          let geom: LatLngTuple[] = [
            [fLat, fLng],
            [tLat, tLng]
          ];
          if (Array.isArray(lg.legGeometry) && lg.legGeometry.length >= 2) {
            geom = lg.legGeometry.map(([a, b]) => (a > 40 ? [a, b] : [b, a]));
          } else if (
            lg.legGeometry &&
            typeof (lg.legGeometry as { points?: string }).points === 'string'
          ) {
            const dec = decodeGooglePolyline((lg.legGeometry as { points: string }).points);
            if (dec.length >= 2) geom = dec;
          }

          const distM = Math.round(Number(lg.distance || haversineMeters(fLat, fLng, tLat, tLng)));
          const durS = Math.max(30, Math.round(Number(lg.duration || distM / 1.25)));

          if (isWalk) {
            walkSum += distM;
            legs.push({
              type: 'walk',
              fromName: lg.from?.name || from.label,
              toName: lg.to?.name || to.label,
              distanceMeters: distM,
              durationSeconds: durS,
              departureTime: lg.startTime ? formatClock(new Date(lg.startTime)) : undefined,
              arrivalTime: lg.endTime ? formatClock(new Date(lg.endTime)) : undefined,
              stops: [],
              geometry: geom
            });
          } else {
            const lName = String(lg.routeShortName || modeUpper).trim();
            const lineObj = data.lineByName.get(lName);
            const stopsList: RouteStopStep[] = [
              {
                code: lg.from?.stopCode,
                name: lg.from?.name || '',
                lat: fLat,
                lng: fLng,
                time: lg.startTime ? formatClock(new Date(lg.startTime)) : undefined
              },
              ...(lg.intermediateStops || []).map(is => ({
                code: is.stopCode,
                name: is.name || '',
                lat: Number(is.lat ?? fLat),
                lng: Number(is.lon ?? fLng)
              })),
              {
                code: lg.to?.stopCode,
                name: lg.to?.name || '',
                lat: tLat,
                lng: tLng,
                time: lg.endTime ? formatClock(new Date(lg.endTime)) : undefined
              }
            ];

            legs.push({
              type: 'pt',
              lineName: lName,
              category: lineObj?.cat || (modeUpper.includes('SUBWAY') || modeUpper.includes('METRO') ? 'METRO' : modeUpper.includes('TRAM') ? 'TRAM' : 'BUS'),
              color: lineObj?.color || (lg.routeColor ? `#${lg.routeColor.replace('#', '')}` : '#0070C0'),
              headsign: lg.headsign || lineObj?.d0.to || '',
              fromName: lg.from?.name || '',
              toName: lg.to?.name || '',
              distanceMeters: distM,
              durationSeconds: durS,
              departureTime: lg.startTime ? formatClock(new Date(lg.startTime)) : undefined,
              arrivalTime: lg.endTime ? formatClock(new Date(lg.endTime)) : undefined,
              hasDisability: true,
              stops: stopsList,
              geometry: geom
            });
          }
        }

        if (walkSum > options.maxWalkMeters * 1.8) continue;
        const ptCount = legs.filter(l => l.type === 'pt').length;
        const totalDur = Number(it.duration) || legs.reduce((acc, l) => acc + l.durationSeconds, 0);

        parsed.push({
          id: `tpbi-route-${idx}`,
          durationSeconds: totalDur,
          walkMeters: Math.round(Number(it.walkDistance ?? walkSum)),
          transfers: Math.max(0, ptCount - 1),
          leavesInSeconds: 180,
          departureTime: it.startTime ? formatClock(new Date(it.startTime)) : legs[0]?.departureTime || formatClock(new Date()),
          arrivalTime: it.endTime ? formatClock(new Date(it.endTime)) : legs[legs.length - 1]?.arrivalTime || '',
          legs,
          source: 'tpbi-router'
        });
      }

      if (parsed.length > 0) {
        return parsed.slice(0, 4);
      }
    }
  }

  return computeLocalRoutes(from, to, options, data, shapes);
}

export interface SearchSuggestionsResult {
  stops: StopItem[];
  lines: TransitLine[];
  places: PlacePoint[];
}

/**
 * Searches stops, lines, and geocoded Bucharest/Ilfov addresses.
 */
export async function searchPlacesAndStops(
  query: string,
  data: StaticTransitData
): Promise<SearchSuggestionsResult> {
  const qNorm = normalizeRo(query);
  if (!qNorm) {
    return { stops: [], lines: [], places: [] };
  }

  // 1. Match lines instantly
  const matchedLines = data.lines
    .filter(l => {
      const n = normalizeRo(l.name);
      return (
        n === qNorm ||
        n.startsWith(qNorm) ||
        normalizeRo(l.d0.to).includes(qNorm) ||
        normalizeRo(l.d1.to).includes(qNorm)
      );
    })
    .sort((a, b) => {
      const aExact = normalizeRo(a.name) === qNorm ? 0 : 1;
      const bExact = normalizeRo(b.name) === qNorm ? 0 : 1;
      return aExact - bExact;
    })
    .slice(0, 6);

  // 2. Match stops (deduplicate close twin stops only in search dropdown or show street/code clearly)
  const matchedStops = data.stops
    .filter(s => {
      const n = normalizeRo(s.n);
      const st = normalizeRo(s.s);
      return n.includes(qNorm) || st.includes(qNorm) || s.c.toLowerCase() === qNorm;
    })
    .sort((a, b) => {
      const aStarts = normalizeRo(a.n).startsWith(qNorm) ? 0 : 1;
      const bStarts = normalizeRo(b.n).startsWith(qNorm) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return b.l.length - a.l.length;
    })
    .slice(0, 8);

  // 3. Geocode addresses if query >= 3 chars
  const places: PlacePoint[] = [];
  if (qNorm.length >= 3) {
    if (canCallDirectTpbiRest()) {
      const tpbiPlaces = await fetchJsonWithTimeout<
        Array<{ name?: string; address?: string; lat?: number; lng?: number; lon?: number }>
      >(tpbiApiUrl(`/searchPlace?text=${encodeURIComponent(query.trim())}`), undefined, 4000);
      if (Array.isArray(tpbiPlaces)) {
        for (const p of tpbiPlaces.slice(0, 5)) {
          const lat = Number(p.lat);
          const lng = Number(p.lng ?? p.lon);
          if (isFinite(lat) && isFinite(lng)) {
            places.push({
              id: `tpbi-place-${lat}-${lng}`,
              label: p.name || p.address || query,
              sublabel: p.address || 'București / Ilfov',
              lat,
              lng
            });
          }
        }
      }
    }

    if (places.length === 0) {
      // OpenStreetMap Nominatim supports Access-Control-Allow-Origin: * on GitHub Pages
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ro&viewbox=25.85,44.62,26.38,44.28&bounded=1&q=${encodeURIComponent(
        query.trim()
      )}`;
      const nom = await fetchJsonWithTimeout<
        Array<{ place_id?: number; display_name?: string; lat?: string; lon?: string }>
      >(nomUrl, { headers: { 'Accept-Language': 'ro,en' } }, 4500);
      if (Array.isArray(nom)) {
        for (const item of nom) {
          const lat = Number(item.lat);
          const lng = Number(item.lon);
          if (!isFinite(lat) || !isFinite(lng)) continue;
          const parts = String(item.display_name || '').split(',');
          const title = parts[0]?.trim() || query;
          const sub = parts.slice(1, 4).join(',').trim();
          places.push({
            id: `nom-${item.place_id || `${lat}-${lng}`}`,
            label: title,
            sublabel: sub || 'București',
            lat,
            lng
          });
        }
      }
    }
  }

  return { stops: matchedStops, lines: matchedLines, places };
}

/**
 * Loads live STB/TPBI transit notifications:
 * 1. Refreshes `has_notifications` live from `https://info.stbsa.ro/rp/api/lines` (CORS `*`).
 * 2. On Android/Dev, fetches live TPBI `/api/alertdata`.
 * 3. Merges bundled `alerts.json` snapshot for instant zero-fail display.
 */
export async function fetchTransitNotifications(
  data: StaticTransitData
): Promise<TransitNotification[]> {
  const bundled = await loadBundledAlerts();
  const byId = new Map<string, TransitNotification>();

  for (const b of bundled) {
    byId.set(b.id, b);
  }

  // Live STB lines notification flags (ACAO: *)
  const liveLinesRes = await fetchJsonWithTimeout<{
    lines?: Array<{ name?: string; color?: string; has_notifications?: boolean }>;
  }>(STBSA_LINES_URL, undefined, 5000);

  if (Array.isArray(liveLinesRes?.lines)) {
    const nowIso = new Date().toISOString();
    for (const rawLine of liveLinesRes.lines) {
      if (!rawLine.has_notifications || !rawLine.name) continue;
      const lName = String(rawLine.name).trim();
      const lineObj = data.lineByName.get(lName);
      const id = `stb-line-${lName}`;
      if (!byId.has(id)) {
        const ends = lineObj ? ` (${lineObj.d0.to} ↔ ${lineObj.d1.to})` : '';
        byId.set(id, {
          id,
          lineName: lName,
          lineColor: lineObj?.color || rawLine.color || '#33AA44',
          category: lineObj?.cat,
          createdAt: nowIso,
          titleRo: `Informare operativă — Linia ${lName}`,
          titleEn: `Service notice — Line ${lName}`,
          messageRo: `Circulația pe linia ${lName}${ends} prezintă modificări operative sau intervale adaptate condițiilor de trafic anunțate de TPBI / STB.`,
          messageEn: `Service on line ${lName}${ends} has operational adjustments or traffic-adapted headways announced by TPBI / STB.`
        });
      }
    }
  }

  // Live TPBI alertdata on Android APK / Vite Dev
  if (canCallDirectTpbiRest()) {
    const alertGeo = await fetchJsonWithTimeout<{
      features?: Array<{
        id?: string;
        properties?: Record<string, unknown>;
        geometry?: { coordinates?: [number, number] };
      }>;
    }>(tpbiApiUrl('/alertdata'), undefined, 5000);

    if (Array.isArray(alertGeo?.features)) {
      const nowIso = new Date().toISOString();
      for (const f of alertGeo.features.slice(0, 20)) {
        const p = f.properties || {};
        const street = p.street ? String(p.street) : '';
        const desc = p.description ? String(p.description) : street;
        if (!desc) continue;
        const id = String(f.id || p.uuid || `tpbi-live-${street}`);
        if (byId.has(id)) continue;
        byId.set(id, {
          id,
          lineName: 'TPBI',
          lineColor: '#33AA44',
          createdAt: nowIso,
          titleRo: `Atenționare trafic${street ? ' — ' + street : ''}`,
          titleEn: `Traffic alert${street ? ' — ' + street : ''}`,
          messageRo: desc,
          messageEn: desc,
          lat: typeof p.lat === 'number' ? p.lat : f.geometry?.coordinates?.[1],
          lng: typeof p.lon === 'number' ? p.lon : f.geometry?.coordinates?.[0]
        });
      }
    }
  }

  return [...byId.values()];
}
