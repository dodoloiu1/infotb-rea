import { useState } from 'preact/hooks';
import type { FavoriteItem, StaticTransitData, StopItem, TransitLine } from '../types';
import type { Translations } from '../i18n/translations';
import { normalizeRo } from '../utils/geo';
import { CloseXSvg, DirectionsTurnSvg, ModeMiniSvg, SearchMagnifierSvg, StarSvg } from './OfficialSvgs';

interface FavoritesDrawerProps {
  favorites: FavoriteItem[];
  data: StaticTransitData | null;
  pickingFavPointOnMap: boolean;
  pendingFavCoords: { lat: number; lng: number } | null;
  t: Translations;
  onSelectStop: (stop: StopItem) => void;
  onSelectLine: (line: TransitLine) => void;
  onDirectionsToPlace: (item: FavoriteItem) => void;
  onStartPickMapFavorite: () => void;
  onCancelPickMapFavorite: () => void;
  onSavePickedMapFavorite: (name: string) => void;
  onRemoveFavorite: (id: string) => void;
}

export function FavoritesDrawer({
  favorites,
  data,
  pickingFavPointOnMap,
  pendingFavCoords,
  t,
  onSelectStop,
  onSelectLine,
  onDirectionsToPlace,
  onStartPickMapFavorite,
  onCancelPickMapFavorite,
  onSavePickedMapFavorite,
  onRemoveFavorite
}: FavoritesDrawerProps) {
  const [filterKind, setFilterKind] = useState<'all' | 'stop' | 'line' | 'place'>('all');
  const [search, setSearch] = useState('');
  const [customName, setCustomName] = useState('');

  const q = normalizeRo(search);
  const filtered = favorites.filter(item => {
    if (filterKind !== 'all' && item.kind !== filterKind) return false;
    if (!q) return true;
    return normalizeRo(item.name).includes(q) || normalizeRo(item.description).includes(q);
  });

  return (
    <div class="drawerPanelBody">
      <div class="drawerSearchInputBox">
        <input
          type="text"
          value={search}
          placeholder={t.searchFavoritesPlaceholder}
          onInput={e => setSearch((e.target as HTMLInputElement).value)}
        />
        <span class="drawerInputIcon" onClick={() => search && setSearch('')}>
          {search ? <CloseXSvg size={18} /> : <SearchMagnifierSvg size={20} />}
        </span>
      </div>

      <div class="favFilterTabs">
        {(['all', 'stop', 'line', 'place'] as const).map(k => (
          <button
            key={k}
            type="button"
            class={`favTabBtn ${filterKind === k ? 'active' : ''}`}
            onClick={() => setFilterKind(k)}
          >
            {k === 'all'
              ? t.favTabAll
              : k === 'stop'
                ? t.favTabStops
                : k === 'line'
                  ? t.favTabLines
                  : t.favTabPlaces}
          </button>
        ))}
      </div>

      {!pickingFavPointOnMap && !pendingFavCoords && (
        <button type="button" class="outlineAccentBtn fullWidthBtn" onClick={onStartPickMapFavorite}>
          {t.addFavoriteMapPlaceBtn}
        </button>
      )}

      {pickingFavPointOnMap && !pendingFavCoords && (
        <div class="mapPickBanner">
          <span>{t.pickEndOnMapHint}</span>
          <button type="button" class="textLinkBtn" onClick={onCancelPickMapFavorite}>
            {t.cancelBtn}
          </button>
        </div>
      )}

      {pendingFavCoords && (
        <div class="savePlaceCard">
          <div class="savePlaceTitle">{t.saveMapPointTitle}</div>
          <div class="savePlaceCoords">
            {pendingFavCoords.lat.toFixed(5)}, {pendingFavCoords.lng.toFixed(5)}
          </div>
          <input
            type="text"
            class="savePlaceInput"
            value={customName}
            placeholder={t.placeNamePlaceholder}
            onInput={e => setCustomName((e.target as HTMLInputElement).value)}
          />
          <div class="savePlaceActions">
            <button
              type="button"
              class="primaryGreenBtn"
              onClick={() => {
                if (!customName.trim()) return;
                onSavePickedMapFavorite(customName.trim());
                setCustomName('');
              }}
            >
              {t.saveBtn}
            </button>
            <button
              type="button"
              class="secondaryGrayBtn"
              onClick={() => {
                setCustomName('');
                onCancelPickMapFavorite();
              }}
            >
              {t.cancelBtn}
            </button>
          </div>
        </div>
      )}

      <div class="favListScroll">
        {filtered.length === 0 ? (
          <div class="emptyStateBox">
            <StarSvg filled={false} size={36} />
            <div class="emptyStateTitle">{t.emptyFavoritesTitle}</div>
            <p class="emptyStateHint">{t.emptyFavoritesHint}</p>
          </div>
        ) : (
          filtered.map(item => (
            <div key={item.id} class="favRowCard">
              <div
                class="favRowMain"
                onClick={() => {
                  if (item.kind === 'stop' && item.stopCode && data?.stopByCode.has(item.stopCode)) {
                    onSelectStop(data.stopByCode.get(item.stopCode)!);
                  } else if (item.kind === 'line' && item.lineName && data?.lineByName.has(item.lineName)) {
                    onSelectLine(data.lineByName.get(item.lineName)!);
                  } else {
                    onDirectionsToPlace(item);
                  }
                }}
              >
                {item.kind === 'line' ? (
                  <span
                    class="linePillMini"
                    style={{ backgroundColor: item.color || '#33AA44' }}
                  >
                    {item.lineName || item.name}
                  </span>
                ) : item.kind === 'stop' ? (
                  <span class="favIconCircle">
                    <ModeMiniSvg cat="BUS" color="#33AA44" size={18} />
                  </span>
                ) : (
                  <span class="favIconCircle">
                    <StarSvg filled={true} size={18} />
                  </span>
                )}

                <div class="favRowText">
                  <div class="favRowTitle">{item.name}</div>
                  {item.description && <div class="favRowSub">{item.description}</div>}
                </div>
              </div>

              <div class="favRowActions">
                {item.lat !== undefined && item.lng !== undefined && (
                  <button
                    type="button"
                    class="iconCircleBtn"
                    title={t.directionsToHere}
                    onClick={() => onDirectionsToPlace(item)}
                  >
                    <DirectionsTurnSvg size={17} />
                  </button>
                )}
                <button
                  type="button"
                  class="iconCircleBtn"
                  title={t.deleteFavorite}
                  onClick={() => onRemoveFavorite(item.id)}
                >
                  <CloseXSvg size={17} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
