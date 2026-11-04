import { useState } from 'preact/hooks';
import type {
  FavoriteItem,
  LiveVehicle,
  StaticTransitData,
  StationArrivalsResult,
  StopItem,
  TransitLine
} from '../types';
import type { Translations } from '../i18n/translations';
import { buildWeeklySchedule, formatArrivalMinutes } from '../utils/geo';
import {
  CloseXSvg,
  ConnectionWaveSvg,
  DirectionsTurnSvg,
  ModeMiniSvg,
  StarSvg,
  StationHeaderIllustration,
  WheelchairSvg
} from './OfficialSvgs';

interface ViewLineContentProps {
  selectedStop: StopItem | null;
  arrivalsResult: StationArrivalsResult | null;
  loadingArrivals: boolean;
  inspectedLine: TransitLine | null;
  liveVehicles: LiveVehicle[];
  data: StaticTransitData | null;
  favorites: FavoriteItem[];
  refreshSecondsLeft: number;
  refreshCycleTotal: number;
  t: Translations;
  onClose: () => void;
  onToggleFavoriteStop: (stop: StopItem) => void;
  onToggleFavoriteLine: (line: TransitLine) => void;
  onDirectionsToStop: (stop: StopItem) => void;
  onFocusLineFromStop: (lineName: string, dir: 0 | 1) => void;
  onSelectStopFromLine: (stop: StopItem) => void;
}

export function ViewLineContent({
  selectedStop,
  arrivalsResult,
  loadingArrivals,
  inspectedLine,
  liveVehicles,
  data,
  favorites,
  refreshSecondsLeft,
  refreshCycleTotal,
  t,
  onClose,
  onToggleFavoriteStop,
  onToggleFavoriteLine,
  onDirectionsToStop,
  onFocusLineFromStop,
  onSelectStopFromLine
}: ViewLineContentProps) {
  const [openScheduleKey, setOpenScheduleKey] = useState<string | null>(null);
  const [scheduleDayTab, setScheduleDayTab] = useState<'weekday' | 'saturday' | 'sunday'>('weekday');
  const [lineDirTab, setLineDirTab] = useState<0 | 1>(0);

  if (!selectedStop && !inspectedLine) return null;

  // 1. Station Inspector Card (.view-line-content)
  if (selectedStop) {
    const isFav = favorites.some(f => f.kind === 'stop' && f.stopCode === selectedStop.c);
    const isMetro = selectedStop.m === 'METRO';
    const pct = Math.max(
      0,
      Math.min(100, ((refreshCycleTotal - refreshSecondsLeft) / refreshCycleTotal) * 100)
    );
    const nowHour = String(new Date().getHours()).padStart(2, '0');

    return (
      <aside class="view-line-content" aria-label={selectedStop.n}>
        <div class="close-view-line-content-container">
          <button
            type="button"
            class="close-view-line-content-icon"
            aria-label={t.closeBtn}
            onClick={onClose}
          >
            <CloseXSvg size={22} />
          </button>
        </div>

        <div class="info-content-container">
          <div class="line-photo">
            <StationHeaderIllustration isMetro={isMetro} />
          </div>

          <h2 class="WIInfoTitle">
            <span>{selectedStop.n}</span>
            <span class="titleWheelchair" title={t.disabilityAccessible}>
              <WheelchairSvg size={18} />
            </span>
          </h2>

          <div class="WIInfoDescription">
            {selectedStop.s ? `${selectedStop.s} · ` : ''}
            {isMetro ? t.metroStationLabel : `${t.stationCodeLabel}: #${selectedStop.c}`}
          </div>

          <div class="line-buttons">
            <button
              type="button"
              class={`save-button ${isFav ? 'active' : ''}`}
              onClick={() => onToggleFavoriteStop(selectedStop)}
            >
              <StarSvg filled={isFav} size={17} />
              <span>{isFav ? t.savedFavorite : t.saveFavorite}</span>
            </button>

            <button
              type="button"
              class="directions-button"
              onClick={() => onDirectionsToStop(selectedStop)}
            >
              <DirectionsTurnSvg size={17} />
              <span>{t.directionsToHere}</span>
            </button>
          </div>

          <div class="WIHorisontalLine" />

          <div class="vehicles-text-container">
            <span class="vehicles-text">{t.arrivingLinesHeader}</span>
          </div>

          {loadingArrivals && !arrivalsResult ? (
            <div class="loadingTextSmall">{t.loadingArrivals}</div>
          ) : !arrivalsResult || arrivalsResult.arrivals.length === 0 ? (
            <div class="loadingTextSmall">{t.noIncomingLines}</div>
          ) : (
            <div class="arrivalsListWrap">
              {arrivalsResult.arrivals.map(arr => {
                const rowKey = `${selectedStop.c}:${arr.lineName}:${arr.direction}`;
                const scheduleExpanded = openScheduleKey === rowKey;
                const schedule = scheduleExpanded
                  ? buildWeeklySchedule(selectedStop.c, arr.lineName, arr.category)
                  : null;
                const activeRows = schedule
                  ? scheduleDayTab === 'saturday'
                    ? schedule.saturday
                    : scheduleDayTab === 'sunday'
                      ? schedule.sunday
                      : schedule.weekday
                  : [];

                return (
                  <div key={rowKey} class="arrivalBlock">
                    <div
                      class="WILineContainer line-container"
                      onClick={() => onFocusLineFromStop(arr.lineName, arr.direction)}
                    >
                      <span class="iconConatiner">
                        <ModeMiniSvg cat={arr.category} color={arr.color} size={18} />
                      </span>
                      <span
                        class="nameContainer"
                        style={{ backgroundColor: arr.color }}
                      >
                        {arr.lineName}
                      </span>
                      <span class="directionContainer">
                        → {arr.directionName}
                      </span>
                    </div>

                    <div class="arriving-time-container">
                      <div class="time-container">
                        {!arr.isTimetable && (
                          <span class="noTimetableIcon" title={t.liveGpsLegend}>
                            <ConnectionWaveSvg color="#33AA44" />
                          </span>
                        )}
                        <span class="time-container-text">
                          {formatArrivalMinutes(arr.arrivingSeconds, t.minShort, t.secShort)}
                        </span>
                        {arr.isTimetable && (
                          <sup class="fromTimetableIcon" title={t.timetableLegend}>
                            *
                          </sup>
                        )}
                      </div>

                      {arr.secondarySeconds !== undefined && (
                        <div class="time-container noRightMargin">
                          {!arr.isTimetable && (
                            <span class="noTimetableIcon" title={t.liveGpsLegend}>
                              <ConnectionWaveSvg color="#33AA44" />
                            </span>
                          )}
                          <span class="time-container-text">
                            {formatArrivalMinutes(arr.secondarySeconds, t.minShort, t.secShort)}
                          </span>
                          {arr.isTimetable && (
                            <sup class="fromTimetableIcon" title={t.timetableLegend}>
                              *
                            </sup>
                          )}
                        </div>
                      )}

                      <button
                        type="button"
                        class="show-and-expand-timetable-btn"
                        onClick={() =>
                          setOpenScheduleKey(scheduleExpanded ? null : rowKey)
                        }
                      >
                        {scheduleExpanded ? t.hideWeeklyScheduleBtn : t.weeklyScheduleBtn}
                      </button>
                    </div>

                    {scheduleExpanded && schedule && (
                      <div class="WITimeTabelContainer">
                        <div class="scheduleTabsHeader">
                          {(['weekday', 'saturday', 'sunday'] as const).map(tab => (
                            <button
                              key={tab}
                              type="button"
                              class={`scheduleDayTab ${scheduleDayTab === tab ? 'active' : ''}`}
                              onClick={() => setScheduleDayTab(tab)}
                            >
                              {tab === 'weekday'
                                ? t.scheduleMonFri
                                : tab === 'saturday'
                                  ? t.scheduleSat
                                  : t.scheduleSun}
                            </button>
                          ))}
                        </div>
                        <div class="tabelContainer">
                          <table class="timetable">
                            <thead>
                              <tr>
                                <th class="tableHeader firstHeader" style={{ width: '48px' }}>
                                  {t.scheduleHourCol}
                                </th>
                                <th class="tableHeader">{t.scheduleMinCol}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {activeRows.map(r => (
                                <tr
                                  key={r.hour}
                                  class={r.hour === nowHour ? 'currentHourRow' : ''}
                                >
                                  <td class="hourTd">{r.hour}</td>
                                  <td>
                                    <span class="minute-row">{r.minutes.join('  ')}</span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              <div class="WIHorisontalLine" />
              <div class="WIInfoLegend">
                <span class="legendRow">
                  <ConnectionWaveSvg color="#33AA44" />
                  <span>{t.liveGpsLegend}</span>
                </span>
                <span class="legendRow">
                  <strong>*</strong>
                  <span>{t.timetableLegend.replace(/^\*\s*/, '')}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        <div class="remaining-time-container">
          <div class="remaining-time-text">
            {refreshSecondsLeft <= 1
              ? t.refreshingNow
              : t.refreshCountdown(refreshSecondsLeft)}
          </div>
          <div class="stbProgressBarTrack">
            <div class="stbProgressBarFill" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </aside>
    );
  }

  // 2. Line Inspector Card (.view-line-content) when a line is selected and no station is open
  if (inspectedLine) {
    const isLineFav = favorites.some(
      f => f.kind === 'line' && f.lineName === inspectedLine.name
    );
    const activeVehs = liveVehicles.filter(v => v.lineName === inspectedLine.name);
    const dirObj = lineDirTab === 0 ? inspectedLine.d0 : inspectedLine.d1;
    const stopItems: StopItem[] = [];
    if (data) {
      for (const code of dirObj.stops) {
        const st = data.stopByCode.get(code);
        if (st) stopItems.push(st);
      }
    }

    return (
      <aside class="view-line-content" aria-label={`Linia ${inspectedLine.name}`}>
        <div class="close-view-line-content-container">
          <button
            type="button"
            class="close-view-line-content-icon"
            aria-label={t.closeBtn}
            onClick={onClose}
          >
            <CloseXSvg size={22} />
          </button>
        </div>

        <div class="info-content-container">
          <div class="lineHeaderBadgeWrap">
            <span
              class="lineHeroPill"
              style={{ backgroundColor: inspectedLine.color }}
            >
              <ModeMiniSvg cat={inspectedLine.cat} color="#ffffff" size={20} />
              <span>{inspectedLine.name}</span>
            </span>
          </div>

          <h2 class="WIInfoTitle lineTitleCompact">
            {inspectedLine.d0.to} ↔ {inspectedLine.d1.to}
          </h2>

          <div class="WIInfoDescription">
            <span class="liveVehiclesTag">
              <ConnectionWaveSvg color="#33AA44" />
              <span>{t.activeVehiclesOnLine(activeVehs.length)}</span>
            </span>
          </div>

          <div class="line-buttons">
            <button
              type="button"
              class={`save-button ${isLineFav ? 'active' : ''}`}
              onClick={() => onToggleFavoriteLine(inspectedLine)}
            >
              <StarSvg filled={isLineFav} size={17} />
              <span>{isLineFav ? t.savedFavorite : t.saveFavorite}</span>
            </button>
          </div>

          <div class="lineDirSwitchInline">
            <button
              type="button"
              class={`dirTabSmall ${lineDirTab === 0 ? 'active' : ''}`}
              onClick={() => setLineDirTab(0)}
            >
              <strong>{t.turDirection}</strong>
              <span>→ {inspectedLine.d0.to}</span>
            </button>
            <button
              type="button"
              class={`dirTabSmall ${lineDirTab === 1 ? 'active' : ''}`}
              onClick={() => setLineDirTab(1)}
            >
              <strong>{t.returDirection}</strong>
              <span>→ {inspectedLine.d1.to}</span>
            </button>
          </div>

          <div class="vehicles-text-container">
            <span class="vehicles-text">
              {t.stopsListTitle} ({t.stopsCount(stopItems.length)})
            </span>
          </div>

          <div class="lineStopsTimeline">
            {stopItems.map((st, idx) => (
              <div
                key={`${st.c}-${idx}`}
                class="timelineStopRow"
                onClick={() => onSelectStopFromLine(st)}
              >
                <span
                  class="timelineDot"
                  style={{ borderColor: inspectedLine.color }}
                />
                <div class="timelineStopInfo">
                  <div class="timelineStopName">{st.n}</div>
                  {st.s && <div class="timelineStopStreet">{st.s}</div>}
                </div>
                <span class="timelineStopCode">#{st.c}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  return null;
}
