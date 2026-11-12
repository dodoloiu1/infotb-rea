import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import type {
  ActivePanel,
  FavoriteItem,
  LangCode,
  LineDirectionFilter,
  LiveVehicle,
  PlacePoint,
  PlannedItinerary,
  PlannerOptions,
  RouteShapesMap,
  StaticTransitData,
  StationArrivalsResult,
  StopItem,
  TransitLine,
  TransitNotification
} from './types';
import { TRANSLATIONS } from './i18n/translations';
import {
  fetchLiveVehicles,
  fetchStationArrivals,
  fetchTransitNotifications,
  loadRouteShapes,
  loadStaticTransitData,
  planTransitRoute
} from './api/tpbiService';
import {
  loadFavorites,
  loadSavedLang,
  loadSearchHistory,
  saveFavorites,
  saveLang,
  saveSearchHistory
} from './state/storage';
import { FixSideNav } from './components/FixSideNav';
import { MapCanvas } from './components/MapCanvas';
import { MapDestinationSearch } from './components/MapDestinationSearch';
import { LinesDrawer } from './components/LinesDrawer';
import { RoutePlannerDrawer } from './components/RoutePlannerDrawer';
import { FavoritesDrawer } from './components/FavoritesDrawer';
import { ViewLineContent } from './components/ViewLineContent';
import { NotificationsModal } from './components/NotificationsModal';
import { CloseXSvg } from './components/OfficialSvgs';

const REFRESH_CYCLE_SECONDS = 20;
const MAX_LINES_LIMIT = 50;

function getTodayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function App() {
  const [lang, setLang] = useState<LangCode>(() => loadSavedLang());
  const t = TRANSLATIONS[lang];

  const [data, setData] = useState<StaticTransitData | null>(null);
  const [shapes, setShapes] = useState<RouteShapesMap | null>(null);
  const [liveVehicles, setLiveVehicles] = useState<LiveVehicle[]>([]);
  const [notifications, setNotifications] = useState<TransitNotification[]>([]);

  const [activePanel, setActivePanel] = useState<ActivePanel>('map');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [selectedLineNames, setSelectedLineNames] = useState<string[]>([]);
  const [lineDirectionFilter, setLineDirectionFilter] = useState<LineDirectionFilter>('both');
  const [inspectedLine, setInspectedLine] = useState<TransitLine | null>(null);

  const [selectedStop, setSelectedStop] = useState<StopItem | null>(null);
  const [arrivalsResult, setArrivalsResult] = useState<StationArrivalsResult | null>(null);
  const [loadingArrivals, setLoadingArrivals] = useState(false);

  const [refreshSecondsLeft, setRefreshSecondsLeft] = useState(REFRESH_CYCLE_SECONDS);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Planner state
  const [fromPoint, setFromPoint] = useState<PlacePoint | null>(null);
  const [toPoint, setToPoint] = useState<PlacePoint | null>(null);
  const [plannerOptions, setPlannerOptions] = useState<PlannerOptions>(() => {
    const now = new Date();
    return {
      useCurrentTime: true,
      startDateIso: getTodayIso(),
      startHour: now.getHours(),
      startMinute: now.getMinutes(),
      maxWalkMeters: 900,
      allowedModes: { TRAM: true, TROLLEY: true, BUS: true, METRO: true },
      disabilityFriendly: false
    };
  });
  const [itineraries, setItineraries] = useState<PlannedItinerary[]>([]);
  const [selectedItinerary, setSelectedItinerary] = useState<PlannedItinerary | null>(null);
  const [searchingRoutes, setSearchingRoutes] = useState(false);
  const [hasSearchedRoutes, setHasSearchedRoutes] = useState(false);
  const [pickingPlannerTarget, setPickingPlannerTarget] = useState<'from' | 'to' | null>(null);

  // Favorites & History (100% local in localStorage — zero login!)
  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => loadFavorites());
  const [history, setHistory] = useState<PlacePoint[]>(() => loadSearchHistory());
  const [pickingFavMap, setPickingFavMap] = useState(false);
  const [pendingFavCoords, setPendingFavCoords] = useState<{ lat: number; lng: number } | null>(
    null
  );

  // Geolocation & Map Focus
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(null);
  const [mapFocusCommand, setMapFocusCommand] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
    seq: number;
  } | null>(null);
  const focusSeqRef = useRef(1);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  const focusMap = useCallback((lat: number, lng: number, zoom?: number) => {
    focusSeqRef.current += 1;
    setMapFocusCommand({ lat, lng, zoom, seq: focusSeqRef.current });
  }, []);

  const pushHistory = useCallback((pt: PlacePoint) => {
    setHistory(prev => {
      const dedup = prev.filter(p => p.label !== pt.label);
      const next = [pt, ...dedup].slice(0, 10);
      saveSearchHistory(next);
      return next;
    });
  }, []);

  // Initial static dataset + shapes + notifications + first live vehicles fetch
  useEffect(() => {
    let mounted = true;
    loadStaticTransitData()
      .then(async loadedData => {
        if (!mounted) return;
        setData(loadedData);

        const loadedShapes = await loadRouteShapes();
        if (!mounted) return;
        setShapes(loadedShapes);

        fetchTransitNotifications(loadedData).then(notifs => {
          if (mounted) setNotifications(notifs);
        });

        fetchLiveVehicles(loadedData, loadedShapes).then(vehs => {
          if (mounted) setLiveVehicles(vehs);
        });

        // Support optional query params (?line=41 or ?station=3100)
        const params = new URLSearchParams(window.location.search);
        const qLine = params.get('line');
        const qStation = params.get('station');
        if (qLine && loadedData.lineByName.has(qLine)) {
          const ln = loadedData.lineByName.get(qLine)!;
          setSelectedLineNames([ln.name]);
          setInspectedLine(ln);
          setActivePanel('lines');
          setDrawerOpen(true);
        } else if (qStation && loadedData.stopByCode.has(qStation)) {
          const st = loadedData.stopByCode.get(qStation)!;
          setSelectedStop(st);
          focusMap(st.lat, st.lng, 16);
        }
      })
      .catch(err => {
        console.error('Failed to initialize TPBI transit dataset:', err);
      });

    return () => {
      mounted = false;
    };
  }, [focusMap]);

  // Fetch station arrivals whenever `selectedStop` or `liveVehicles` updates
  useEffect(() => {
    if (!selectedStop || !data) {
      setArrivalsResult(null);
      return;
    }
    let cancelled = false;
    setLoadingArrivals(true);
    fetchStationArrivals(selectedStop, liveVehicles, data, shapes)
      .then(res => {
        if (!cancelled) {
          setArrivalsResult(res);
          setLoadingArrivals(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingArrivals(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedStop, liveVehicles, data, shapes]);

  // 20-second TPBI live data refresh loop + 1-second visual countdown bar
  useEffect(() => {
    if (!data) return;
    const interval = window.setInterval(() => {
      setRefreshSecondsLeft(prev => {
        if (prev <= 1) {
          fetchLiveVehicles(data, shapes).then(vehs => {
            if (vehs.length > 0) setLiveVehicles(vehs);
          });
          return REFRESH_CYCLE_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [data, shapes]);

  const handleSelectPanel = useCallback(
    (panel: ActivePanel) => {
      setNotificationsOpen(false);
      if (panel === 'map') {
        setActivePanel('map');
        setDrawerOpen(false);
        setPickingPlannerTarget(null);
        setPickingFavMap(false);
        return;
      }
      if (activePanel === panel && drawerOpen) {
        setDrawerOpen(false);
      } else {
        setActivePanel(panel);
        setDrawerOpen(true);
      }
    },
    [activePanel, drawerOpen]
  );

  const handleSwitchLang = useCallback((nextLang: LangCode) => {
    setLang(nextLang);
    saveLang(nextLang);
    document.documentElement.lang = nextLang;
  }, []);

  const handleSelectStop = useCallback(
    (stop: StopItem) => {
      setSelectedStop(stop);
      setRefreshSecondsLeft(REFRESH_CYCLE_SECONDS);
      focusMap(stop.lat, stop.lng, 16);
      pushHistory({
        label: stop.n,
        sublabel: `${stop.s ? stop.s + ' · ' : ''}#${stop.c}`,
        lat: stop.lat,
        lng: stop.lng,
        stopCode: stop.c
      });
      if (window.innerWidth < 768) {
        setDrawerOpen(false);
      }
    },
    [focusMap, pushHistory]
  );

  const handleToggleLine = useCallback(
    (line: TransitLine) => {
      setSelectedLineNames(prev => {
        if (prev.includes(line.name)) {
          const next = prev.filter(n => n !== line.name);
          if (inspectedLine?.name === line.name) {
            setInspectedLine(next.length > 0 ? data?.lineByName.get(next[next.length - 1]) || null : null);
          }
          return next;
        }
        if (prev.length >= MAX_LINES_LIMIT) {
          showToast(t.linesLimitWarning(MAX_LINES_LIMIT));
          return prev;
        }
        setSelectedStop(null);
        setInspectedLine(line);
        setLineDirectionFilter('both');
        return [...prev, line.name];
      });
    },
    [data, inspectedLine, showToast, t]
  );

  const handleRemoveSingleLine = useCallback(
    (lineName: string) => {
      setSelectedLineNames(prev => {
        const next = prev.filter(n => n !== lineName);
        if (inspectedLine?.name === lineName) {
          setInspectedLine(next.length > 0 ? data?.lineByName.get(next[next.length - 1]) || null : null);
        }
        return next;
      });
    },
    [data, inspectedLine]
  );

  const handleFocusSingleLine = useCallback(
    (line: TransitLine, dir?: 0 | 1) => {
      setSelectedLineNames(prev => (prev.includes(line.name) ? prev : [...prev, line.name]));
      setLineDirectionFilter(dir === 0 ? 'tur' : dir === 1 ? 'retur' : 'both');
      setInspectedLine(line);
      pushHistory({
        label: `Linia ${line.name}`,
        sublabel: `${line.d0.to} ↔ ${line.d1.to}`,
        lat: 44.4353,
        lng: 26.0997,
        lineName: line.name
      });
      if (window.innerWidth < 768) {
        setDrawerOpen(false);
      }
    },
    [pushHistory]
  );

  const handleResetLines = useCallback(() => {
    setSelectedLineNames([]);
    setInspectedLine(null);
    setLineDirectionFilter('both');
  }, []);

  const handleToggleFavoriteStop = useCallback((stop: StopItem) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.kind === 'stop' && f.stopCode === stop.c);
      const next = exists
        ? prev.filter(f => !(f.kind === 'stop' && f.stopCode === stop.c))
        : [
            {
              id: `fav-stop-${stop.c}`,
              kind: 'stop' as const,
              name: stop.n,
              description: `${stop.s ? stop.s + ' · ' : ''}#${stop.c}`,
              lat: stop.lat,
              lng: stop.lng,
              stopCode: stop.c
            },
            ...prev
          ];
      saveFavorites(next);
      return next;
    });
  }, []);

  const handleToggleFavoriteLine = useCallback((line: TransitLine) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.kind === 'line' && f.lineName === line.name);
      const next = exists
        ? prev.filter(f => !(f.kind === 'line' && f.lineName === line.name))
        : [
            {
              id: `fav-line-${line.name}`,
              kind: 'line' as const,
              name: `Linia ${line.name}`,
              description: `${line.d0.to} ↔ ${line.d1.to}`,
              lineName: line.name,
              color: line.color
            },
            ...prev
          ];
      saveFavorites(next);
      return next;
    });
  }, []);

  const obtainCoords = useCallback(async (): Promise<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null> => {
    try {
      if (Capacitor.isNativePlatform()) {
        const perm = await Geolocation.checkPermissions();
        if (perm.location !== 'granted') {
          await Geolocation.requestPermissions();
        }
        const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true });
        return {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
      }
      if ('geolocation' in navigator) {
        return await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            p =>
              resolve({
                lat: p.coords.latitude,
                lng: p.coords.longitude,
                accuracy: p.coords.accuracy
              }),
            err => reject(err),
            { enableHighAccuracy: true, timeout: 7000 }
          );
        });
      }
    } catch {
      // ignore permission denial
    }
    return null;
  }, []);

  const handleRequestMyLocation = useCallback(async () => {
    setPickingPlannerTarget(null);
    setPickingFavMap(false);
    const loc = await obtainCoords();
    if (loc) {
      setUserLocation(loc);
      focusMap(loc.lat, loc.lng, 16);
    } else {
      showToast('Nu s-a putut obține locația GPS.');
    }
  }, [obtainCoords, focusMap, showToast]);

  const handleUseCurrentLocationForPlanner = useCallback(
    async (target: 'from' | 'to') => {
      setPickingPlannerTarget(null);
      const loc = (await obtainCoords()) || userLocation;
      if (!loc) {
        showToast('Activează permisiunea de locație sau alege un punct pe hartă.');
        return;
      }
      setUserLocation(loc);
      const pt: PlacePoint = {
        label: t.useCurrentLocation,
        lat: loc.lat,
        lng: loc.lng,
        isCurrentLocation: true
      };
      if (target === 'from') {
        setFromPoint(pt);
        if (!toPoint) focusMap(loc.lat, loc.lng, 16);
      } else {
        setToPoint(pt);
        if (!fromPoint) focusMap(loc.lat, loc.lng, 16);
      }
    },
    [obtainCoords, userLocation, t, showToast, fromPoint, toPoint, focusMap]
  );

  const handleDirectionsToTarget = useCallback(
    (pt: PlacePoint) => {
      setToPoint(pt);
      setSelectedItinerary(null);
      setItineraries([]);
      setHasSearchedRoutes(false);
      setSelectedStop(null);
      setInspectedLine(null);
      setActivePanel('planner');
      setDrawerOpen(true);
      pushHistory(pt);
      if (!fromPoint && userLocation) {
        setFromPoint({
          label: t.useCurrentLocation,
          lat: userLocation.lat,
          lng: userLocation.lng,
          isCurrentLocation: true
        });
      }
    },
    [fromPoint, userLocation, t, pushHistory]
  );

  const handleSearchRoutes = useCallback(async () => {
    if (!data || !fromPoint || !toPoint) return;
    setSearchingRoutes(true);
    setHasSearchedRoutes(true);
    setSelectedItinerary(null);
    try {
      const routes = await planTransitRoute(fromPoint, toPoint, plannerOptions, data, shapes);
      setItineraries(routes);
    } finally {
      setSearchingRoutes(false);
    }
  }, [data, shapes, fromPoint, toPoint, plannerOptions]);

  const handleDragEndpoint = useCallback(
    (which: 'from' | 'to', lat: number, lng: number) => {
      const pt: PlacePoint = {
        label: `${t.pickPointOnMap} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        lat,
        lng,
        isPointOnMap: true
      };
      if (which === 'from') setFromPoint(pt);
      else setToPoint(pt);
    },
    [t]
  );

  const pickingMapMode: 'from' | 'to' | 'fav' | null = pickingPlannerTarget
    ? pickingPlannerTarget
    : pickingFavMap
      ? 'fav'
      : null;

  const handleMapClickPick = useCallback(
    (lat: number, lng: number) => {
      if (pickingPlannerTarget) {
        const pt: PlacePoint = {
          label: `${t.pickPointOnMap} (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
          lat,
          lng,
          isPointOnMap: true
        };
        if (pickingPlannerTarget === 'from') setFromPoint(pt);
        else setToPoint(pt);
        setPickingPlannerTarget(null);
        setDrawerOpen(true);
      } else if (pickingFavMap) {
        setPendingFavCoords({ lat, lng });
        setPickingFavMap(false);
        setDrawerOpen(true);
      }
    },
    [pickingPlannerTarget, pickingFavMap, t]
  );

  const previewItinerary = useMemo(() => {
    if (activePanel !== 'planner') return null;
    return selectedItinerary || itineraries[0] || null;
  }, [activePanel, selectedItinerary, itineraries]);

  return (
    <div class="applicationContainer">
      {/* Official 60px Green Left Navigation Rail (#33AA44) — ZERO login & ZERO payment */}
      <FixSideNav
        activePanel={activePanel}
        drawerOpen={drawerOpen}
        notificationsOpen={notificationsOpen}
        notificationsCount={notifications.length}
        lang={lang}
        t={t}
        onSelectPanel={handleSelectPanel}
        onOpenNotifications={() => setNotificationsOpen(true)}
        onSwitchLang={handleSwitchLang}
      />

      {/* Left Sliding Drawer (400px desktop, full-width sheet on mobile) */}
      {drawerOpen && activePanel !== 'map' && (
        <section class="sideNavConainer" aria-label={activePanel}>
          <div class="mobileDrawerTopBar">
            <span class="mobileDrawerTitle">
              {activePanel === 'planner'
                ? t.plannerTitle
                : activePanel === 'lines'
                  ? t.navLines
                  : t.favoritesTitle}
            </span>
            <button
              type="button"
              class="iconCircleBtn"
              aria-label={t.closeBtn}
              onClick={() => setDrawerOpen(false)}
            >
              <CloseXSvg size={20} />
            </button>
          </div>

          {activePanel === 'lines' && (
            <LinesDrawer
              lines={data?.lines || []}
              selectedLineNames={selectedLineNames}
              t={t}
              onToggleLine={handleToggleLine}
              onResetLines={handleResetLines}
            />
          )}

          {activePanel === 'planner' && (
            <RoutePlannerDrawer
              data={data}
              fromPoint={fromPoint}
              toPoint={toPoint}
              options={plannerOptions}
              itineraries={itineraries}
              selectedItinerary={selectedItinerary}
              searching={searchingRoutes}
              hasSearched={hasSearchedRoutes}
              pickingMapTarget={pickingPlannerTarget}
              favorites={favorites}
              history={history}
              t={t}
              onSetFrom={setFromPoint}
              onSetTo={setToPoint}
              onSwap={() => {
                setFromPoint(toPoint);
                setToPoint(fromPoint);
                setSelectedItinerary(null);
              }}
              onUseCurrentLocation={handleUseCurrentLocationForPlanner}
              onStartPickOnMap={target => {
                setPickingPlannerTarget(target);
                if (target && window.innerWidth < 768) {
                  setDrawerOpen(false);
                }
              }}
              onChangeOptions={setPlannerOptions}
              onSearchRoutes={handleSearchRoutes}
              onSelectItinerary={itin => {
                setSelectedItinerary(itin);
                if (itin && window.innerWidth < 768) {
                  // Keep details visible so user can inspect stops
                }
              }}
              onFocusStopStep={(lat, lng, code) => {
                focusMap(lat, lng, 16);
                if (code && data?.stopByCode.has(code)) {
                  setSelectedStop(data.stopByCode.get(code)!);
                }
              }}
            />
          )}

          {activePanel === 'favorites' && (
            <FavoritesDrawer
              favorites={favorites}
              data={data}
              pickingFavPointOnMap={pickingFavMap}
              pendingFavCoords={pendingFavCoords}
              t={t}
              onSelectStop={handleSelectStop}
              onSelectLine={ln => handleFocusSingleLine(ln)}
              onDirectionsToPlace={fav =>
                handleDirectionsToTarget({
                  label: fav.name,
                  sublabel: fav.description,
                  lat: fav.lat || 44.4353,
                  lng: fav.lng || 26.0997,
                  stopCode: fav.stopCode
                })
              }
              onStartPickMapFavorite={() => {
                setPickingFavMap(true);
                setPendingFavCoords(null);
                if (window.innerWidth < 768) setDrawerOpen(false);
              }}
              onCancelPickMapFavorite={() => {
                setPickingFavMap(false);
                setPendingFavCoords(null);
              }}
              onSavePickedMapFavorite={name => {
                if (!pendingFavCoords) return;
                const newFav: FavoriteItem = {
                  id: `fav-place-${Date.now()}`,
                  kind: 'place',
                  name,
                  description: `${pendingFavCoords.lat.toFixed(4)}, ${pendingFavCoords.lng.toFixed(
                    4
                  )}`,
                  lat: pendingFavCoords.lat,
                  lng: pendingFavCoords.lng
                };
                setFavorites(prev => {
                  const next = [newFav, ...prev];
                  saveFavorites(next);
                  return next;
                });
                setPendingFavCoords(null);
                focusMap(newFav.lat!, newFav.lng!, 16);
              }}
              onRemoveFavorite={id => {
                setFavorites(prev => {
                  const next = prev.filter(f => f.id !== id);
                  saveFavorites(next);
                  return next;
                });
              }}
            />
          )}
        </section>
      )}

      {/* Main Map Area (100% zero-API-key default map) */}
      <main class="main-page-body">
        <MapCanvas
          data={data}
          shapes={shapes}
          selectedLineNames={selectedLineNames}
          lineDirectionFilter={lineDirectionFilter}
          selectedStop={selectedStop}
          liveVehicles={liveVehicles}
          fromPoint={activePanel === 'planner' ? fromPoint : null}
          toPoint={activePanel === 'planner' ? toPoint : null}
          previewItinerary={previewItinerary}
          favorites={favorites}
          userLocation={userLocation}
          mapFocusCommand={mapFocusCommand}
          pickingMapMode={pickingMapMode}
          rightCardOpen={Boolean(selectedStop || inspectedLine)}
          t={t}
          onSelectStop={handleSelectStop}
          onMapClickPick={handleMapClickPick}
          onDragEndpoint={handleDragEndpoint}
          onChangeDirectionFilter={setLineDirectionFilter}
          onRequestMyLocation={handleRequestMyLocation}
          onRemoveLine={handleRemoveSingleLine}
          onResetLines={handleResetLines}
          onInspectLine={setInspectedLine}
        />

        {/* Top-left floating search bar ("Unde vrei să mergi?") when drawer is closed */}
        {!drawerOpen && (
          <MapDestinationSearch
            data={data}
            favorites={favorites}
            history={history}
            selectedLineNames={selectedLineNames}
            t={t}
            onSelectStop={handleSelectStop}
            onSelectLine={line => handleFocusSingleLine(line)}
            onToggleLine={handleToggleLine}
            onSelectPlaceForDirections={handleDirectionsToTarget}
            onToggleFavoriteStop={handleToggleFavoriteStop}
            onToggleFavoriteLine={handleToggleFavoriteLine}
            onClearHistory={() => {
              setHistory([]);
              saveSearchHistory([]);
            }}
          />
        )}

        {/* Right floating Station / Line card (.view-line-content) */}
        <ViewLineContent
          selectedStop={selectedStop}
          arrivalsResult={arrivalsResult}
          loadingArrivals={loadingArrivals}
          inspectedLine={!selectedStop ? inspectedLine : null}
          liveVehicles={liveVehicles}
          data={data}
          favorites={favorites}
          refreshSecondsLeft={refreshSecondsLeft}
          refreshCycleTotal={REFRESH_CYCLE_SECONDS}
          t={t}
          onClose={() => {
            if (selectedStop) {
              setSelectedStop(null);
            } else {
              setInspectedLine(null);
            }
          }}
          onToggleFavoriteStop={handleToggleFavoriteStop}
          onToggleFavoriteLine={handleToggleFavoriteLine}
          onDirectionsToStop={stop =>
            handleDirectionsToTarget({
              label: stop.n,
              sublabel: `${stop.s ? stop.s + ' · ' : ''}#${stop.c}`,
              lat: stop.lat,
              lng: stop.lng,
              stopCode: stop.c
            })
          }
          onFocusLineFromStop={(lineName, dir) => {
            const ln = data?.lineByName.get(lineName);
            if (ln) {
              setSelectedLineNames([ln.name]);
              setLineDirectionFilter(dir === 0 ? 'tur' : 'retur');
              setInspectedLine(ln);
            }
          }}
          onSelectStopFromLine={handleSelectStop}
        />

        {/* Toast Notification (e.g., max 3 lines limit) */}
        {toastMessage && <div class="stbToastWarning">{toastMessage}</div>}
      </main>

      {/* Official Notifications Modal */}
      <NotificationsModal
        open={notificationsOpen}
        notifications={notifications}
        data={data}
        lang={lang}
        t={t}
        onClose={() => setNotificationsOpen(false)}
        onSelectLine={ln => {
          setActivePanel('lines');
          setDrawerOpen(true);
          handleFocusSingleLine(ln);
        }}
        onFocusCoords={(lat, lng) => focusMap(lat, lng, 16)}
      />
    </div>
  );
}
