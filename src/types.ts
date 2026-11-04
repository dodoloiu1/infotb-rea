export type LineCategory = 'TRAM' | 'TROLLEY' | 'BUS' | 'REGIONAL' | 'NIGHT' | 'METRO';
export type LangCode = 'ro' | 'en';
export type ActivePanel = 'map' | 'planner' | 'lines' | 'favorites';
export type LineDirectionFilter = 'both' | 'tur' | 'retur';

export interface LineDirection {
  to: string;
  stops: string[];
}

export interface TransitLine {
  id: string;
  ids: string[];
  name: string;
  cat: LineCategory;
  color: string;
  org: string;
  hasNotifications?: boolean;
  d0: LineDirection;
  d1: LineDirection;
}

export type StopLineTuple = [lineName: string, direction: 0 | 1, headsign: string];

export interface StopItem {
  c: string; // station code
  n: string; // station name
  s: string; // street
  lat: number;
  lng: number;
  m: LineCategory;
  l: StopLineTuple[];
}

export type LatLngTuple = [lat: number, lng: number];

export type RouteShapesMap = Record<string, { '0'?: LatLngTuple[]; '1'?: LatLngTuple[] }>;

export interface StaticTransitData {
  routeIdToName: Record<string, string>;
  lines: TransitLine[];
  lineByName: Map<string, TransitLine>;
  stops: StopItem[];
  stopByCode: Map<string, StopItem>;
}

export interface LiveVehicle {
  id: string;
  label: string; // fleet number
  licensePlate: string;
  routeId: string;
  lineName: string;
  category: LineCategory;
  color: string;
  direction: 0 | 1;
  destination: string;
  lat: number;
  lng: number;
  bearing: number | null;
  timestamp: number;
  startTime?: string;
}

export interface ArrivalItem {
  lineName: string;
  lineId: string;
  category: LineCategory;
  color: string;
  directionName: string;
  direction: 0 | 1;
  arrivingSeconds: number;
  secondarySeconds?: number;
  isTimetable: boolean; // false = live GPS (connectionIcon), true = timetable ('*')
  vehicleLabel?: string;
}

export interface StationArrivalsResult {
  stationCode: string;
  name: string;
  address: string;
  hasDisability: boolean;
  source: 'tpbi-live' | 'gps-computed';
  fetchedAt: number;
  arrivals: ArrivalItem[];
}

export interface WeeklyTimetableRow {
  hour: string;
  minutes: string[];
}

export interface WeeklySchedule {
  weekday: WeeklyTimetableRow[];
  saturday: WeeklyTimetableRow[];
  sunday: WeeklyTimetableRow[];
}

export interface RouteStopStep {
  code?: string;
  name: string;
  lat: number;
  lng: number;
  time?: string;
}

export interface RouteLeg {
  type: 'walk' | 'pt';
  lineName?: string;
  category?: LineCategory;
  color?: string;
  headsign?: string;
  fromName: string;
  toName: string;
  distanceMeters: number;
  durationSeconds: number;
  departureTime?: string;
  arrivalTime?: string;
  isLiveGps?: boolean;
  hasDisability?: boolean;
  stops: RouteStopStep[];
  geometry: LatLngTuple[];
}

export interface PlannedItinerary {
  id: string;
  durationSeconds: number;
  walkMeters: number;
  transfers: number;
  leavesInSeconds: number;
  departureTime: string;
  arrivalTime: string;
  legs: RouteLeg[];
  source: 'tpbi-router' | 'local-router';
}

export interface PlannerOptions {
  useCurrentTime: boolean;
  startDateIso: string; // YYYY-MM-DD
  startHour: number;
  startMinute: number;
  maxWalkMeters: number;
  allowedModes: Record<'TRAM' | 'TROLLEY' | 'BUS' | 'METRO', boolean>;
  disabilityFriendly: boolean;
}

export interface PlacePoint {
  id?: string;
  label: string;
  sublabel?: string;
  lat: number;
  lng: number;
  stopCode?: string;
  lineName?: string;
  isPointOnMap?: boolean;
  isCurrentLocation?: boolean;
}

export interface FavoriteItem {
  id: string;
  kind: 'stop' | 'line' | 'place';
  name: string;
  description: string;
  lat?: number;
  lng?: number;
  stopCode?: string;
  lineName?: string;
  color?: string;
}

export interface TransitNotification {
  id: string;
  lineName: string;
  lineColor: string;
  category?: LineCategory;
  createdAt: string;
  titleRo: string;
  titleEn: string;
  messageRo: string;
  messageEn: string;
  lat?: number;
  lng?: number;
}
