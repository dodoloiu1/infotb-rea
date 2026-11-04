import type { LatLngTuple, LineCategory, WeeklySchedule, WeeklyTimetableRow } from '../types';

const DEG_TO_RAD = Math.PI / 180;
const COS_BUCHAREST = 0.714; // cos(44.435 deg)

export function normalizeRo(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * 111320;
  const dLng = (lng2 - lng1) * 111320 * COS_BUCHAREST;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

export function computeBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number | null {
  const dist = haversineMeters(lat1, lng1, lat2, lng2);
  if (dist < 8) return null;
  const phi1 = lat1 * DEG_TO_RAD;
  const phi2 = lat2 * DEG_TO_RAD;
  const dLambda = (lng2 - lng1) * DEG_TO_RAD;
  const y = Math.sin(dLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function projectMetersAlongPolyline(
  lat: number,
  lng: number,
  poly: LatLngTuple[]
): { along: number; perpMeters: number } {
  let bestPerp = Infinity;
  let bestAlong = 0;
  let cum = 0;

  for (let i = 0; i < poly.length - 1; i++) {
    const [ay, ax] = poly[i];
    const [by, bx] = poly[i + 1];
    const dy = (by - ay) * 111320;
    const dx = (bx - ax) * 111320 * COS_BUCHAREST;
    const wy = (lat - ay) * 111320;
    const wx = (lng - ax) * 111320 * COS_BUCHAREST;
    const segLenSq = dx * dx + dy * dy;
    const segLen = Math.sqrt(segLenSq);
    let t = segLenSq > 0 ? (wx * dx + wy * dy) / segLenSq : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const px = t * dx;
    const py = t * dy;
    const perp = Math.hypot(wx - px, wy - py);
    if (perp < bestPerp) {
      bestPerp = perp;
      bestAlong = cum + t * segLen;
    }
    cum += segLen;
  }

  return { along: bestAlong, perpMeters: bestPerp };
}

export function slicePolylineBetween(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
  poly?: LatLngTuple[]
): LatLngTuple[] {
  if (!poly || poly.length < 2) {
    return [
      [fromLat, fromLng],
      [toLat, toLng]
    ];
  }
  let iStart = 0;
  let iEnd = poly.length - 1;
  let dStart = Infinity;
  let dEnd = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const ds = haversineMeters(fromLat, fromLng, poly[i][0], poly[i][1]);
    if (ds < dStart) {
      dStart = ds;
      iStart = i;
    }
    const de = haversineMeters(toLat, toLng, poly[i][0], poly[i][1]);
    if (de < dEnd) {
      dEnd = de;
      iEnd = i;
    }
  }
  if (iStart <= iEnd) {
    const sliced = poly.slice(iStart, iEnd + 1);
    return sliced.length >= 2 ? sliced : [[fromLat, fromLng], [toLat, toLng]];
  }
  const sliced = poly.slice(iEnd, iStart + 1).reverse();
  return sliced.length >= 2 ? sliced : [[fromLat, fromLng], [toLat, toLng]];
}

export function formatArrivalMinutes(seconds: number, minLabel: string, secLabel: string): string {
  if (seconds <= 40) return `< 1 ${minLabel}`;
  const mins = Math.round(seconds / 60);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m} ${minLabel}` : `${h}h`;
  }
  return `${mins} ${minLabel}`;
}

export function formatDuration(seconds: number, hrLabel = 'ore', minLabel = 'min'): string {
  const mins = Math.max(1, Math.round(seconds / 60));
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} ${hrLabel} ${m} ${minLabel}` : `${h} ${hrLabel}`;
  }
  return `${mins} ${minLabel}`;
}

export function formatDistance(meters: number, metersLabel = 'metri'): string {
  if (meters < 1000) return `${Math.round(meters)} ${metersLabel}`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatClock(isoOrDate: string | Date): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Official info.stb.ro station ring color by dominant transit category:
 * - METRO: dark green (#1b6e2b)
 * - TROLLEY / REGIONAL / NIGHT: blue (#1565c0)
 * - TRAM / BUS: red (#df2027)
 */
export function getStationRingColor(cat: LineCategory): string {
  switch (cat) {
    case 'METRO':
      return '#1b6e2b';
    case 'TROLLEY':
    case 'REGIONAL':
      return '#1565c0';
    case 'TRAM':
    case 'BUS':
    case 'NIGHT':
    default:
      return '#df2027';
  }
}

/**
 * Generates deterministic, realistic TPBI/STB weekly station departure timetable
 * per (stopCode, lineName, category) for the expandable "Program săptămânal" table.
 */
export function buildWeeklySchedule(
  stopCode: string,
  lineName: string,
  cat: LineCategory
): WeeklySchedule {
  let seed = 0;
  const key = `${stopCode}:${lineName}`;
  for (let i = 0; i < key.length; i++) {
    seed = (seed * 31 + key.charCodeAt(i)) >>> 0;
  }
  const baseOffset = seed % 11;

  const buildDay = (dayType: 'weekday' | 'saturday' | 'sunday'): WeeklyTimetableRow[] => {
    const rows: WeeklyTimetableRow[] = [];
    if (cat === 'NIGHT') {
      const hours = [23, 0, 1, 2, 3, 4, 5];
      for (const h of hours) {
        const m1 = (baseOffset + 5) % 30;
        const m2 = m1 + 30;
        rows.push({
          hour: String(h).padStart(2, '0'),
          minutes: h === 5 ? [String(m1).padStart(2, '0')] : [String(m1).padStart(2, '0'), String(m2).padStart(2, '0')]
        });
      }
      return rows;
    }

    for (let h = 5; h <= 23; h++) {
      let interval = 12;
      if (cat === 'METRO') {
        interval =
          dayType === 'weekday'
            ? h >= 7 && h <= 9
              ? 4
              : h >= 16 && h <= 19
                ? 5
                : 8
            : 9;
      } else if (cat === 'REGIONAL') {
        interval = dayType === 'weekday' ? (h >= 6 && h <= 9 ? 20 : 30) : 40;
      } else if (cat === 'TRAM') {
        interval =
          dayType === 'weekday'
            ? h >= 7 && h <= 9
              ? 6
              : h >= 15 && h <= 19
                ? 7
                : h >= 21
                  ? 14
                  : 9
            : dayType === 'saturday'
              ? 11
              : 13;
      } else {
        interval =
          dayType === 'weekday'
            ? h >= 7 && h <= 9
              ? 8
              : h >= 15 && h <= 19
                ? 9
                : h >= 21
                  ? 16
                  : 11
            : dayType === 'saturday'
              ? 14
              : 16;
      }

      const mins: string[] = [];
      for (let m = baseOffset % interval; m < 60; m += interval) {
        mins.push(String(m).padStart(2, '0'));
      }
      rows.push({
        hour: String(h).padStart(2, '0'),
        minutes: mins
      });
    }
    return rows;
  };

  return {
    weekday: buildDay('weekday'),
    saturday: buildDay('saturday'),
    sunday: buildDay('sunday')
  };
}
