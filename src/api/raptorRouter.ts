import type {
  LineCategory,
  PlacePoint,
  PlannedItinerary,
  PlannerOptions,
  RouteLeg,
  RouteShapesMap,
  RouteStopStep,
  StaticTransitData,
  StopItem,
  TransitLine
} from '../types';
import { formatClock, haversineMeters, slicePolylineBetween } from '../utils/geo';

const WALK_SPEED_MPS = 1.25; // ~4.5 km/h

function getModeSpeedSecondsPerStop(cat: LineCategory): number {
  switch (cat) {
    case 'METRO':
      return 115;
    case 'TRAM':
      return 100;
    case 'TROLLEY':
      return 110;
    default:
      return 115;
  }
}

function getWaitPenaltySeconds(cat: LineCategory): number {
  switch (cat) {
    case 'METRO':
      return 180;
    case 'TRAM':
      return 240;
    case 'TROLLEY':
      return 270;
    case 'REGIONAL':
      return 480;
    default:
      return 300;
  }
}

function isModeAllowed(cat: LineCategory, options: PlannerOptions): boolean {
  if (cat === 'TRAM') return options.allowedModes.TRAM;
  if (cat === 'TROLLEY') return options.allowedModes.TROLLEY;
  if (cat === 'METRO') return options.allowedModes.METRO;
  return options.allowedModes.BUS; // BUS, REGIONAL, NIGHT
}

function computeBaseDepartureDate(options: PlannerOptions): Date {
  if (options.useCurrentTime) {
    return new Date();
  }
  const [y, m, d] = options.startDateIso.split('-').map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d, options.startHour, options.startMinute, 0, 0);
}

interface TransferMap {
  byStop: Map<string, { code: string; meters: number }[]>;
}

let cachedTransfers: TransferMap | null = null;
let cachedStopsCount = 0;

function ensureTransferIndex(stops: StopItem[]): Map<string, { code: string; meters: number }[]> {
  if (cachedTransfers && cachedStopsCount === stops.length) {
    return cachedTransfers.byStop;
  }

  // Bucket stops into ~350m grid cells for fast spatial lookup
  const cellLat = 0.0032;
  const cellLng = 0.0045;
  const grid = new Map<string, StopItem[]>();
  for (const s of stops) {
    const gy = Math.floor(s.lat / cellLat);
    const gx = Math.floor(s.lng / cellLng);
    const key = `${gy}:${gx}`;
    const arr = grid.get(key);
    if (arr) arr.push(s);
    else grid.set(key, [s]);
  }

  const byStop = new Map<string, { code: string; meters: number }[]>();
  for (const s of stops) {
    const gy = Math.floor(s.lat / cellLat);
    const gx = Math.floor(s.lng / cellLng);
    const near: { code: string; meters: number }[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = grid.get(`${gy + dy}:${gx + dx}`);
        if (!bucket) continue;
        for (const other of bucket) {
          if (other.c === s.c) continue;
          const m = haversineMeters(s.lat, s.lng, other.lat, other.lng);
          if (m <= 360) {
            near.push({ code: other.c, meters: m });
          }
        }
      }
    }
    near.sort((a, b) => a.meters - b.meters);
    byStop.set(s.c, near.slice(0, 12));
  }

  cachedTransfers = { byStop };
  cachedStopsCount = stops.length;
  return byStop;
}

interface ParentStep {
  kind: 'walk-origin' | 'ride' | 'transfer';
  prevStop?: string;
  line?: TransitLine;
  dir?: 0 | 1;
  boardIdx?: number;
  alightIdx?: number;
  walkMeters: number;
  arrSec: number;
}

export function computeLocalRoutes(
  from: PlacePoint,
  to: PlacePoint,
  options: PlannerOptions,
  data: StaticTransitData,
  shapes: RouteShapesMap | null
): PlannedItinerary[] {
  const baseDate = computeBaseDepartureDate(options);
  const baseMs = baseDate.getTime();
  const maxWalk = Math.max(250, options.maxWalkMeters || 900);

  const results: PlannedItinerary[] = [];
  const directMeters = haversineMeters(from.lat, from.lng, to.lat, to.lng);

  // Include pure walk option when destination is within maxWalkMeters * 1.4 or <= 1500m
  if (directMeters <= Math.max(1200, maxWalk)) {
    const walkSec = Math.max(60, Math.round((directMeters * 1.18) / WALK_SPEED_MPS));
    const depIso = new Date(baseMs).toISOString();
    const arrIso = new Date(baseMs + walkSec * 1000).toISOString();
    results.push({
      id: 'local-walk-direct',
      durationSeconds: walkSec,
      walkMeters: Math.round(directMeters * 1.18),
      transfers: 0,
      leavesInSeconds: 0,
      departureTime: formatClock(depIso),
      arrivalTime: formatClock(arrIso),
      source: 'local-router',
      legs: [
        {
          type: 'walk',
          fromName: from.label,
          toName: to.label,
          distanceMeters: Math.round(directMeters * 1.18),
          durationSeconds: walkSec,
          departureTime: formatClock(depIso),
          arrivalTime: formatClock(arrIso),
          stops: [],
          geometry: [
            [from.lat, from.lng],
            [to.lat, to.lng]
          ]
        }
      ]
    });
  }

  // Filter eligible lines
  const activeLines = data.lines.filter(l => {
    if (!isModeAllowed(l.cat, options)) return false;
    return l.d0.stops.length >= 2 || l.d1.stops.length >= 2;
  });

  if (activeLines.length === 0) {
    return results;
  }

  // Build stop -> [(line, dir, stopIdx)] index
  const stopRoutes = new Map<string, { line: TransitLine; dir: 0 | 1; idx: number }[]>();
  for (const line of activeLines) {
    ([0, 1] as const).forEach(dir => {
      const stopCodes = dir === 0 ? line.d0.stops : line.d1.stops;
      for (let i = 0; i < stopCodes.length; i++) {
        const code = stopCodes[i];
        let list = stopRoutes.get(code);
        if (!list) {
          list = [];
          stopRoutes.set(code, list);
        }
        list.push({ line, dir, idx: i });
      }
    });
  }

  // Find candidate origin & destination stops within walking threshold (expand slightly if sparse)
  const findNearStops = (lat: number, lng: number, limitMeters: number): { stop: StopItem; meters: number }[] => {
    const found: { stop: StopItem; meters: number }[] = [];
    for (const s of data.stops) {
      if (!stopRoutes.has(s.c)) continue;
      const m = haversineMeters(lat, lng, s.lat, s.lng);
      if (m <= limitMeters) {
        found.push({ stop: s, meters: m });
      }
    }
    found.sort((a, b) => a.meters - b.meters);
    return found;
  };

  let originStops = findNearStops(from.lat, from.lng, maxWalk);
  if (originStops.length === 0) originStops = findNearStops(from.lat, from.lng, 2200).slice(0, 12);
  else originStops = originStops.slice(0, 22);

  let destStops = findNearStops(to.lat, to.lng, maxWalk);
  if (destStops.length === 0) destStops = findNearStops(to.lat, to.lng, 2200).slice(0, 12);
  else destStops = destStops.slice(0, 22);

  if (originStops.length === 0 || destStops.length === 0) {
    return results;
  }

  const destWalkByCode = new Map<string, number>();
  for (const ds of destStops) {
    destWalkByCode.set(ds.stop.c, ds.meters);
  }

  const transferIdx = ensureTransferIndex(data.stops);

  // Run RAPTOR for up to 3 transit rounds (0, 1, 2 transfers) and collect distinct line signatures
  const MAX_ROUNDS = 3;
  const bestArrByRound: Map<string, number>[] = [];
  const parentByRound: Map<string, ParentStep>[] = [];

  const r0 = new Map<string, number>();
  const p0 = new Map<string, ParentStep>();
  let marked = new Set<string>();

  for (const os of originStops) {
    const walkSec = Math.round((os.meters * 1.18) / WALK_SPEED_MPS);
    r0.set(os.stop.c, walkSec);
    p0.set(os.stop.c, {
      kind: 'walk-origin',
      walkMeters: Math.round(os.meters * 1.18),
      arrSec: walkSec
    });
    marked.add(os.stop.c);
  }
  bestArrByRound.push(r0);
  parentByRound.push(p0);

  const globalBest = new Map<string, number>(r0);

  for (let k = 1; k <= MAX_ROUNDS; k++) {
    const prevArr = bestArrByRound[k - 1];
    const curArr = new Map<string, number>(prevArr);
    const curParent = new Map<string, ParentStep>();
    const nextMarked = new Set<string>();

    // Collect routes to scan from marked stops
    const routesToScan = new Map<string, { line: TransitLine; dir: 0 | 1; startIdx: number }>();
    for (const stopCode of marked) {
      const entries = stopRoutes.get(stopCode);
      if (!entries) continue;
      for (const e of entries) {
        const rKey = `${e.line.name}:${e.dir}`;
        const existing = routesToScan.get(rKey);
        if (!existing || e.idx < existing.startIdx) {
          routesToScan.set(rKey, { line: e.line, dir: e.dir, startIdx: e.idx });
        }
      }
    }

    // Traverse each route
    for (const { line, dir, startIdx } of routesToScan.values()) {
      const stopCodes = dir === 0 ? line.d0.stops : line.d1.stops;
      const waitSec = getWaitPenaltySeconds(line.cat) + (k > 1 ? 90 : 0);
      const secPerStop = getModeSpeedSecondsPerStop(line.cat);

      let boardStopCode: string | null = null;
      let boardIdx = -1;
      let boardDepSec = Infinity;

      for (let i = startIdx; i < stopCodes.length; i++) {
        const sc = stopCodes[i];
        if (boardStopCode !== null) {
          const arrSec = boardDepSec + (i - boardIdx) * secPerStop;
          const prevBest = globalBest.get(sc) ?? Infinity;
          if (arrSec + 15 < prevBest) {
            curArr.set(sc, arrSec);
            globalBest.set(sc, arrSec);
            curParent.set(sc, {
              kind: 'ride',
              prevStop: boardStopCode,
              line,
              dir,
              boardIdx,
              alightIdx: i,
              walkMeters: 0,
              arrSec
            });
            nextMarked.add(sc);
          }
        }

        const candReady = prevArr.get(sc);
        if (candReady !== undefined) {
          const candDep = candReady + waitSec;
          if (boardStopCode === null || candDep < boardDepSec + (i - boardIdx) * secPerStop) {
            boardStopCode = sc;
            boardIdx = i;
            boardDepSec = candDep;
          }
        }
      }
    }

    // Footpath transfers from newly improved stops
    const rideImproved = [...nextMarked];
    for (const sc of rideImproved) {
      const baseSec = curArr.get(sc)!;
      const nearList = transferIdx.get(sc);
      if (!nearList) continue;
      for (const tr of nearList) {
        if (tr.meters > maxWalk) continue;
        const trWalkSec = Math.round((tr.meters * 1.18) / WALK_SPEED_MPS) + 35;
        const candSec = baseSec + trWalkSec;
        const prevBest = globalBest.get(tr.code) ?? Infinity;
        if (candSec + 15 < prevBest) {
          curArr.set(tr.code, candSec);
          globalBest.set(tr.code, candSec);
          curParent.set(tr.code, {
            kind: 'transfer',
            prevStop: sc,
            walkMeters: Math.round(tr.meters * 1.18),
            arrSec: candSec
          });
          nextMarked.add(tr.code);
        }
      }
    }

    bestArrByRound.push(curArr);
    parentByRound.push(curParent);
    marked = nextMarked;
    if (marked.size === 0) break;
  }

  // Reconstruct best itineraries across rounds and destination stops
  interface RawCandidate {
    totalSec: number;
    endStopCode: string;
    round: number;
  }
  const rawCandidates: RawCandidate[] = [];

  for (let k = 1; k < bestArrByRound.length; k++) {
    const arrMap = bestArrByRound[k];
    const pMap = parentByRound[k];
    for (const [destCode, egoMeters] of destWalkByCode.entries()) {
      if (!pMap.has(destCode)) continue;
      const stopArr = arrMap.get(destCode);
      if (stopArr === undefined) continue;
      const egoSec = Math.round((egoMeters * 1.18) / WALK_SPEED_MPS);
      rawCandidates.push({
        totalSec: stopArr + egoSec,
        endStopCode: destCode,
        round: k
      });
    }
  }

  rawCandidates.sort((a, b) => a.totalSec - b.totalSec);

  const seenSignatures = new Set<string>();

  for (const cand of rawCandidates) {
    if (results.length >= 4) break;

    // Backtrack steps
    const steps: ParentStep[] = [];
    let curStop: string | undefined = cand.endStopCode;
    let curRound = cand.round;
    let guard = 0;

    while (curStop && curRound >= 0 && guard++ < 12) {
      let step = parentByRound[curRound]?.get(curStop);
      while (!step && curRound > 0) {
        curRound--;
        step = parentByRound[curRound]?.get(curStop);
      }
      if (!step) break;
      steps.push(step);
      if (step.kind === 'walk-origin') {
        break;
      } else if (step.kind === 'transfer') {
        curStop = step.prevStop;
      } else if (step.kind === 'ride') {
        curStop = step.prevStop;
        curRound--;
      }
    }

    steps.reverse();
    const rideSteps = steps.filter(s => s.kind === 'ride' && s.line);
    if (rideSteps.length === 0) continue;

    const sig = rideSteps.map(s => `${s.line!.name}`).join('>');
    if (seenSignatures.has(sig)) continue;
    seenSignatures.add(sig);

    // Build RouteLeg[] cleanly
    const legs: RouteLeg[] = [];
    let totalWalkMeters = 0;
    let cursorSec = 0;
    let firstTransitWaitSec = 180;

    for (let si = 0; si < steps.length; si++) {
      const st = steps[si];
      if (st.kind === 'walk-origin') {
        const nextRide = steps[si + 1];
        const firstBoardCode = nextRide?.prevStop;
        const firstBoardStop = firstBoardCode ? data.stopByCode.get(firstBoardCode) : undefined;
        if (firstBoardStop && st.walkMeters >= 20) {
          const wSec = Math.max(30, st.arrSec);
          const depIso = new Date(baseMs + cursorSec * 1000).toISOString();
          const arrIso = new Date(baseMs + (cursorSec + wSec) * 1000).toISOString();
          legs.push({
            type: 'walk',
            fromName: from.label,
            toName: firstBoardStop.n,
            distanceMeters: st.walkMeters,
            durationSeconds: wSec,
            departureTime: formatClock(depIso),
            arrivalTime: formatClock(arrIso),
            stops: [],
            geometry: [
              [from.lat, from.lng],
              [firstBoardStop.lat, firstBoardStop.lng]
            ]
          });
          totalWalkMeters += st.walkMeters;
        }
        cursorSec = st.arrSec;
      } else if (st.kind === 'transfer' && st.prevStop) {
        const fromStop = data.stopByCode.get(st.prevStop);
        const nextRide = steps[si + 1];
        const toCode = nextRide?.prevStop;
        const toStop = toCode ? data.stopByCode.get(toCode) : undefined;
        const wSec = Math.max(30, st.arrSec - cursorSec);
        if (fromStop && toStop && st.walkMeters >= 15) {
          const depIso = new Date(baseMs + cursorSec * 1000).toISOString();
          const arrIso = new Date(baseMs + st.arrSec * 1000).toISOString();
          legs.push({
            type: 'walk',
            fromName: fromStop.n,
            toName: toStop.n,
            distanceMeters: st.walkMeters,
            durationSeconds: wSec,
            departureTime: formatClock(depIso),
            arrivalTime: formatClock(arrIso),
            stops: [],
            geometry: [
              [fromStop.lat, fromStop.lng],
              [toStop.lat, toStop.lng]
            ]
          });
          totalWalkMeters += st.walkMeters;
        }
        cursorSec = st.arrSec;
      } else if (
        st.kind === 'ride' &&
        st.line &&
        st.dir !== undefined &&
        st.boardIdx !== undefined &&
        st.alightIdx !== undefined
      ) {
        const dirObj = st.dir === 0 ? st.line.d0 : st.line.d1;
        const seqCodes = dirObj.stops.slice(st.boardIdx, st.alightIdx + 1);
        const seqStops: RouteStopStep[] = [];
        for (const c of seqCodes) {
          const item = data.stopByCode.get(c);
          if (item) {
            seqStops.push({
              code: item.c,
              name: item.n,
              lat: item.lat,
              lng: item.lng
            });
          }
        }
        if (seqStops.length < 2) continue;

        const secPerStop = getModeSpeedSecondsPerStop(st.line.cat);
        const rideSec = Math.max(60, (seqStops.length - 1) * secPerStop);
        const depSec = Math.max(cursorSec + 60, st.arrSec - rideSec);
        if (legs.every(l => l.type !== 'pt')) {
          firstTransitWaitSec = Math.max(60, depSec - cursorSec);
        }

        // Populate intermediate stop times
        for (let idx = 0; idx < seqStops.length; idx++) {
          const tSec = depSec + Math.round((idx / (seqStops.length - 1)) * rideSec);
          seqStops[idx].time = formatClock(new Date(baseMs + tSec * 1000));
        }

        const firstS = seqStops[0];
        const lastS = seqStops[seqStops.length - 1];
        const rawPoly = shapes?.[st.line.name]?.[String(st.dir) as '0' | '1'];
        const geometry = slicePolylineBetween(
          firstS.lat,
          firstS.lng,
          lastS.lat,
          lastS.lng,
          rawPoly
        );

        let legDist = 0;
        for (let g = 0; g < geometry.length - 1; g++) {
          legDist += haversineMeters(
            geometry[g][0],
            geometry[g][1],
            geometry[g + 1][0],
            geometry[g + 1][1]
          );
        }

        const depIso = new Date(baseMs + depSec * 1000).toISOString();
        const arrIso = new Date(baseMs + st.arrSec * 1000).toISOString();

        legs.push({
          type: 'pt',
          lineName: st.line.name,
          category: st.line.cat,
          color: st.line.color,
          headsign: dirObj.to,
          fromName: firstS.name,
          toName: lastS.name,
          distanceMeters: Math.round(legDist),
          durationSeconds: st.arrSec - depSec,
          departureTime: formatClock(depIso),
          arrivalTime: formatClock(arrIso),
          hasDisability: st.line.cat === 'METRO' || st.line.cat === 'TRAM' || st.line.cat === 'TROLLEY' || st.line.cat === 'BUS',
          stops: seqStops,
          geometry
        });
        cursorSec = st.arrSec;
      }
    }

    // Final walk leg from endStopCode to destination
    const endStop = data.stopByCode.get(cand.endStopCode);
    const egoRawMeters = destWalkByCode.get(cand.endStopCode) || 0;
    const egoMeters = Math.round(egoRawMeters * 1.18);
    if (endStop && egoMeters >= 20) {
      const egoSec = Math.max(30, Math.round(egoMeters / WALK_SPEED_MPS));
      const depIso = new Date(baseMs + cursorSec * 1000).toISOString();
      const arrIso = new Date(baseMs + (cursorSec + egoSec) * 1000).toISOString();
      legs.push({
        type: 'walk',
        fromName: endStop.n,
        toName: to.label,
        distanceMeters: egoMeters,
        durationSeconds: egoSec,
        departureTime: formatClock(depIso),
        arrivalTime: formatClock(arrIso),
        stops: [],
        geometry: [
          [endStop.lat, endStop.lng],
          [to.lat, to.lng]
        ]
      });
      totalWalkMeters += egoMeters;
      cursorSec += egoSec;
    }

    if (legs.length === 0) continue;

    const ptLegsCount = legs.filter(l => l.type === 'pt').length;
    const depTimeStr = legs[0].departureTime || formatClock(new Date(baseMs));
    const arrTimeStr = legs[legs.length - 1].arrivalTime || formatClock(new Date(baseMs + cursorSec * 1000));

    results.push({
      id: `local-route-${results.length + 1}-${sig}`,
      durationSeconds: Math.max(60, cursorSec),
      walkMeters: totalWalkMeters,
      transfers: Math.max(0, ptLegsCount - 1),
      leavesInSeconds: firstTransitWaitSec,
      departureTime: depTimeStr,
      arrivalTime: arrTimeStr,
      legs,
      source: 'local-router'
    });
  }

  results.sort((a, b) => a.durationSeconds - b.durationSeconds);
  return results.slice(0, 4);
}
