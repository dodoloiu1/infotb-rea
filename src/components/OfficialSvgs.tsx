import type { LineCategory } from '../types';

export function RailMapSvg() {
  // FontAwesome fas fa-map tri-fold map icon used in stb-front-v2-fix-side-nav
  return (
    <svg width="22" height="22" viewBox="0 0 576 512" aria-hidden="true">
      <path
        class="svgFill"
        d="M0 117.66v346.32c0 11.32 11.43 19.06 21.94 14.86L160 416V32L20.12 87.95A32.006 32.006 0 0 0 0 117.66zM192 416l192 64V96L192 32v384zM554.06 33.16L416 96v384l139.88-55.95A31.996 31.996 0 0 0 576 394.34V48.02c0-11.32-11.43-19.06-21.94-14.86z"
      />
    </svg>
  );
}

export function RailPlannerSvg() {
  // Exact path from stb-front-v2-fix-side-nav
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" aria-hidden="true">
      <path
        class="svgFill"
        d="M15.672,6.44L0.757,0.044c-0.204-0.087-0.44-0.042-0.598,0.115c-0.156,0.156-0.201,0.39-0.115,0.593l6.394,14.92C6.524,15.871,6.72,16,6.937,16h0.005c0.219-0.002,0.416-0.135,0.498-0.338l2.375-5.85l5.848-2.375c0.132-0.053,0.238-0.157,0.294-0.288C16.073,6.875,15.946,6.558,15.672,6.44z"
      />
    </svg>
  );
}

export function RailLinesSvg() {
  // Exact path from stb-front-v2-fix-side-nav
  return (
    <svg width="24" height="24" viewBox="1.25 1.25 13.5 13.5" aria-hidden="true">
      <path
        class="svgFill"
        fill-rule="nonzero"
        d="M12 1.333a2.667 2.667 0 1 1-.69 5.243L6.575 11.31A2.67 2.67 0 0 1 4 14.667a2.667 2.667 0 1 1 .69-5.244L9.423 4.69A2.67 2.67 0 0 1 12 1.333zm-8 9.334a1.333 1.333 0 1 0 0 2.666 1.333 1.333 0 0 0 0-2.666zm8-8a1.333 1.333 0 1 0 0 2.666 1.333 1.333 0 0 0 0-2.666z"
      />
    </svg>
  );
}

export function RailFavoritesSvg() {
  // Exact path from stb-front-v2-fix-side-nav
  return (
    <svg width="24" height="24" viewBox="1.5 1.5 13 13" aria-hidden="true">
      <path
        class="svgFill"
        d="M8 11.513L12.12 14l-1.093-4.687 3.64-3.153-4.794-.407L8 1.333l-1.873 4.42-4.794.407 3.64 3.153L3.88 14z"
      />
    </svg>
  );
}

export function RailNotificationsSvg() {
  // Exact path from stb-front-v2-fix-side-nav
  return (
    <svg width="24" height="24" viewBox="3 3 26 26" aria-hidden="true">
      <path
        class="svgFill"
        d="M16 29.333c1.467 0 2.667-1.2 2.667-2.666h-5.334A2.666 2.666 0 0 0 16 29.333zm8-8v-6.666c0-4.094-2.187-7.52-6-8.427v-.907c0-1.106-.893-2-2-2s-2 .894-2 2v.907c-3.827.907-6 4.32-6 8.427v6.666L5.333 24v1.333h21.334V24L24 21.333z"
      />
    </svg>
  );
}

export function RoFlagSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <clipPath id="roClip">
        <circle cx="16" cy="16" r="16" />
      </clipPath>
      <g clip-path="url(#roClip)">
        <rect x="0" y="0" width="10.7" height="32" fill="#002B7F" />
        <rect x="10.7" y="0" width="10.6" height="32" fill="#FCD116" />
        <rect x="21.3" y="0" width="10.7" height="32" fill="#CE1126" />
      </g>
    </svg>
  );
}

export function EnFlagSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
      <clipPath id="ukClip">
        <circle cx="16" cy="16" r="16" />
      </clipPath>
      <g clip-path="url(#ukClip)">
        <rect width="32" height="32" fill="#012169" />
        <path d="M0,0 L32,32 M32,0 L0,32" stroke="#FFFFFF" stroke-width="5.5" />
        <path d="M0,0 L32,32 M32,0 L0,32" stroke="#C8102E" stroke-width="2.6" />
        <path d="M16,0 V32 M0,16 H32" stroke="#FFFFFF" stroke-width="8.5" />
        <path d="M16,0 V32 M0,16 H32" stroke="#C8102E" stroke-width="5" />
      </g>
    </svg>
  );
}

export function CrosshairSvg() {
  // Exact path from stb-front-v2-main-page
  return (
    <svg width="100%" height="100%" viewBox="9 9 46 46" aria-hidden="true">
      <path
        class="iconFill"
        d="M33.818 12v3.745c7.465.824 13.415 6.671 14.394 14.088l.043.349H52v3.636h-3.745c-.824 7.465-6.671 13.415-14.088 14.394l-.349.043V52h-3.636v-3.745c-7.465-.824-13.415-6.671-14.394-14.088l-.043-.349H12v-3.636h3.745c.824-7.465 6.671-13.415 14.088-14.394l.349-.043V12h3.636zM32 19.273c-7.036 0-12.727 5.69-12.727 12.727 0 7.036 5.69 12.727 12.727 12.727 7.036 0 12.727-5.69 12.727-12.727 0-7.036-5.69-12.727-12.727-12.727zm0 5.454A7.27 7.27 0 0 1 39.273 32 7.27 7.27 0 0 1 32 39.273 7.27 7.27 0 0 1 24.727 32 7.27 7.27 0 0 1 32 24.727z"
      />
    </svg>
  );
}

export function ZoomPlusSvg() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 64 64" aria-hidden="true">
      <polygon
        class="iconFill"
        points="57.438,26.438 37.563,26.438 37.563,6.563 26.438,6.563 26.438,26.438 6.563,26.438 6.563,37.563 26.438,37.563 26.438,57.438 37.563,57.438 37.563,37.563 57.438,37.563"
      />
    </svg>
  );
}

export function ZoomMinusSvg() {
  return (
    <svg width="100%" height="100%" viewBox="0 0 64 64" aria-hidden="true">
      <rect class="iconFill" x="6.563" y="26.438" width="50.875" height="11.125" />
    </svg>
  );
}

export function ConnectionWaveSvg({ color = '#33AA44' }: { color?: string }) {
  // 3-wave live GPS indicator icon shown in .time-container on info.stb.ro
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="5" cy="19" r="2.4" fill={color} />
      <path
        d="M5 12.5a6.5 6.5 0 0 1 6.5 6.5"
        stroke={color}
        stroke-width="2.4"
        stroke-linecap="round"
      />
      <path
        d="M5 6.5a12.5 12.5 0 0 1 12.5 12.5"
        stroke={color}
        stroke-width="2.4"
        stroke-linecap="round"
      />
    </svg>
  );
}

export function WheelchairSvg({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#3559d9" aria-hidden="true">
      <circle cx="12" cy="4" r="2" />
      <path d="M19 13v-2c-1.54.02-3.09-.75-4.07-1.83l-1.29-1.43c-.17-.19-.38-.34-.61-.45-.01 0-.01-.01-.02-.01H13c-.35-.2-.75-.3-1.19-.26C10.76 7.11 10 8.04 10 9.09V15c0 1.1.9 2 2 2h5v5h2v-5.5c0-1.1-.9-2-2-2h-3v-3.45c1.29 1.07 3.25 1.94 5 1.95zm-6.17 5c-.41 1.16-1.52 2-2.83 2-1.66 0-3-1.34-3-3 0-1.31.84-2.41 2-2.83V12.1a5 5 0 1 0 5.9 5.9h-2.07z" />
    </svg>
  );
}

export function StationHeaderIllustration({ isMetro = false }: { isMetro?: boolean }) {
  const accent = isMetro ? '#1b6e2b' : '#33AA44';
  return (
    <svg width="76" height="58" viewBox="0 0 88 66" fill="none" aria-hidden="true">
      <ellipse cx="44" cy="58" rx="34" ry="5" fill="#f0f2f5" />
      <rect x="16" y="16" width="42" height="6" rx="3" fill={accent} />
      <rect x="20" y="22" width="4" height="34" fill="#6b7280" />
      <rect x="50" y="22" width="4" height="34" fill="#6b7280" />
      <rect x="26" y="39" width="22" height="5" rx="2" fill="#9ca3af" />
      <rect x="29" y="44" width="3" height="12" fill="#6b7280" />
      <rect x="42" y="44" width="3" height="12" fill="#6b7280" />
      <circle cx="67" cy="24" r="9" fill={accent} />
      <text
        x="67"
        y="27.5"
        text-anchor="middle"
        fill="#fff"
        font-size="10"
        font-weight="700"
        font-family="Roboto, sans-serif"
      >
        {isMetro ? 'M' : 'H'}
      </text>
      <rect x="65.8" y="33" width="2.4" height="23" fill="#4b5563" />
    </svg>
  );
}

export function StarSvg({ filled, size = 18 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={filled ? '#fe9306' : 'none'}
        stroke={filled ? '#fe9306' : '#58586b'}
        stroke-width="2"
        stroke-linejoin="round"
        d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
      />
    </svg>
  );
}

export function DirectionsTurnSvg({ size = 17, color = '#3559d9' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M21.71 11.29l-9-9a.996.996 0 0 0-1.41 0l-9 9a.996.996 0 0 0 0 1.41l9 9c.39.39 1.02.39 1.41 0l9-9a.996.996 0 0 0 0-1.41zM14 14.5V12h-4v3H8v-4c0-.55.45-1 1-1h5V7.5l3.5 3.5-3.5 3.5z" />
    </svg>
  );
}

export function SearchMagnifierSvg({ size = 20, color = '#58586b' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
    </svg>
  );
}

export function CloseXSvg({ size = 20, color = '#58586b' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
    </svg>
  );
}

export function SwapVerticalSvg({ size = 20, color = '#58586b' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M16 17.01V10h-2v7.01h-3L15 21l4-3.99h-3zM9 3L5 6.99h3V14h2V6.99h3L9 3z" />
    </svg>
  );
}

export function WalkPersonSvg({ size = 18, color = '#58586b' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7" />
    </svg>
  );
}

export function ModeMiniSvg({ cat, color = 'currentColor', size = 18 }: { cat: LineCategory; color?: string; size?: number }) {
  if (cat === 'TRAM') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
        <path d="M19 16.94V8.5c0-2.79-2.61-3.4-6.01-3.49l.76-1.51H17V2H7v1.5h4.75l-.76 1.52C7.86 5.11 5 5.73 5 8.5v8.44c0 1.45 1.19 2.66 2.59 2.97L6 21.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19.9c1.4-.31 2.5-1.52 2.5-2.96zM12 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm5-4.5H7V9h10v5z" />
      </svg>
    );
  }
  if (cat === 'METRO') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
        <path d="M12 2c-4.42 0-8 .5-8 4v9.5C4 17.43 5.57 19 7.5 19L6 20.5v.5h12v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-6H6V6h5v5zm5.5 6c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6h-5V6h5v5z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" />
    </svg>
  );
}

/**
 * Generates the official info.stb.ro rounded vehicle marker HTML (`round_bus`, `round_tram`, `round_trolley`)
 * for Leaflet `L.divIcon`.
 */
export function buildVehicleMarkerHtml(
  cat: LineCategory,
  color: string,
  lineName: string,
  bearing: number | null
): string {
  const arrowHtml =
    bearing !== null
      ? `<div class="veh-bearing-ring" style="transform:rotate(${Math.round(bearing)}deg)"><span class="veh-bearing-tip" style="border-bottom-color:${color}"></span></div>`
      : '';

  let glyphPath =
    'M7 15.5c0 .6.3 1.1.7 1.5v1.2c0 .4.3.8.8.8h.7c.4 0 .8-.4.8-.8V17h4v1.2c0 .4.3.8.8.8h.7c.4 0 .8-.4.8-.8V17c.4-.4.7-.9.7-1.5V8.5C17 6.2 14.6 5.8 12 5.8S7 6.2 7 8.5v7zm2.3.7a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm5.4 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2zm1-3.7H8.3V8.7h7.4v3.8z';
  let poles = '';

  if (cat === 'TRAM') {
    poles = `<path d="M9.5 3.6h5l-1.2 2h-2.6z" fill="none" stroke="${color}" stroke-width="1.3"/>`;
  } else if (cat === 'TROLLEY') {
    poles = `<path d="M9.6 5.8L8.2 3.3M14.4 5.8L15.8 3.3" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`;
  }

  return `<div class="stb-veh-marker" title="Linia ${lineName}">
    ${arrowHtml}
    <div class="stb-veh-circle" style="border-color:${color}">
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        ${poles}
        <path fill="${color}" d="${glyphPath}" />
      </svg>
    </div>
    <span class="stb-veh-badge" style="background:${color}">${lineName}</span>
  </div>`;
}

export function buildFlagPinHtml(kind: 'start' | 'end'): string {
  const bg = kind === 'start' ? '#0ea5a4' : '#e02424';
  const label = kind === 'start' ? 'A' : 'B';
  return `<div class="stb-flag-pin">
    <svg width="34" height="42" viewBox="0 0 34 42">
      <path d="M17 40C17 40 30 26.5 30 15.5C30 8.04 24.18 2 17 2C9.82 2 4 8.04 4 15.5C4 26.5 17 40 17 40Z" fill="${bg}" stroke="#ffffff" stroke-width="2.5"/>
      <circle cx="17" cy="15.5" r="7.5" fill="#ffffff"/>
      <text x="17" y="19.3" text-anchor="middle" font-size="11" font-weight="700" fill="${bg}" font-family="Roboto, sans-serif">${label}</text>
    </svg>
  </div>`;
}
