import { useEffect, useRef } from 'preact/hooks';
import L from 'leaflet';
import type {
  FavoriteItem,
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
import { getStationRingColor } from '../utils/geo';
import {
  buildFlagPinHtml,
  buildVehicleMarkerHtml,
  CrosshairSvg,
  ZoomMinusSvg,
  ZoomPlusSvg
} from './OfficialSvgs';

const BUCHAREST_CENTER: [number, number] = [44.4353, 26.0997];
const DEFAULT_ZOOM = 15;

const OSM_PRIMARY_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OSM_HOT_FALLBACK_URL = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';

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
  const canvasRendererRef = useRef<L.Canvas | null>(null);

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

  // Initialize zero-API-key Leaflet map once
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;

    const canvasRenderer = L.canvas({ padding: 0.5 });
    canvasRendererRef.current = canvasRenderer;

    const map = L.map(mapElRef.current, {
      center: BUCHAREST_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 10,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true
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
    stopsLayerRef.current = L.layerGroup().addTo(map);
    favPlacesLayerRef.current = L.layerGroup().addTo(map);
    vehiclesLayerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);

    map.on('click', (ev: L.LeafletMouseEvent) => {
      if (latestRef.current.pickingMapMode) {
        latestRef.current.onMapClickPick(ev.latlng.lat, ev.latlng.lng);
      }
    });

    const redrawStops = () => renderViewportStopsRef.current();
    map.on('moveend zoomend', redrawStops);

    mapRef.current = map;

    // Ensure proper Leaflet sizing after layout mount
    const resizeTimer = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      clearTimeout(resizeTimer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Viewport-culled official 16x16px ring station markers
  renderViewportStopsRef.current = () => {
    const map = mapRef.current;
    const stopsLayer = stopsLayerRef.current;
    const renderer = canvasRendererRef.current;
    const cur = latestRef.current;

    if (!map || !stopsLayer || !renderer || !cur.data) return;
    stopsLayer.clearLayers();

    const zoom = map.getZoom();
    const bounds = map.getBounds().pad(0.18);

    // Collect stop codes belonging to currently selected lines so they always show
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

    for (const stop of cur.data.stops) {
      const isSelected = cur.selectedStop?.c === stop.c;
      const isOnActiveLine = lineStopSet.has(stop.c);

      if (!isSelected && !isOnActiveLine) {
        if (cur.selectedLineNames.length > 0) {
          // When lines are selected, dim or hide unrelated stops at low zoom for clarity
          if (zoom < 15) continue;
        } else {
          // On default map view: show Metro at zoom >= 12, all stops at zoom >= 13
          if (stop.m === 'METRO' ? zoom < 12 : zoom < 13) continue;
        }
        if (!bounds.contains([stop.lat, stop.lng])) continue;
      }

      const ringColor = getStationRingColor(stop.m);
      const radius = isSelected ? 8.5 : zoom >= 16 ? 7 : 6.2;

      const marker = L.circleMarker([stop.lat, stop.lng], {
        renderer,
        radius,
        color: ringColor,
        weight: isSelected ? 3 : 2.3,
        fillColor: isSelected ? ringColor : '#ffffff',
        fillOpacity: 1
      });

      marker.on('click', ev => {
        L.DomEvent.stopPropagation(ev);
        if (latestRef.current.pickingMapMode) {
          latestRef.current.onMapClickPick(stop.lat, stop.lng);
        } else {
          latestRef.current.onSelectStop(stop);
        }
      });

      if (zoom >= 15 || isSelected || isOnActiveLine) {
        marker.bindTooltip(stop.n, {
          direction: 'top',
          offset: [0, -6],
          className: 'stb-stop-tooltip'
        });
      }

      marker.addTo(stopsLayer);
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
        // White casing underneath + colored line on top (1:1 info.stb.ro style)
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
            opacity: 0.9
          }).addTo(plannerLayer);
        } else {
          L.polyline(leg.geometry, {
            color: '#ffffff',
            weight: 8,
            opacity: 0.95
          }).addTo(plannerLayer);
          L.polyline(leg.geometry, {
            color: leg.color || '#33AA44',
            weight: 5,
            opacity: 0.95
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

  // Render user GPS blue dot + accuracy circle
  useEffect(() => {
    const userLayer = userLayerRef.current;
    if (!userLayer) return;
    userLayer.clearLayers();
    if (!userLocation) return;

    if (userLocation.accuracy && userLocation.accuracy < 1500) {
      L.circle([userLocation.lat, userLocation.lng], {
        radius: userLocation.accuracy,
        color: '#3559d9',
        weight: 1,
        fillColor: '#3559d9',
        fillOpacity: 0.12,
        interactive: false
      }).addTo(userLayer);
    }

    L.circleMarker([userLocation.lat, userLocation.lng], {
      radius: 7,
      color: '#ffffff',
      weight: 2.5,
      fillColor: '#3559d9',
      fillOpacity: 1
    }).addTo(userLayer);
  }, [userLocation]);

  // Execute programmatic map focus commands
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapFocusCommand) return;
    map.flyTo(
      [mapFocusCommand.lat, mapFocusCommand.lng],
      mapFocusCommand.zoom ?? Math.max(map.getZoom(), 16),
      { duration: 0.55 }
    );
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
