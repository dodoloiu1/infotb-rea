import { useEffect, useState } from 'preact/hooks';
import type {
  FavoriteItem,
  PlacePoint,
  PlannedItinerary,
  PlannerOptions,
  StaticTransitData,
  StopItem
} from '../types';
import type { Translations } from '../i18n/translations';
import { searchPlacesAndStops, type SearchSuggestionsResult } from '../api/tpbiService';
import { formatDistance, formatDuration } from '../utils/geo';
import {
  CloseXSvg,
  CrosshairSvg,
  ModeMiniSvg,
  SearchMagnifierSvg,
  StarSvg,
  SwapVerticalSvg,
  WalkPersonSvg,
  WheelchairSvg
} from './OfficialSvgs';

interface RoutePlannerDrawerProps {
  data: StaticTransitData | null;
  fromPoint: PlacePoint | null;
  toPoint: PlacePoint | null;
  options: PlannerOptions;
  itineraries: PlannedItinerary[];
  selectedItinerary: PlannedItinerary | null;
  searching: boolean;
  hasSearched: boolean;
  pickingMapTarget: 'from' | 'to' | null;
  favorites: FavoriteItem[];
  history: PlacePoint[];
  t: Translations;
  onSetFrom: (pt: PlacePoint | null) => void;
  onSetTo: (pt: PlacePoint | null) => void;
  onSwap: () => void;
  onUseCurrentLocation: (target: 'from' | 'to') => void;
  onStartPickOnMap: (target: 'from' | 'to' | null) => void;
  onChangeOptions: (next: PlannerOptions) => void;
  onSearchRoutes: () => void;
  onSelectItinerary: (it: PlannedItinerary | null) => void;
  onFocusStopStep: (lat: number, lng: number, code?: string) => void;
}

export function RoutePlannerDrawer({
  data,
  fromPoint,
  toPoint,
  options,
  itineraries,
  selectedItinerary,
  searching,
  hasSearched,
  pickingMapTarget,
  favorites,
  history,
  t,
  onSetFrom,
  onSetTo,
  onSwap,
  onUseCurrentLocation,
  onStartPickOnMap,
  onChangeOptions,
  onSearchRoutes,
  onSelectItinerary,
  onFocusStopStep
}: RoutePlannerDrawerProps) {
  const [activeField, setActiveField] = useState<'from' | 'to' | null>(null);
  const [fromText, setFromText] = useState(fromPoint?.label || '');
  const [toText, setToText] = useState(toPoint?.label || '');
  const [suggestions, setSuggestions] = useState<SearchSuggestionsResult>({
    stops: [],
    lines: [],
    places: []
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedLegIdx, setExpandedLegIdx] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setFromText(fromPoint?.label || '');
  }, [fromPoint]);

  useEffect(() => {
    setToText(toPoint?.label || '');
  }, [toPoint]);

  const activeQuery = activeField === 'from' ? fromText : activeField === 'to' ? toText : '';

  useEffect(() => {
    if (!data || !activeField || !activeQuery.trim()) {
      setSuggestions({ stops: [], lines: [], places: [] });
      return;
    }
    const q = activeQuery.trim();
    if (
      (activeField === 'from' && fromPoint?.label === q) ||
      (activeField === 'to' && toPoint?.label === q)
    ) {
      setSuggestions({ stops: [], lines: [], places: [] });
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const res = await searchPlacesAndStops(q, data);
      if (!cancelled) setSuggestions(res);
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeQuery, activeField, data, fromPoint, toPoint]);

  const applyChoice = (target: 'from' | 'to', pt: PlacePoint) => {
    if (target === 'from') {
      onSetFrom(pt);
      setFromText(pt.label);
    } else {
      onSetTo(pt);
      setToText(pt.label);
    }
    setActiveField(null);
    onStartPickOnMap(null);
  };

  // Detailed itinerary view ("Vezi detalii")
  if (selectedItinerary) {
    return (
      <div class="plannerDetailsContainer">
        <button
          type="button"
          class="backToResultsBtn"
          onClick={() => onSelectItinerary(null)}
        >
          ← {t.backToResults}
        </button>

        <div class="itinerarySummaryBanner">
          <div class="itinSummaryMain">
            <strong>
              {formatDuration(selectedItinerary.durationSeconds, t.hrShort, t.minShort)}
            </strong>
            <span>
              {selectedItinerary.departureTime} – {selectedItinerary.arrivalTime}
            </span>
          </div>
          <div class="itinSummarySub">
            <span>
              {selectedItinerary.transfers === 0
                ? t.directRoute
                : t.transfersCount(selectedItinerary.transfers)}
            </span>
            <span>·</span>
            <span>
              {t.walkLegLabel}: {formatDistance(selectedItinerary.walkMeters, t.metersLabel)}
            </span>
          </div>
        </div>

        <div class="itineraryLegsScroll">
          {selectedItinerary.legs.map((leg, idx) => {
            const isExpanded = Boolean(expandedLegIdx[idx]);
            if (leg.type === 'walk') {
              return (
                <div key={idx} class="itinLegCard walkLeg">
                  <div class="legIconCol">
                    <span class="walkDot">
                      <WalkPersonSvg size={18} color="#58586b" />
                    </span>
                    <span class="legVerticalLine dashed" />
                  </div>
                  <div class="legBodyCol">
                    <div class="legHeaderRow">
                      <strong>{t.walkLegLabel}</strong>
                      <span class="legMetaText">
                        {formatDistance(leg.distanceMeters, t.metersLabel)} ·{' '}
                        {formatDuration(leg.durationSeconds, t.hrShort, t.minShort)}
                      </span>
                    </div>
                    <div class="legFromTo">
                      {leg.fromName} → {leg.toName}
                    </div>
                  </div>
                </div>
              );
            }

            const interStops = leg.stops.slice(1, -1);

            return (
              <div key={idx} class="itinLegCard ptLeg">
                <div class="legIconCol">
                  <span
                    class="ptDot"
                    style={{ backgroundColor: leg.color || '#33AA44' }}
                  >
                    <ModeMiniSvg cat={leg.category || 'BUS'} color="#ffffff" size={15} />
                  </span>
                  <span
                    class="legVerticalLine"
                    style={{ backgroundColor: leg.color || '#33AA44' }}
                  />
                </div>
                <div class="legBodyCol">
                  <div class="legHeaderRow">
                    <span
                      class="linePillMini"
                      style={{ backgroundColor: leg.color || '#33AA44' }}
                    >
                      {leg.lineName}
                    </span>
                    {leg.headsign && <span class="legHeadsign">→ {leg.headsign}</span>}
                    {leg.hasDisability && <WheelchairSvg size={15} />}
                  </div>

                  <div
                    class="legEndpoint clickable"
                    onClick={() =>
                      leg.stops[0] &&
                      onFocusStopStep(leg.stops[0].lat, leg.stops[0].lng, leg.stops[0].code)
                    }
                  >
                    <span class="legClock">{leg.departureTime}</span>
                    <span>
                      {t.boardAt}: <strong>{leg.fromName}</strong>
                    </span>
                  </div>

                  {interStops.length > 0 && (
                    <div class="interStopsSection">
                      <button
                        type="button"
                        class="textLinkBtn"
                        onClick={() =>
                          setExpandedLegIdx(prev => ({ ...prev, [idx]: !prev[idx] }))
                        }
                      >
                        {isExpanded ? '▾' : '▸'} {t.intermediateStops(interStops.length)} (
                        {formatDuration(leg.durationSeconds, t.hrShort, t.minShort)})
                      </button>
                      {isExpanded && (
                        <ul class="interStopsList">
                          {interStops.map((st, sIdx) => (
                            <li
                              key={`${st.code || st.name}-${sIdx}`}
                              onClick={() => onFocusStopStep(st.lat, st.lng, st.code)}
                            >
                              {st.time && <span class="interStopTime">{st.time}</span>}
                              <span>{st.name}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  <div
                    class="legEndpoint clickable"
                    onClick={() => {
                      const last = leg.stops[leg.stops.length - 1];
                      if (last) onFocusStopStep(last.lat, last.lng, last.code);
                    }}
                  >
                    <span class="legClock">{leg.arrivalTime}</span>
                    <span>
                      {t.alightAt}: <strong>{leg.toName}</strong>
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const favPlacesAndStops = favorites.filter(f => f.lat !== undefined && f.lng !== undefined);

  const renderFieldDropdown = (target: 'from' | 'to') => {
    if (activeField !== target) return null;
    const hasSuggestions =
      suggestions.stops.length > 0 || suggestions.places.length > 0;

    return (
      <div class="plannerDropdownPanel">
        <div class="quickPickRow">
          <button
            type="button"
            class="quickPickChip"
            onClick={() => {
              setActiveField(null);
              onUseCurrentLocation(target);
            }}
          >
            <span class="quickChipIcon">
              <CrosshairSvg />
            </span>
            <span>{t.useCurrentLocation}</span>
          </button>

          <button
            type="button"
            class={`quickPickChip ${pickingMapTarget === target ? 'active' : ''}`}
            onClick={() => {
              setActiveField(null);
              onStartPickOnMap(pickingMapTarget === target ? null : target);
            }}
          >
            <span>📍 {t.pickPointOnMap}</span>
          </button>
        </div>

        {hasSuggestions ? (
          <div class="plannerSuggestList">
            {suggestions.stops.map(st => (
              <div
                key={st.c}
                class="placeContainer"
                onClick={() =>
                  applyChoice(target, {
                    label: st.n,
                    sublabel: `${st.s ? st.s + ' · ' : ''}#${st.c}`,
                    lat: st.lat,
                    lng: st.lng,
                    stopCode: st.c
                  })
                }
              >
                <ModeMiniSvg cat={st.m} color="#58586b" size={17} />
                <div class="textCont">
                  <div class="name">{st.n}</div>
                  <div class="description">
                    {st.s ? `${st.s} · ` : ''}#{st.c}
                  </div>
                </div>
              </div>
            ))}
            {suggestions.places.map(pl => (
              <div
                key={pl.id || `${pl.lat}-${pl.lng}`}
                class="placeContainer"
                onClick={() => applyChoice(target, pl)}
              >
                <div class="textCont">
                  <div class="name">{pl.label}</div>
                  {pl.sublabel && <div class="description">{pl.sublabel}</div>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div class="plannerSavedLists">
            {favPlacesAndStops.length > 0 && (
              <div class="miniGroup">
                <div class="miniGroupLabel">{t.favoritesGroup}</div>
                {favPlacesAndStops.slice(0, 5).map(fav => (
                  <div
                    key={fav.id}
                    class="placeContainer"
                    onClick={() =>
                      applyChoice(target, {
                        label: fav.name,
                        sublabel: fav.description,
                        lat: fav.lat!,
                        lng: fav.lng!,
                        stopCode: fav.stopCode
                      })
                    }
                  >
                    <StarSvg filled={true} size={16} />
                    <div class="textCont">
                      <div class="name">{fav.name}</div>
                      {fav.description && <div class="description">{fav.description}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {history.length > 0 && (
              <div class="miniGroup">
                <div class="miniGroupLabel">{t.historyGroup}</div>
                {history.slice(0, 4).map((h, idx) => (
                  <div
                    key={`${h.label}-${idx}`}
                    class="placeContainer"
                    onClick={() => applyChoice(target, h)}
                  >
                    <div class="textCont">
                      <div class="name">{h.label}</div>
                      {h.sublabel && <div class="description">{h.sublabel}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div class="plannerDrawerRoot">
      <div class="plannerInputsWrap">
        <div class="plannerEndpointsStack">
          {/* DE LA */}
          <div class="fromSearchContainer">
            <div class="formConainer">
              <span class="endpointDot startDot" />
              <span class="directionText">{t.fromLabel}</span>
              <div class="inputContainer">
                <input
                  type="text"
                  value={fromText}
                  placeholder={t.chooseStartPlaceholder}
                  onFocus={() => setActiveField('from')}
                  onInput={e => {
                    setFromText((e.target as HTMLInputElement).value);
                    setActiveField('from');
                  }}
                />
              </div>
              <button
                type="button"
                class="searchIcon"
                onClick={() => {
                  if (fromText) {
                    setFromText('');
                    onSetFrom(null);
                    setActiveField('from');
                  } else {
                    setActiveField(activeField === 'from' ? null : 'from');
                  }
                }}
              >
                {fromText ? <CloseXSvg size={18} /> : <SearchMagnifierSvg size={19} />}
              </button>
            </div>
            {renderFieldDropdown('from')}
          </div>

          {/* PÂNĂ LA */}
          <div class="fromSearchContainer">
            <div class="formConainer">
              <span class="endpointDot endDot" />
              <span class="directionText">{t.toLabel}</span>
              <div class="inputContainer">
                <input
                  type="text"
                  value={toText}
                  placeholder={t.chooseEndPlaceholder}
                  onFocus={() => setActiveField('to')}
                  onInput={e => {
                    setToText((e.target as HTMLInputElement).value);
                    setActiveField('to');
                  }}
                />
              </div>
              <button
                type="button"
                class="searchIcon"
                onClick={() => {
                  if (toText) {
                    setToText('');
                    onSetTo(null);
                    setActiveField('to');
                  } else {
                    setActiveField(activeField === 'to' ? null : 'to');
                  }
                }}
              >
                {toText ? <CloseXSvg size={18} /> : <SearchMagnifierSvg size={19} />}
              </button>
            </div>
            {renderFieldDropdown('to')}
          </div>
        </div>

        <button
          type="button"
          class="swapEndpointsBtn"
          title={t.swapPoints}
          aria-label={t.swapPoints}
          onClick={onSwap}
        >
          <SwapVerticalSvg size={20} />
        </button>
      </div>

      {pickingMapTarget && (
        <div class="mapPickBanner">
          <span>
            {pickingMapTarget === 'from' ? t.pickStartOnMapHint : t.pickEndOnMapHint}
          </span>
          <button
            type="button"
            class="textLinkBtn"
            onClick={() => onStartPickOnMap(null)}
          >
            {t.cancelBtn}
          </button>
        </div>
      )}

      {/* Start Time & Start Date row */}
      <div class="plannerDateTimeRow">
        <div class="timeBoxCompact">
          <label class="smallFieldLabel">{t.startTimeLabel}</label>
          <div class="timeControlInline">
            <label class="nowCheckboxLabel">
              <input
                type="checkbox"
                checked={options.useCurrentTime}
                onChange={e =>
                  onChangeOptions({
                    ...options,
                    useCurrentTime: (e.target as HTMLInputElement).checked
                  })
                }
              />
              <span>{t.leaveNow}</span>
            </label>
            {!options.useCurrentTime && (
              <input
                type="time"
                class="nativeTimeInput"
                value={`${String(options.startHour).padStart(2, '0')}:${String(
                  options.startMinute
                ).padStart(2, '0')}`}
                onChange={e => {
                  const [hh, mm] = (e.target as HTMLInputElement).value
                    .split(':')
                    .map(Number);
                  onChangeOptions({
                    ...options,
                    startHour: isNaN(hh) ? 8 : hh,
                    startMinute: isNaN(mm) ? 0 : mm
                  });
                }}
              />
            )}
          </div>
        </div>

        <div class="dateBoxCompact">
          <label class="smallFieldLabel">{t.startDateLabel}</label>
          <input
            type="date"
            class="nativeDateInput"
            value={options.startDateIso}
            onChange={e =>
              onChangeOptions({
                ...options,
                startDateIso: (e.target as HTMLInputElement).value
              })
            }
          />
        </div>
      </div>

      <button
        type="button"
        class="advancedToggleBtn"
        onClick={() => setShowAdvanced(v => !v)}
      >
        {showAdvanced ? `▴ ${t.hideAdvancedOptions}` : `▾ ${t.showAdvancedOptions}`}
      </button>

      {showAdvanced && (
        <div class="advancedOptionsPanel">
          <div class="advGroup">
            <div class="advLabelRow">
              <span>{t.maxWalkLabel}</span>
              <strong>{options.maxWalkMeters} m</strong>
            </div>
            <input
              type="range"
              min={300}
              max={2000}
              step={100}
              value={options.maxWalkMeters}
              onInput={e =>
                onChangeOptions({
                  ...options,
                  maxWalkMeters: Number((e.target as HTMLInputElement).value)
                })
              }
            />
          </div>

          <div class="advGroup">
            <div class="advLabelRow">
              <span>{t.transportModesLabel}</span>
            </div>
            <div class="modesCheckGrid">
              {(
                [
                  ['TRAM', t.modeTram],
                  ['TROLLEY', t.modeTrolley],
                  ['BUS', t.modeBus],
                  ['METRO', t.modeMetro]
                ] as const
              ).map(([modeKey, label]) => (
                <label key={modeKey} class="modeCheckboxItem">
                  <input
                    type="checkbox"
                    checked={options.allowedModes[modeKey]}
                    onChange={e =>
                      onChangeOptions({
                        ...options,
                        allowedModes: {
                          ...options.allowedModes,
                          [modeKey]: (e.target as HTMLInputElement).checked
                        }
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <label class="modeCheckboxItem">
            <input
              type="checkbox"
              checked={options.disabilityFriendly}
              onChange={e =>
                onChangeOptions({
                  ...options,
                  disabilityFriendly: (e.target as HTMLInputElement).checked
                })
              }
            />
            <WheelchairSvg size={16} />
            <span>{t.disabilityFriendlyLabel}</span>
          </label>
        </div>
      )}

      <button
        type="button"
        class="findBestRoutesCta"
        disabled={!fromPoint || !toPoint || searching}
        onClick={onSearchRoutes}
      >
        {searching ? t.searchingRoutes : t.findBestRoutesBtn}
      </button>

      {/* Route Results */}
      <div class="plannerResultsScroll">
        {hasSearched && !searching && itineraries.length === 0 && (
          <div class="noResults">{t.noRoutesFound}</div>
        )}

        {itineraries.map(itin => (
          <div
            key={itin.id}
            class="routeResultCard"
            onClick={() => onSelectItinerary(itin)}
          >
            <div class="routeCardTop">
              <div class="routeDurationText">
                {formatDuration(itin.durationSeconds, t.hrShort, t.minShort)}
              </div>
              <div class="routeClockSpan">
                {itin.departureTime} – {itin.arrivalTime}
              </div>
            </div>

            <div class="routeLegsChain">
              {itin.legs.map((lg, i) => (
                <span key={i} class="chainItem">
                  {i > 0 && <span class="chainChevron">›</span>}
                  {lg.type === 'walk' ? (
                    <span class="chainWalk">
                      <WalkPersonSvg size={15} />
                      <small>{Math.max(1, Math.round(lg.durationSeconds / 60))}'</small>
                    </span>
                  ) : (
                    <span
                      class="linePillMini"
                      style={{ backgroundColor: lg.color || '#33AA44' }}
                    >
                      {lg.lineName}
                    </span>
                  )}
                </span>
              ))}
            </div>

            <div class="routeCardFooter">
              <span class="leavesInTag">
                {itin.leavesInSeconds > 0
                  ? `${t.leavesIn} ${Math.max(1, Math.round(itin.leavesInSeconds / 60))} ${
                      t.minShort
                    }`
                  : t.directRoute}
                {' · '}
                {itin.transfers === 0 ? t.directRoute : t.transfersCount(itin.transfers)}
              </span>
              <span class="seeDetailsLink">{t.seeDetails} →</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
