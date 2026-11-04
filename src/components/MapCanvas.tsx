import { useEffect, useRef } from 'preact/hooks';
import L from 'leaflet';
import type {
  FavoriteItem,
  LineCategory,
  LineDirectionFilter,
  LiveVehicle,
  PlacePoint,
  PlannedItinerary,
  RouteShapesMap,
  StaticTransitData,
  StopItem,
  TransitLine
} from '../types';
import type { Translations } from '../i18n/translations';
import { getStationRingColor, haversineMeters } from '../utils/geo';
import {
  buildFlagPinHtml,
  buildVehicleMarkerHtml,
  CrosshairSvg,
  ZoomMinusSvg,
  ZoomPlusSvg
} from './OfficialSvgs';

const BUCHAREST_CENTER: [number, number] = [44.4353, 26.0997];
const DEFAULT_ZOOM = 15;

// Minimum zoom to display any stops/clusters. At zoom <= 13 (covering >15% of Bucharest-Ilfov), hide all points.
const MIN_STOPS_VISIBLE_ZOOM = 14;

const OSM_PRIMARY_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_HOT_FALLBACK_URL = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

interface StopCluster {
  lat: number;
  lng: number;
  stops: StopItem[];
  dominantCategory: LineCategory;
}

/**
 * Fast pixel-grid spatial clustering for visible stops.
 * - `radiusPx <= 0`: no clustering (every stop rendered individually at zoom >= 16)
 * - `radiusPx > 0`: groups nearby stops within `radiusPx` screen pixels
 */
function clusterVisibleStops(
  map: L.Map,
  stops: StopItem[],
  selectedStopCode: string | undefined,
  radiusPx: number
): StopCluster[] {
  if (radiusPx <= 0) {
    return stops.map(s => ({
      lat: s.lat,
      lng: s.lng,
      stops: [s],
      dominantCategory: s.m
    }));
  }

  const projected = stops.map(s => {
    const pt = map.latLngToContainerPoint([s.lat, s.lng]);
    return { stop: s, x: pt.x, y: pt.y, used: false };
  });

  // Ensure currently selected stop stays an individual clickable ring if possible
  const clusters: StopCluster[] = [];
  const rSq = radiusPx * radiusPx;

  for (let i = 0; i < projected.length; i++) {
    const seed = projected[i];
    if (seed.used) continue;
    seed.used = true;

    if (selectedStopCode && seed.stop.c === selectedStopCode) {
      clusters.push({
        lat: seed.stop.lat,
        lng: seed.stop.lng,
        stops: [seed.stop],
        dominantCategory: seed.stop.m
      });
      continue;
    }

    const members: StopItem[] = [seed.stop];
    let sumLat = seed.stop.lat;
    let sumLng = seed.stop.lng;
    let domCat: LineCategory = seed.stop.m;

    for (let j = i + 1; j < projected.length; j++) {
      const cand = projected[j];
      if (cand.used) continue;
      if (selectedStopCode && cand.stop.c === selectedStopCode) continue;

      const dx = cand.x - seed.x;
      const dy = cand.y - seed.y;
      if (dx * dx + dy * dy <= rSq) {
        cand.used = true;
        members.push(cand.stop);
        sumLat += cand.stop.lat;
        sumLng += cand.stop.lng;
        if (cand.stop.m === 'METRO') domCat = 'METRO';
      }
    }

    clusters.push({
      lat: sumLat / members.length,
      lng: sumLng / members.length,
      stops: members,
      dominantCategory: domCat
    });
  }

  return clusters;
}

interface MapCanvasProps {
  data: StaticTransitData | null;
  shapes: RouteShapesMap | null;
  selectedLineNames: string[];
  lineDirectionFilter: LineDirectionFilter;
  selectedStop: StopItem | null;
  liveVehicles: LiveVehicle[];
  fromPoint: PlacePoint | null;
  toPoint: PlacePoint | null;
  previewItinerary: PlannedItinerary | null;
  favorites: FavoriteItem[];
  userLocation: { lat: number; lng: number; accuracy?: number } | null;
  mapFocusCommand: { lat: number; lng: number; zoom?: number; seq: number } | null;
  pickingMapMode: 'from' | 'to' | 'fav' | null;
  rightCardOpen?: boolean;
  t: Translations;
  onSelectStop: (stop: StopItem) => void;
  onMapClickPick: (lat: number, lng: number) => void;
  onDragEndpoint: (which: 'from' | 'to', lat: number, lng: number) => void;
  onChangeDirectionFilter: (dir: LineDirectionFilter) => void;
  onRequestMyLocation: () => void;
}

export function MapCanvas({
  data,
  shapes,
  selectedLineNames,
  lineDirectionFilter,
  selectedStop,
  liveVehicles,
  fromPoint,
  toPoint,
  previewItinerary,
  favorites,
  userLocation,
  mapFocusCommand,
  pickingMapMode,
  rightCardOpen,
  t,
  onSelectStop,
  onMapClickPick,
  onDragEndpoint,
  onChangeDirectionFilter,
  onRequestMyLocation
}: MapCanvasProps) {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const stopsLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const vehiclesLayerRef = useRef<L.LayerGroup | null>(null);
  const plannerLayerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const favPlacesLayerRef = useRef<L.LayerGroup | null>(null);

  // Latest callbacks & state refs for Leaflet event listeners
  const latestRef = useRef({
    data,
    selectedLineNames,
    lineDirectionFilter,
    selectedStop,
    pickingMapMode,
    onSelectStop,
    onMapClickPick
  });
  latestRef.current = {
    data,
    selectedLineNames,
    lineDirectionFilter,
    selectedStop,
    pickingMapMode,
    onSelectStop,
    onMapClickPick
  };

  const renderViewportStopsRef = useRef<() => void>(() => {});

  // Initialize zero-API-key Leaflet map once (preferCanvas: false prevents dual-canvas click blocking!)
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const map = L.map(mapElRef.current, {
      center: BUCHAREST_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 10,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false
    });

    map.attributionControl.setPrefix('');

    let fallbackActivated = false;
    let tileErrors = 0;

    const osmLayer = L.tileLayer(OSM_PRIMARY_URL, {
      maxZoom: 19,
      className: 'osm-silver-tiles',
      attribution: '&copy; OpenStreetMap · TPBI'
    });

    osmLayer.on('tileerror', () => {
      tileErrors++;
      if (!fallbackActivated && tileErrors >= 4) {
        fallbackActivated = true;
        map.removeLayer(osmLayer);
        L.tileLayer(OSM_HOT_FALLBACK_URL, {
          subdomains: 'abc',
          maxZoom: 19,
          className: 'osm-silver-tiles',
          attribution: '&copy; OpenStreetMap · TPBI'
        }).addTo(map);
      }
    });

    osmLayer.addTo(map);

    routesLayerRef.current = L.layerGroup().addTo(map);
    plannerLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    favPlacesLayerRef.current = L.layerGroup().addTo(map);
    stopsLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (ev: L.LeafletMouseEvent) => {
      if (latestRef.current.pickingMapMode) {
        latestRef.current.onMapClickPick(ev.latlng.lat, ev.latlng.lng);
      }
    });

    const redrawStops = () => renderViewportStopsRef.current();
    map.on('moveend zoomend', redrawStops);

    mapRef.current = map;

    const resizeTimer = window.setTimeout(() => {
      map.invalidateSize();
      renderViewportStopsRef.current();
    }, 120);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Viewport-culled & zoom-clustered station markers (hiding completely when zoomed out >15% of Bucharest)
  renderViewportStopsRef.current = () => {
    const map = mapRef.current;
    const stopsLayer = stopsLayerRef.current;
    const cur = latestRef.current;

    if (!map || !stopsLayer || !cur.data) return;
    stopsLayer.clearLayers();

    const zoom = map.getZoom();
    const rawBounds = map.getBounds();

    // 15% Bucharest cutoff: at zoom < 14 (zoom <= 13 covers >15% of Bucharest-Ilfov),
    // hide all station points & clusters completely; they automatically reappear on zoom-in (zoom >= 14).
    if (zoom < MIN_STOPS_VISIBLE_ZOOM) {
      return;
    }

    const paddedBounds = rawBounds.pad(0.12);

    // If lines are selected, prioritize stops on those selected lines when zoomed out to 14
    const lineStopSet = new Set<string>();
    for (const lName of cur.selectedLineNames) {
      const lObj = cur.data.lineByName.get(lName);
      if (!lObj) continue;
      if (cur.lineDirectionFilter !== 'retur') {
        for (const c of lObj.d0.stops) lineStopSet.add(c);
      }
      if (cur.lineDirectionFilter !== 'tur') {
        for (const c of lObj.d1.stops) lineStopSet.add(c);
      }
    }

    const visibleStops: StopItem[] = [];
    for (const stop of cur.data.stops) {
      if (!paddedBounds.contains([stop.lat, stop.lng])) continue;
      if (cur.selectedLineNames.length > 0 && zoom < 15 && !lineStopSet.has(stop.c) && cur.selectedStop?.c !== stop.c) {
        continue;
      }
      visibleStops.push(stop);
    }

    if (visibleStops.length === 0) return;

    // Determine pixel clustering radius based on zoom:
    // - zoom >= 16: 0px (every station is an individual clickable ring!)
    // - zoom === 15: 36px (merges dense multi-stop hubs & paired stops into clusters, standalone stops stay individual)
    // - zoom === 14: 85px (clean neighborhood clusters across the visible sector)
    const clusterRadiusPx = zoom >= 16 ? 0 : zoom >= 15 ? 36 : 85;

    const clusters = clusterVisibleStops(
      map,
      visibleStops,
      cur.selectedStop?.c,
      clusterRadiusPx
    );

    for (const item of clusters) {
      if (item.stops.length === 1) {
        const stop = item.stops[0];
        const isSelected = cur.selectedStop?.c === stop.c;
        const ringColor = getStationRingColor(stop.m);
        const sizePx = isSelected ? 18 : zoom >= 16 ? 15 : 13;

        const marker = L.marker([stop.lat, stop.lng], {
          zIndexOffset: isSelected ? 550 : 220,
          icon: L.divIcon({
            className: 'stb-stop-div-icon',
            html: `<span class="stb-stop-ring ${isSelected ? 'selected' : ''}" style="width:${sizePx}px;height:${sizePx}px;border-color:${ringColor};background:${
              isSelected ? ringColor : '#ffffff'
            }"></span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13]
          })
        });

        marker.on('click', (ev: L.LeafletMouseEvent) => {
          if (ev.originalEvent) {
            L.DomEvent.stopPropagation(ev.originalEvent);
          }
          if (latestRef.current.pickingMapMode) {
            latestRef.current.onMapClickPick(stop.lat, stop.lng);
          } else {
            latestRef.current.onSelectStop(stop);
          }
        });

        if (zoom >= 15 || isSelected) {
          marker.bindTooltip(stop.n, {
            direction: 'top',
            offset: [0, -9],
            className: 'stb-stop-tooltip'
          });
        }

        marker.addTo(stopsLayer);
      } else {
        // Render interactive station cluster badge
        const count = item.stops.length;
        const size = count >= 20 ? 38 : count >= 8 ? 34 : 29;
        const ringColor =
          item.dominantCategory === 'METRO' ? '#1b6e2b' : '#33aa44';

        const clusterMarker = L.marker([item.lat, item.lng], {
          zIndexOffset: 340,
          icon: L.divIcon({
            className: 'stb-cluster-div-icon',
            html: `<div class="stb-stop-cluster" style="width:${size}px;height:${size}px;background:${ringColor}"><span>${count}</span></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          })
        });

        clusterMarker.on('click', (ev: L.LeafletMouseEvent) => {
          if (ev.originalEvent) {
            L.DomEvent.stopPropagation(ev.originalEvent);
          }
          const curZoom = map.getZoom();
          const nextZoom = Math.min(17, curZoom + (curZoom <= 14 ? 2 : 1));
          map.stop();
          map.setView([item.lat, item.lng], nextZoom, { animate: true });
        });

        clusterMarker.addTo(stopsLayer);
      }
    }
  };

  // Re-render stops whenever data, selection, or line filter changes
  useEffect(() => {
    renderViewportStopsRef.current();
  }, [data, selectedLineNames, lineDirectionFilter, selectedStop]);

  // Render selected lines' polylines & auto-fit bounds when lines change
  const prevLinesKeyRef = useRef('');
  useEffect(() => {
    const map = mapRef.current;
    const routesLayer = routesLayerRef.current;
    if (!map || !routesLayer) return;
    routesLayer.clearLayers();

    if (!data || !shapes || selectedLineNames.length === 0) {
      prevLinesKeyRef.current = '';
      return;
    }

    const allBoundsPoints: [number, number][] = [];

    for (const lName of selectedLineNames) {
      const line = data.lineByName.get(lName);
      const lShape = shapes[lName];
      if (!line || !lShape) continue;

      const drawBranch = (coords: [number, number][] | undefined, dashed: boolean) => {
        if (!coords || coords.length < 2) return;
        L.polyline(coords, {
          color: '#ffffff',
          weight: 7,
          opacity: 0.9,
          interactive: false
        }).addTo(routesLayer);

        L.polyline(coords, {
          color: line.color,
          weight: 4.5,
          opacity: 0.92,
          dashArray: dashed ? '8, 6' : undefined,
          interactive: false
        }).addTo(routesLayer);

        for (let i = 0; i < coords.length; i += 6) {
          allBoundsPoints.push(coords[i]);
        }
      };

      if (lineDirectionFilter === 'both') {
        drawBranch(lShape['0'], false);
        if (lShape['1'] && lShape['1'] !== lShape['0']) {
          drawBranch(lShape['1'], true);
        }
      } else if (lineDirectionFilter === 'tur') {
        drawBranch(lShape['0'], false);
      } else {
        drawBranch(lShape['1'] || lShape['0'], false);
      }
    }

    const linesKey = selectedLineNames.join(',');
    if (linesKey !== prevLinesKeyRef.current && allBoundsPoints.length >= 2) {
      prevLinesKeyRef.current = linesKey;
      map.fitBounds(L.latLngBounds(allBoundsPoints), {
        paddingTopLeft: [60, 60],
        paddingBottomRight: [380, 90],
        maxZoom: 15
      });
    }
  }, [data, shapes, selectedLineNames, lineDirectionFilter]);

  // Render live TPBI GPS vehicle markers (`round_bus`, `round_tram`, `round_trolley`)
  useEffect(() => {
    const vehiclesLayer = vehiclesLayerRef.current;
    if (!vehiclesLayer) return;
    vehiclesLayer.clearLayers();

    if (selectedLineNames.length === 0 || liveVehicles.length === 0) return;
    const activeSet = new Set(selectedLineNames);

    for (const v of liveVehicles) {
      if (!activeSet.has(v.lineName)) continue;
      if (lineDirectionFilter === 'tur' && v.direction !== 0) continue;
      if (lineDirectionFilter === 'retur' && v.direction !== 1) continue;

      const icon = L.divIcon({
        className: 'stb-veh-div-icon',
        html: buildVehicleMarkerHtml(v.category, v.color, v.lineName, v.bearing),
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const m = L.marker([v.lat, v.lng], { icon, zIndexOffset: 650 });
      m.bindPopup(
        `<div class="stb-veh-popup">
          <div class="stb-veh-popup-head">
            <span class="linePillMini" style="background:${v.color}">${v.lineName}</span>
            <strong>→ ${v.destination}</strong>
          </div>
          <div class="stb-veh-popup-row">${t.vehiclePopupFleet}: <b>${v.label}</b></div>
          ${
            v.licensePlate
              ? `<div class="stb-veh-popup-row">${t.vehiclePopupPlate}: <b>${v.licensePlate}</b></div>`
              : ''
          }
          <div class="stb-veh-popup-live">● ${t.vehiclePopupLive}</div>
        </div>`
      );
      m.addTo(vehiclesLayer);
    }
  }, [liveVehicles, selectedLineNames, lineDirectionFilter, t]);

  // Render Route Planner endpoints (draggable A / B flags) & preview itinerary polyline
  useEffect(() => {
    const map = mapRef.current;
    const plannerLayer = plannerLayerRef.current;
    if (!map || !plannerLayer) return;
    plannerLayer.clearLayers();

    const fitPts: [number, number][] = [];

    if (previewItinerary) {
      for (const leg of previewItinerary.legs) {
        if (!leg.geometry || leg.geometry.length < 2) continue;
        if (leg.type === 'walk') {
          L.polyline(leg.geometry, {
            color: '#58586b',
            weight: 4,
            dashArray: '6, 8',
            opacity: 0.9,
            interactive: false
          }).addTo(plannerLayer);
        } else {
          L.polyline(leg.geometry, {
            color: '#ffffff',
            weight: 8,
            opacity: 0.95,
            interactive: false
          }).addTo(plannerLayer);
          L.polyline(leg.geometry, {
            color: leg.color || '#33AA44',
            weight: 5,
            opacity: 0.95,
            interactive: false
          }).addTo(plannerLayer);
        }
        for (const pt of leg.geometry) fitPts.push(pt);
      }
    }

    if (fromPoint) {
      const startMarker = L.marker([fromPoint.lat, fromPoint.lng], {
        draggable: true,
        zIndexOffset: 900,
        icon: L.divIcon({
          className: 'stb-flag-wrapper',
          html: buildFlagPinHtml('start'),
          iconSize: [34, 42],
          iconAnchor: [17, 40]
        })
      });
      startMarker.on('dragend', () => {
        const pos = startMarker.getLatLng();
        onDragEndpoint('from', pos.lat, pos.lng);
      });
      startMarker.addTo(plannerLayer);
      fitPts.push([fromPoint.lat, fromPoint.lng]);
    }

    if (toPoint) {
      const endMarker = L.marker([toPoint.lat, toPoint.lng], {
        draggable: true,
        zIndexOffset: 900,
        icon: L.divIcon({
          className: 'stb-flag-wrapper',
          html: buildFlagPinHtml('end'),
          iconSize: [34, 42],
          iconAnchor: [17, 40]
        })
      });
      endMarker.on('dragend', () => {
        const pos = endMarker.getLatLng();
        onDragEndpoint('to', pos.lat, pos.lng);
      });
      endMarker.addTo(plannerLayer);
      fitPts.push([toPoint.lat, toPoint.lng]);
    }

    if (previewItinerary && fitPts.length >= 2) {
      map.fitBounds(L.latLngBounds(fitPts), {
        paddingTopLeft: [50, 50],
        paddingBottomRight: [50, 50],
        maxZoom: 16
      });
    }
  }, [fromPoint, toPoint, previewItinerary, onDragEndpoint]);

  // Render saved custom favorite places on map
  useEffect(() => {
    const favLayer = favPlacesLayerRef.current;
    if (!favLayer) return;
    favLayer.clearLayers();

    for (const fav of favorites) {
      if (fav.kind !== 'place' || fav.lat === undefined || fav.lng === undefined) continue;
      const m = L.marker([fav.lat, fav.lng], {
        icon: L.divIcon({
          className: 'stb-fav-place-pin',
          html: `<div class="favMapPinBubble" title="${fav.name}">★</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      });
      m.bindTooltip(fav.name, { direction: 'top', offset: [0, -10] });
      m.addTo(favLayer);
    }
  }, [favorites]);

  // Render user GPS blue dot + accuracy circle (strictly non-interactive so it NEVER blocks station clicks!)
  useEffect(() => {
    const userLayer = userLayerRef.current;
    if (!userLayer) return;
    userLayer.clearLayers();
    if (!userLocation) return;

    if (userLocation.accuracy && userLocation.accuracy > 10 && userLocation.accuracy < 1200) {
      L.circle([userLocation.lat, userLocation.lng], {
        radius: userLocation.accuracy,
        color: '#3559d9',
        weight: 1,
        fillColor: '#3559d9',
        fillOpacity: 0.1,
        interactive: false
      }).addTo(userLayer);
    }

    L.marker([userLocation.lat, userLocation.lng], {
      interactive: false,
      keyboard: false,
      zIndexOffset: 100,
      icon: L.divIcon({
        className: 'stb-user-gps-div-icon',
        html: '<span class="stb-user-gps-dot"><span class="stb-user-gps-pulse"></span></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(userLayer);
  }, [userLocation]);

  // Execute programmatic map focus commands safely (avoiding flyTo floating-point edge cases on short hops)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapFocusCommand) return;
    const targetZoom = mapFocusCommand.zoom ?? Math.max(map.getZoom(), 16);
    const curCenter = map.getCenter();
    const dist = haversineMeters(
      curCenter.lat,
      curCenter.lng,
      mapFocusCommand.lat,
      mapFocusCommand.lng
    );

    map.stop();
    if (dist < 180) {
      map.setView([mapFocusCommand.lat, mapFocusCommand.lng], targetZoom, { animate: true });
      const tId = window.setTimeout(() => renderViewportStopsRef.current(), 300);
      return () => clearTimeout(tId);
    } else {
      map.flyTo([mapFocusCommand.lat, mapFocusCommand.lng], targetZoom, {
        duration: 0.45
      });
      const tId = window.setTimeout(() => renderViewportStopsRef.current(), 520);
      return () => clearTimeout(tId);
    }
  }, [mapFocusCommand]);

  const primaryLine: TransitLine | undefined =
    selectedLineNames.length === 1 && data
      ? data.lineByName.get(selectedLineNames[0])
      : undefined;

  return (
    <div class={`mapContainer ${pickingMapMode ? 'pickingCursor' : ''}`}>
      <div ref={mapElRef} class="leafletMapHost" />

      {/* Official bottom-left map_controllers (My Location + Zoom +/-) */}
      <div class="map_controllers">
        <div class="controllers_container">
          <button
            type="button"
            class="controller"
            title={t.myLocation}
            aria-label={t.myLocation}
            onClick={onRequestMyLocation}
          >
            <CrosshairSvg />
          </button>
        </div>

        <div class="controllers_container">
          <button
            type="button"
            class="controller"
            title={t.zoomIn}
            aria-label={t.zoomIn}
            onClick={() => mapRef.current?.zoomIn()}
          >
            <ZoomPlusSvg />
          </button>
          <div class="h_line" />
          <button
            type="button"
            class="controller"
            title={t.zoomOut}
            aria-label={t.zoomOut}
            onClick={() => mapRef.current?.zoomOut()}
          >
            <ZoomMinusSvg />
          </button>
        </div>
      </div>

      {/* Official bottom-center direction switcher (.directionButtonContainer) when line(s) are selected */}
      {selectedLineNames.length > 0 && (
        <div
          class={`direction-button-container-wrapper ${
            rightCardOpen ? 'withRightCard' : ''
          }`}
        >
          <div class="directionButtonContainer">
            <button
              type="button"
              class={`buttonDirectionContainer both-directions ${
                lineDirectionFilter === 'both' ? 'selected' : ''
              }`}
              onClick={() => onChangeDirectionFilter('both')}
            >
              <span class="buttonDirectionText">{t.bothDirections}</span>
            </button>

            <button
              type="button"
              class={`buttonDirectionContainer ${
                lineDirectionFilter === 'tur' ? 'selected' : ''
              }`}
              onClick={() => onChangeDirectionFilter('tur')}
            >
              <span class="buttonDirectionText">{t.turDirection}</span>
              {primaryLine && (
                <span class="buttonDirectionSubtitle">→ {primaryLine.d0.to}</span>
              )}
            </button>

            <button
              type="button"
              class={`buttonDirectionContainer ${
                lineDirectionFilter === 'retur' ? 'selected' : ''
              }`}
              onClick={() => onChangeDirectionFilter('retur')}
            >
              <span class="buttonDirectionText">{t.returDirection}</span>
              {primaryLine && (
                <span class="buttonDirectionSubtitle">→ {primaryLine.d1.to}</span>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
