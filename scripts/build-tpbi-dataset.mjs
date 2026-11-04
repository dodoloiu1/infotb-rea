import fs from 'fs';
import path from 'path';

const RAW_DIR =
  'C:/Users/lungu/.gemini/antigravity-cli/brain/4c522d43-6247-4114-b792-06a8696bb34d/scratch/tpbi_raw';
const OUT_DIR = path.resolve('C:/Users/lungu/infotb-rea/public/data');
fs.mkdirSync(OUT_DIR, { recursive: true });

function round5(n) {
  return Math.round(Number(n) * 1e5) / 1e5;
}

function sqDist(lat1, lng1, lat2, lng2) {
  const dLat = lat1 - lat2;
  const dLng = (lng1 - lng2) * 0.714;
  return dLat * dLat + dLng * dLng;
}

function projectAlongPolyline(lat, lng, poly) {
  if (!poly || poly.length < 2) return 0;
  let bestDistSq = Infinity;
  let bestAlong = 0;
  let cumLen = 0;

  for (let i = 0; i < poly.length - 1; i++) {
    const [ay, ax] = poly[i];
    const [by, bx] = poly[i + 1];
    const vy = by - ay;
    const vx = (bx - ax) * 0.714;
    const wy = lat - ay;
    const wx = (lng - ax) * 0.714;
    const segLenSq = vy * vy + vx * vx;
    const segLen = Math.sqrt(segLenSq);
    let t = segLenSq > 0 ? (wy * vy + wx * vx) / segLenSq : 0;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
    const py = ay + t * vy;
    const px = ax + t * (bx - ax);
    const dSq = sqDist(lat, lng, py, px);
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestAlong = cumLen + t * segLen;
    }
    cumLen += segLen;
  }
  return bestAlong;
}

function normalizeName(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function getCategory(shortName, modTransp, stbsaType) {
  const s = String(shortName).trim().toUpperCase();
  if (/^M\d/.test(s) || modTransp === 'Metrou' || stbsaType === 'SUBWAY') return 'METRO';
  if (/^N\d/.test(s)) return 'NIGHT';
  const num = parseInt(s.replace(/^R/, ''), 10);
  if (/^R?4\d\d/.test(s) && s !== '41' && s !== '47' && s !== '40' && s !== '44') return 'REGIONAL';
  if (stbsaType === 'TRAM' || modTransp === 'TRAM' || (!isNaN(num) && num >= 1 && num <= 55)) return 'TRAM';
  if (
    stbsaType === 'TROLLEY' ||
    stbsaType === 'CABLE_CAR' ||
    modTransp === 'TRO' ||
    (!isNaN(num) && num >= 56 && num <= 99)
  ) {
    return 'TROLLEY';
  }
  return 'BUS';
}

function getDefaultColor(category, shortName) {
  const s = String(shortName).toUpperCase();
  if (s === 'M1') return '#EAB308';
  if (s === 'M2') return '#2563EB';
  if (s === 'M3') return '#DC2626';
  if (s === 'M4') return '#16A34A';
  if (s === 'M5') return '#F97316';
  switch (category) {
    case 'TRAM':
      return '#BE1622';
    case 'TROLLEY':
      return '#009640';
    case 'REGIONAL':
      return '#662483';
    case 'NIGHT':
      return '#1E3A8A';
    case 'METRO':
      return '#9807ff';
    default:
      return '#0070C0';
  }
}

function parseInlineXlsxSheet(xmlPath) {
  const xml = fs.readFileSync(xmlPath, 'utf8');
  const rows = [];
  for (const rm of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const vals = [];
    for (const cm of rm[1].matchAll(/<c[^>]*>([\s\S]*?)<\/c>/g)) {
      const tm = cm[1].match(/<t[^>]*>([\s\S]*?)<\/t>/);
      vals.push(tm ? tm[1] : '');
    }
    rows.push(vals);
  }
  return rows;
}

async function fetchJsonSafe(url, timeoutMs = 6000) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  const routesGeo = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'routes.geojson'), 'utf8'));
  const stopsGeo = JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'surface_stops.geojson'), 'utf8'));
  let stbsaLines =
    JSON.parse(fs.readFileSync(path.join(RAW_DIR, 'stbsa_lines.json'), 'utf8')).lines || [];
  const routeRows = parseInlineXlsxSheet(
    path.join(RAW_DIR, 'rd_unzip/xl/worksheets/sheet1.xml')
  ).slice(1);

  // Refresh official STB/TPBI line colors & notification flags if online
  const liveStbsa = await fetchJsonSafe('https://info.stbsa.ro/rp/api/lines');
  if (Array.isArray(liveStbsa?.lines) && liveStbsa.lines.length > 0) {
    stbsaLines = liveStbsa.lines;
  }

  const stbsaByName = new Map();
  for (const l of stbsaLines) {
    stbsaByName.set(String(l.name).trim(), l);
  }

  const routeIdToName = {};
  const nameToRouteIds = new Map();
  const addMapping = (rid, sname) => {
    if (!rid || !sname) return;
    const cleanId = String(rid).trim();
    const cleanName = String(sname).trim();
    routeIdToName[cleanId] = cleanName;
    if (cleanId.startsWith('PV')) {
      const m = cleanId.match(/_(\d+[A-Z]?)$/i);
      if (m) routeIdToName[m[1]] = cleanName;
    }
    if (!nameToRouteIds.has(cleanName)) nameToRouteIds.set(cleanName, new Set());
    nameToRouteIds.get(cleanName).add(cleanId);
  };

  for (const [rid, sname] of routeRows) addMapping(rid, sname);
  for (const l of stbsaLines) addMapping(String(l.id), String(l.name));

  const rawShapesByLine = new Map();
  for (const feat of routesGeo.features) {
    const rname = String(feat.properties?.route_name || '').trim();
    const rid = String(feat.properties?.route_id || '').trim();
    if (!rname || !feat.geometry?.coordinates) continue;
    addMapping(rid, rname);

    let coords = [];
    if (feat.geometry.type === 'LineString') {
      coords = feat.geometry.coordinates.map(([lng, lat]) => [round5(lat), round5(lng)]);
    } else if (feat.geometry.type === 'MultiLineString') {
      coords = feat.geometry.coordinates.flat().map(([lng, lat]) => [round5(lat), round5(lng)]);
    }
    if (coords.length < 2) continue;
    if (!rawShapesByLine.has(rname)) rawShapesByLine.set(rname, []);
    rawShapesByLine.get(rname).push(coords);
  }

  const stopsByCode = new Map();
  const lineStopsRaw = new Map();

  for (const feat of stopsGeo.features) {
    const p = feat.properties || {};
    if (p.type === 'TICKET_OFFICE' || p['Tip'] === 'TICKET_OFFICE') continue;

    const coords = feat.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;
    const lng = round5(coords[0]);
    const lat = round5(coords[1]);
    const code = String(p['Cod Statie'] || '').trim();
    const stopName = String(p.Statie || '').trim();
    const street = String(p.Artera || '').trim();
    const lineName = String(p['Linia/sens'] || '').trim();
    const routeId = String(p['Route ID'] || '').trim();
    const modTransp = String(p['Mod Transp'] || '').trim();
    const capat = String(p.Capat || '').trim();
    const dir = Number(p.Directie) === 1 ? 1 : 0;

    if (!code || !stopName || !lineName) continue;
    addMapping(routeId, lineName);

    const cat = getCategory(lineName, modTransp, stbsaByName.get(lineName)?.type);

    if (!stopsByCode.has(code)) {
      stopsByCode.set(code, {
        c: code,
        n: stopName,
        s: street,
        lat,
        lng,
        m: cat,
        l: []
      });
    }
    const stopEntry = stopsByCode.get(code);
    // Keep official station marker ring priority: METRO > TRAM/BUS > TROLLEY/REGIONAL > NIGHT
    if (cat === 'METRO') {
      stopEntry.m = 'METRO';
    } else if (stopEntry.m === 'NIGHT' && cat !== 'NIGHT') {
      stopEntry.m = cat;
    } else if (stopEntry.m === 'TROLLEY' && (cat === 'TRAM' || cat === 'BUS')) {
      stopEntry.m = cat;
    }

    if (!stopEntry.l.some(x => x[0] === lineName && x[1] === dir)) {
      stopEntry.l.push([lineName, dir, capat]);
    }

    if (!lineStopsRaw.has(lineName)) {
      lineStopsRaw.set(lineName, {
        modTransp,
        0: { capats: new Map(), stops: new Map() },
        1: { capats: new Map(), stops: new Map() }
      });
    }
    const lEntry = lineStopsRaw.get(lineName);
    if (capat) {
      lEntry[dir].capats.set(capat, (lEntry[dir].capats.get(capat) || 0) + 1);
    }
    if (!lEntry[dir].stops.has(code)) {
      lEntry[dir].stops.set(code, { code, stopName, lat, lng });
    }
  }

  const allLineNames = new Set([
    ...lineStopsRaw.keys(),
    ...rawShapesByLine.keys(),
    ...nameToRouteIds.keys()
  ]);
  const lines = [];
  const shapes = {};

  for (const lineName of allLineNames) {
    const stbsa = stbsaByName.get(lineName);
    const lRaw = lineStopsRaw.get(lineName);
    const candidateShapes = rawShapesByLine.get(lineName) || [];
    const category = getCategory(lineName, lRaw?.modTransp, stbsa?.type);
    const color =
      (category === 'METRO' ? getDefaultColor('METRO', lineName) : stbsa?.color) ||
      getDefaultColor(category, lineName);

    const getTopCapat = dirObj => {
      if (!dirObj || dirObj.capats.size === 0) return '';
      return [...dirObj.capats.entries()].sort((a, b) => b[1] - a[1])[0][0];
    };

    const head0 = getTopCapat(lRaw?.[0]);
    const head1 = getTopCapat(lRaw?.[1]);

    let shape0 = candidateShapes[0] || null;
    let shape1 = candidateShapes[1] || candidateShapes[0] || null;

    if (candidateShapes.length >= 2 && lRaw) {
      const findTerminalCoord = (dirObj, head) => {
        const normHead = normalizeName(head);
        for (const s of dirObj.stops.values()) {
          const ns = normalizeName(s.stopName);
          if (ns === normHead || ns.includes(normHead) || normHead.includes(ns)) {
            return [s.lat, s.lng];
          }
        }
        return null;
      };
      const term0 = findTerminalCoord(lRaw[0], head0);
      const term1 = findTerminalCoord(lRaw[1], head1);
      if (term0) {
        const endA = candidateShapes[0][candidateShapes[0].length - 1];
        const endB = candidateShapes[1][candidateShapes[1].length - 1];
        if (sqDist(term0[0], term0[1], endB[0], endB[1]) < sqDist(term0[0], term0[1], endA[0], endA[1])) {
          shape0 = candidateShapes[1];
          shape1 = candidateShapes[0];
        }
      } else if (term1) {
        const endA = candidateShapes[0][candidateShapes[0].length - 1];
        const endB = candidateShapes[1][candidateShapes[1].length - 1];
        if (sqDist(term1[0], term1[1], endA[0], endA[1]) < sqDist(term1[0], term1[1], endB[0], endB[1])) {
          shape1 = candidateShapes[0];
          shape0 = candidateShapes[1];
        }
      }
    }

    const sortDirStops = (dirObj, poly) => {
      if (!dirObj) return [];
      const arr = [...dirObj.stops.values()];
      if (poly && poly.length >= 2) {
        arr.sort(
          (a, b) =>
            projectAlongPolyline(a.lat, a.lng, poly) - projectAlongPolyline(b.lat, b.lng, poly)
        );
      }
      return arr.map(s => s.code);
    };

    const stops0 = sortDirStops(lRaw?.[0], shape0);
    const stops1 = sortDirStops(lRaw?.[1], shape1);

    if (stops0.length === 0 && stops1.length === 0 && candidateShapes.length === 0) continue;

    const ids = [...(nameToRouteIds.get(lineName) || [])];
    const primaryId = stbsa ? String(stbsa.id) : ids[0] || lineName;

    lines.push({
      id: primaryId,
      ids,
      name: lineName,
      cat: category,
      color,
      org: stbsa?.organization?.id === 1 ? 'STB' : 'TPBI',
      hasNotifications: Boolean(stbsa?.has_notifications),
      d0: {
        to: head0 || (stops0.length ? stopsByCode.get(stops0[stops0.length - 1])?.n : 'Tur'),
        stops: stops0
      },
      d1: {
        to: head1 || (stops1.length ? stopsByCode.get(stops1[stops1.length - 1])?.n : 'Retur'),
        stops: stops1
      }
    });

    if (shape0 || shape1) {
      shapes[lineName] = {};
      if (shape0) shapes[lineName]['0'] = shape0;
      if (shape1) shapes[lineName]['1'] = shape1;
    }
  }

  const catOrder = { TRAM: 1, TROLLEY: 2, BUS: 3, REGIONAL: 4, NIGHT: 5, METRO: 6 };
  lines.sort((a, b) => {
    const ca = catOrder[a.cat] || 9;
    const cb = catOrder[b.cat] || 9;
    if (ca !== cb) return ca - cb;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  const stops = [...stopsByCode.values()];

  // Fetch TPBI live alerts snapshot for offline/GitHub Pages fallback
  const alertsSnapshot = [];
  const nowIso = new Date().toISOString();
  for (const line of lines) {
    if (line.hasNotifications) {
      alertsSnapshot.push({
        id: `stb-line-${line.name}`,
        lineName: line.name,
        lineColor: line.color,
        category: line.cat,
        createdAt: nowIso,
        titleRo: `Informare operativă — Linia ${line.name}`,
        titleEn: `Service notice — Line ${line.name}`,
        messageRo: `Circulația pe linia ${line.name} (${line.d0.to} ↔ ${line.d1.to}) prezintă modificări operative sau intervale adaptate condițiilor de trafic anunțate de TPBI / STB.`,
        messageEn: `Service on line ${line.name} (${line.d0.to} ↔ ${line.d1.to}) has operational adjustments or traffic-adapted headways announced by TPBI / STB.`
      });
    }
  }

  const tpbiAlertGeo = await fetchJsonSafe('https://maps.mo-bi.ro/api/alertdata');
  if (Array.isArray(tpbiAlertGeo?.features)) {
    for (const f of tpbiAlertGeo.features.slice(0, 25)) {
      const p = f.properties || {};
      const coords = f.geometry?.coordinates;
      const rawType = String(p.type || '').toUpperCase();
      const subType = String(p.sub_type || p.subtype || '').toUpperCase();
      const street = p.street ? String(p.street) : '';
      const city = p.city ? String(p.city) : 'București';
      if (!street && !p.description) continue;

      let titleRo = `Atenționare trafic${street ? ' — ' + street : ''}`;
      let titleEn = `Traffic alert${street ? ' — ' + street : ''}`;
      if (rawType.includes('CLOSED') || subType.includes('CLOSED')) {
        titleRo = `Restricție circulație${street ? ' — ' + street : ''}`;
        titleEn = `Road closure / restriction${street ? ' — ' + street : ''}`;
      } else if (rawType.includes('JAM') || subType.includes('TRAFFIC')) {
        titleRo = `Trafic îngreunat${street ? ' — ' + street : ''}`;
        titleEn = `Heavy traffic${street ? ' — ' + street : ''}`;
      } else if (subType.includes('CONSTRUCTION') || rawType.includes('CONSTRUCTION')) {
        titleRo = `Lucrări carosabil${street ? ' — ' + street : ''}`;
        titleEn = `Roadworks${street ? ' — ' + street : ''}`;
      }

      const desc = p.description
        ? String(p.description)
        : `${street ? street + ', ' : ''}${city}`;

      alertsSnapshot.push({
        id: String(f.id || p.uuid || `tpbi-${alertsSnapshot.length}`),
        lineName: 'TPBI',
        lineColor: '#33AA44',
        createdAt: nowIso,
        titleRo,
        titleEn,
        messageRo: desc,
        messageEn: desc,
        lat: typeof p.lat === 'number' ? p.lat : coords?.[1],
        lng: typeof p.lon === 'number' ? p.lon : coords?.[0]
      });
    }
  }

  fs.writeFileSync(
    path.join(OUT_DIR, 'lines.json'),
    JSON.stringify({ routeIdToName, lines }),
    'utf8'
  );
  fs.writeFileSync(path.join(OUT_DIR, 'stops.json'), JSON.stringify(stops), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'shapes.json'), JSON.stringify(shapes), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'alerts.json'), JSON.stringify(alertsSnapshot), 'utf8');

  console.log(
    `Built TPBI dataset -> ${lines.length} lines, ${stops.length} stops, ${Object.keys(shapes).length} shapes, ${alertsSnapshot.length} alerts.`
  );
}

main();
