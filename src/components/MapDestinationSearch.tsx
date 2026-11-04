import { useEffect, useRef, useState } from 'preact/hooks';
import type { FavoriteItem, PlacePoint, StaticTransitData, StopItem, TransitLine } from '../types';
import type { Translations } from '../i18n/translations';
import { searchPlacesAndStops, type SearchSuggestionsResult } from '../api/tpbiService';
import { CloseXSvg, ModeMiniSvg, SearchMagnifierSvg, StarSvg } from './OfficialSvgs';

interface MapDestinationSearchProps {
  data: StaticTransitData | null;
  favorites: FavoriteItem[];
  history: PlacePoint[];
  t: Translations;
  onSelectStop: (stop: StopItem) => void;
  onSelectLine: (line: TransitLine) => void;
  onSelectPlaceForDirections: (place: PlacePoint) => void;
  onToggleFavoriteStop: (stop: StopItem) => void;
  onToggleFavoriteLine: (line: TransitLine) => void;
  onClearHistory: () => void;
}

export function MapDestinationSearch({
  data,
  favorites,
  history,
  t,
  onSelectStop,
  onSelectLine,
  onSelectPlaceForDirections,
  onToggleFavoriteStop,
  onToggleFavoriteLine,
  onClearHistory
}: MapDestinationSearchProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchSuggestionsResult>({
    stops: [],
    lines: [],
    places: []
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (!data || !query.trim()) {
      setResults({ stops: [], lines: [], places: [] });
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const res = await searchPlacesAndStops(query, data);
      if (!cancelled) {
        setResults(res);
        setLoading(false);
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, data]);

  const isStopFav = (code: string) => favorites.some(f => f.kind === 'stop' && f.stopCode === code);
  const isLineFav = (name: string) => favorites.some(f => f.kind === 'line' && f.lineName === name);

  const hasQuery = query.trim().length > 0;
  const hasAnyResult =
    results.lines.length > 0 || results.stops.length > 0 || results.places.length > 0;

  return (
    <div class="searchMapContainer" ref={rootRef}>
      <div class="destinationSearchBody">
        <div class="destinationSearchContainer">
          <div class="formConainer">
            <div class="inputContainer">
              <input
                type="text"
                value={query}
                placeholder={t.whereToGo}
                aria-label={t.whereToGo}
                onFocus={() => setFocused(true)}
                onInput={e => {
                  setQuery((e.target as HTMLInputElement).value);
                  setFocused(true);
                }}
              />
            </div>
            <button
              type="button"
              class="searchIcon"
              aria-label={hasQuery ? t.closeBtn : t.whereToGo}
              onClick={() => {
                if (hasQuery) {
                  setQuery('');
                } else {
                  setFocused(v => !v);
                }
              }}
            >
              {hasQuery ? <CloseXSvg size={20} /> : <SearchMagnifierSvg size={22} />}
            </button>
          </div>

          {focused && (
            <div class="selectorsContainer">
              {!hasQuery ? (
                history.length > 0 && (
                  <div class="searchSection">
                    <div class="searchSectionHeader">
                      <span>{t.recentSearches}</span>
                      <button type="button" class="textLinkBtn" onClick={onClearHistory}>
                        {t.clearHistory}
                      </button>
                    </div>
                    <div class="listContainer">
                      {history.map(item => (
                        <div
                          key={`${item.label}-${item.lat}-${item.lng}`}
                          class="placeContainer"
                          onClick={() => {
                            setFocused(false);
                            if (item.stopCode && data?.stopByCode.has(item.stopCode)) {
                              onSelectStop(data.stopByCode.get(item.stopCode)!);
                            } else if (item.lineName && data?.lineByName.has(item.lineName)) {
                              onSelectLine(data.lineByName.get(item.lineName)!);
                            } else {
                              onSelectPlaceForDirections(item);
                            }
                          }}
                        >
                          <div class="textCont">
                            <div class="name">{item.label}</div>
                            {item.sublabel && <div class="description">{item.sublabel}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              ) : (
                <div class="searchResultsBody">
                  {results.lines.length > 0 && (
                    <div class="searchSection">
                      <div class="searchSectionHeader">{t.linesGroup}</div>
                      <div class="listContainer">
                        {results.lines.map(line => (
                          <div key={line.name} class="placeContainer">
                            <span
                              class="linePillMini"
                              style={{ backgroundColor: line.color }}
                              onClick={() => {
                                setFocused(false);
                                setQuery('');
                                onSelectLine(line);
                              }}
                            >
                              {line.name}
                            </span>
                            <div
                              class="textCont"
                              onClick={() => {
                                setFocused(false);
                                setQuery('');
                                onSelectLine(line);
                              }}
                            >
                              <div class="name">
                                {line.d0.to} ↔ {line.d1.to}
                              </div>
                            </div>
                            <button
                              type="button"
                              class="favoriteCont"
                              aria-label={t.saveFavorite}
                              onClick={e => {
                                e.stopPropagation();
                                onToggleFavoriteLine(line);
                              }}
                            >
                              <StarSvg filled={isLineFav(line.name)} size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.stops.length > 0 && (
                    <div class="searchSection">
                      <div class="searchSectionHeader">{t.stopsGroup}</div>
                      <div class="listContainer">
                        {results.stops.map(stop => (
                          <div key={stop.c} class="placeContainer">
                            <span
                              class="stopSearchIcon"
                              onClick={() => {
                                setFocused(false);
                                setQuery('');
                                onSelectStop(stop);
                              }}
                            >
                              <ModeMiniSvg cat={stop.m} color="#58586b" size={18} />
                            </span>
                            <div
                              class="textCont"
                              onClick={() => {
                                setFocused(false);
                                setQuery('');
                                onSelectStop(stop);
                              }}
                            >
                              <div class="name">{stop.n}</div>
                              <div class="description">
                                {stop.s ? `${stop.s} · ` : ''}#{stop.c}
                              </div>
                            </div>
                            <button
                              type="button"
                              class="favoriteCont"
                              aria-label={t.saveFavorite}
                              onClick={e => {
                                e.stopPropagation();
                                onToggleFavoriteStop(stop);
                              }}
                            >
                              <StarSvg filled={isStopFav(stop.c)} size={18} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {results.places.length > 0 && (
                    <div class="searchSection">
                      <div class="searchSectionHeader">{t.placesGroup}</div>
                      <div class="listContainer">
                        {results.places.map(pl => (
                          <div
                            key={pl.id || `${pl.lat}-${pl.lng}`}
                            class="placeContainer"
                            onClick={() => {
                              setFocused(false);
                              setQuery('');
                              onSelectPlaceForDirections(pl);
                            }}
                          >
                            <div class="textCont">
                              <div class="name">{pl.label}</div>
                              {pl.sublabel && <div class="description">{pl.sublabel}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!loading && !hasAnyResult && <div class="noResults">{t.noSearchResults}</div>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
