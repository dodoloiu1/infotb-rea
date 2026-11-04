import type { LangCode, LineCategory } from '../types';

export interface Translations {
  // Navigation rail
  navMap: string;
  navPlanner: string;
  navLines: string;
  navFavorites: string;
  navNotifications: string;
  langRo: string;
  langEn: string;

  // Map & search
  whereToGo: string;
  searchPlaceholder: string;
  myLocation: string;
  zoomIn: string;
  zoomOut: string;
  bothDirections: string;
  turDirection: string;
  returDirection: string;
  toward: string;
  liveVehiclesCount: string;
  noSearchResults: string;
  recentSearches: string;
  clearHistory: string;

  // Lines drawer
  searchLinePlaceholder: string;
  linesSelectedCount: (count: number) => string;
  deselectLines: (count: number) => string;
  resetSelectedLines: string;
  linesLimitWarning: (limit: number) => string;
  catTram: string;
  catTrolley: string;
  catBus: string;
  catRegional: string;
  catNight: string;
  catMetro: string;
  noLinesFound: string;

  // Station / Line right floating card (.view-line-content)
  stationCodeLabel: string;
  metroStationLabel: string;
  publicStationLabel: string;
  saveFavorite: string;
  savedFavorite: string;
  directionsToHere: string;
  directionsFromHere: string;
  arrivingLinesHeader: string;
  loadingArrivals: string;
  noIncomingLines: string;
  timetableLegend: string;
  liveGpsLegend: string;
  weeklyScheduleBtn: string;
  hideWeeklyScheduleBtn: string;
  scheduleMonFri: string;
  scheduleSat: string;
  scheduleSun: string;
  scheduleHourCol: string;
  scheduleMinCol: string;
  refreshCountdown: (sec: number) => string;
  refreshingNow: string;
  minShort: string;
  secShort: string;
  hrShort: string;
  metersLabel: string;
  stopsListTitle: string;
  stopsCount: (count: number) => string;
  activeVehiclesOnLine: (count: number) => string;
  disabilityAccessible: string;
  vehiclePopupFleet: string;
  vehiclePopupPlate: string;
  vehiclePopupHeadsign: string;
  vehiclePopupLive: string;

  // Route planner drawer
  plannerTitle: string;
  fromLabel: string;
  toLabel: string;
  chooseStartPlaceholder: string;
  chooseEndPlaceholder: string;
  swapPoints: string;
  useCurrentLocation: string;
  pickPointOnMap: string;
  pickStartOnMapHint: string;
  pickEndOnMapHint: string;
  favoritesGroup: string;
  historyGroup: string;
  stopsGroup: string;
  linesGroup: string;
  placesGroup: string;
  startTimeLabel: string;
  startDateLabel: string;
  leaveNow: string;
  showAdvancedOptions: string;
  hideAdvancedOptions: string;
  maxWalkLabel: string;
  transportModesLabel: string;
  modeTram: string;
  modeTrolley: string;
  modeBus: string;
  modeMetro: string;
  disabilityFriendlyLabel: string;
  findBestRoutesBtn: string;
  searchingRoutes: string;
  noRoutesFound: string;
  leavesIn: string;
  transfersCount: (n: number) => string;
  directRoute: string;
  seeDetails: string;
  backToResults: string;
  walkLegLabel: string;
  rideLegLabel: string;
  boardAt: string;
  alightAt: string;
  intermediateStops: (n: number) => string;

  // Favorites drawer (100% local, zero login)
  favoritesTitle: string;
  searchFavoritesPlaceholder: string;
  favTabAll: string;
  favTabStops: string;
  favTabLines: string;
  favTabPlaces: string;
  addFavoriteMapPlaceBtn: string;
  saveMapPointTitle: string;
  placeNamePlaceholder: string;
  saveBtn: string;
  cancelBtn: string;
  deleteFavorite: string;
  emptyFavoritesTitle: string;
  emptyFavoritesHint: string;

  // Notifications modal
  notificationsTitle: string;
  noNotifications: string;
  closeBtn: string;
  showOnMap: string;
}

export const TRANSLATIONS: Record<LangCode, Translations> = {
  ro: {
    navMap: 'Hartă',
    navPlanner: 'Planificare rută',
    navLines: 'Linii',
    navFavorites: 'Favorite',
    navNotifications: 'Notificări',
    langRo: 'Română',
    langEn: 'English',

    whereToGo: 'Unde vrei să mergi?',
    searchPlaceholder: 'Caută stație, linie sau adresă...',
    myLocation: 'Locația mea',
    zoomIn: 'Mărește',
    zoomOut: 'Micșorează',
    bothDirections: 'Ambele sensuri',
    turDirection: 'Tur',
    returDirection: 'Retur',
    toward: 'spre',
    liveVehiclesCount: 'vehicule live TPBI',
    noSearchResults: 'Niciun rezultat găsit.',
    recentSearches: 'Căutări recente',
    clearHistory: 'Șterge istoricul',

    searchLinePlaceholder: 'Caută linie...',
    linesSelectedCount: (n: number) =>
      n === 0 ? 'Selectează până la 3 linii' : n === 1 ? '1 linie selectată' : `${n} linii selectate`,
    deselectLines: (n: number) => (n === 1 ? 'Deselectează 1 linie' : `Deselectează ${n} linii`),
    resetSelectedLines: 'Resetează liniile selectate',
    linesLimitWarning: (limit: number) => `Ați depășit limita de linii selectate: ${limit}`,
    catTram: 'Linii tramvai',
    catTrolley: 'Linii troleibuz',
    catBus: 'Linii autobuz',
    catRegional: 'Linii regionale',
    catNight: 'Linii de noapte',
    catMetro: 'Metrou',
    noLinesFound: 'Nu există linii pentru filtrul introdus.',

    stationCodeLabel: 'Cod stație',
    metroStationLabel: 'Stație de metrou',
    publicStationLabel: 'Stație transport public',
    saveFavorite: 'Salvează',
    savedFavorite: 'Salvat',
    directionsToHere: 'Direcții',
    directionsFromHere: 'Plecare de aici',
    arrivingLinesHeader: 'Sosiri în stație',
    loadingArrivals: 'Se încarcă sosirile TPBI...',
    noIncomingLines: 'Momentan nu sunt sosiri disponibile.',
    timetableLegend: '* Sosire estimată conform orarului planificat',
    liveGpsLegend: 'Timp calculat în timp real prin GPS TPBI',
    weeklyScheduleBtn: 'Program săptămânal',
    hideWeeklyScheduleBtn: 'Ascunde programul',
    scheduleMonFri: 'Luni - Vineri',
    scheduleSat: 'Sâmbătă',
    scheduleSun: 'Duminică',
    scheduleHourCol: 'Ora',
    scheduleMinCol: 'Minutele de plecare din stație',
    refreshCountdown: (sec: number) => `${sec} secunde până la reînnoirea datelor`,
    refreshingNow: 'Se actualizează datele în timp real...',
    minShort: 'min',
    secShort: 'sec',
    hrShort: 'ore',
    metersLabel: 'metri',
    stopsListTitle: 'Stații pe traseu',
    stopsCount: (n: number) => `${n} stații`,
    activeVehiclesOnLine: (n: number) =>
      n === 0 ? 'Niciun vehicul GPS activ' : n === 1 ? '1 vehicul pe traseu' : `${n} vehicule pe traseu`,
    disabilityAccessible: 'Accesibil persoanelor cu dizabilități',
    vehiclePopupFleet: 'Număr parc',
    vehiclePopupPlate: 'Înmatriculare',
    vehiclePopupHeadsign: 'Sens',
    vehiclePopupLive: 'Poziție GPS în timp real (TPBI)',

    plannerTitle: 'Planificare călătorie',
    fromLabel: 'De la',
    toLabel: 'Până la',
    chooseStartPlaceholder: 'Alege punctul de plecare...',
    chooseEndPlaceholder: 'Alege destinația...',
    swapPoints: 'Inversează punctele',
    useCurrentLocation: 'Locația curentă',
    pickPointOnMap: 'Punct pe hartă',
    pickStartOnMapHint: 'Apasă pe hartă pentru a alege punctul de plecare',
    pickEndOnMapHint: 'Apasă pe hartă pentru a alege destinația',
    favoritesGroup: 'Favorite',
    historyGroup: 'Istoric',
    stopsGroup: 'Stații',
    linesGroup: 'Linii',
    placesGroup: 'Locații / Adrese',
    startTimeLabel: 'Oră de pornire',
    startDateLabel: 'Dată de pornire',
    leaveNow: 'Acum',
    showAdvancedOptions: 'Afișează opțiunile avansate',
    hideAdvancedOptions: 'Ascunde opțiunile avansate',
    maxWalkLabel: 'Distanță maximă de mers pe jos',
    transportModesLabel: 'Tipuri de transport',
    modeTram: 'Tramvai',
    modeTrolley: 'Troleibuz',
    modeBus: 'Autobuz / Regional',
    modeMetro: 'Metrou',
    disabilityFriendlyLabel: 'Accesibil persoanelor cu dizabilități',
    findBestRoutesBtn: 'CAUTĂ CELE MAI BUNE RUTE',
    searchingRoutes: 'Se calculează rutele optime...',
    noRoutesFound: 'Nu am găsit nicio rută cu filtrele selectate. Încearcă o distanță pietonală mai mare.',
    leavesIn: 'Pleacă în',
    transfersCount: (n: number) => (n === 1 ? '1 schimbare' : `${n} schimbări`),
    directRoute: 'Fără schimbări',
    seeDetails: 'Vezi detalii',
    backToResults: 'ÎNAPOI LA REZULTATE',
    walkLegLabel: 'Mers pe jos',
    rideLegLabel: 'Călătorie cu linia',
    boardAt: 'Urcă la',
    alightAt: 'Coboară la',
    intermediateStops: (n: number) => (n === 1 ? '1 stație' : `${n} stații`),

    favoritesTitle: 'Favorite',
    searchFavoritesPlaceholder: 'Caută favorite...',
    favTabAll: 'Toate',
    favTabStops: 'Stații',
    favTabLines: 'Linii',
    favTabPlaces: 'Locații',
    addFavoriteMapPlaceBtn: '+ Salvează un punct de pe hartă',
    saveMapPointTitle: 'Salvează locația favorită',
    placeNamePlaceholder: 'Ex: Acasă, Birou, Facultate...',
    saveBtn: 'Salvează',
    cancelBtn: 'Anulează',
    deleteFavorite: 'Șterge din favorite',
    emptyFavoritesTitle: 'Nu ai adăugat încă elemente favorite',
    emptyFavoritesHint:
      'Apasă pe „Salvează” în cardul oricărei stații/linii sau salvează o locație direct de pe hartă (stocat local pe dispozitiv).',

    notificationsTitle: 'Informări și alerte trafic',
    noNotifications: 'Nu există informări active în acest moment.',
    closeBtn: 'Închide',
    showOnMap: 'Vezi pe hartă'
  },
  en: {
    navMap: 'Map',
    navPlanner: 'Route planner',
    navLines: 'Lines',
    navFavorites: 'Favorites',
    navNotifications: 'Notifications',
    langRo: 'Română',
    langEn: 'English',

    whereToGo: 'Where do you want to go?',
    searchPlaceholder: 'Search station, line, or address...',
    myLocation: 'My location',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    bothDirections: 'Both directions',
    turDirection: 'Outbound',
    returDirection: 'Inbound',
    toward: 'to',
    liveVehiclesCount: 'live TPBI vehicles',
    noSearchResults: 'No matching results found.',
    recentSearches: 'Recent searches',
    clearHistory: 'Clear history',

    searchLinePlaceholder: 'Search line...',
    linesSelectedCount: (n: number) =>
      n === 0 ? 'Select up to 3 lines' : n === 1 ? '1 line selected' : `${n} lines selected`,
    deselectLines: (n: number) => (n === 1 ? 'Deselect 1 line' : `Deselect ${n} lines`),
    resetSelectedLines: 'Reset selected lines',
    linesLimitWarning: (limit: number) => `Maximum selected lines limit reached: ${limit}`,
    catTram: 'Tram lines',
    catTrolley: 'Trolleybus lines',
    catBus: 'Bus lines',
    catRegional: 'Regional lines',
    catNight: 'Night lines',
    catMetro: 'Metro',
    noLinesFound: 'No lines match your search.',

    stationCodeLabel: 'Station code',
    metroStationLabel: 'Metro station',
    publicStationLabel: 'Public transport stop',
    saveFavorite: 'Save',
    savedFavorite: 'Saved',
    directionsToHere: 'Directions',
    directionsFromHere: 'Depart from here',
    arrivingLinesHeader: 'Incoming arrivals',
    loadingArrivals: 'Loading live TPBI arrivals...',
    noIncomingLines: 'No arrivals currently available.',
    timetableLegend: '* Scheduled arrival according to timetable',
    liveGpsLegend: 'Real-time ETA from TPBI GPS',
    weeklyScheduleBtn: 'Weekly schedule',
    hideWeeklyScheduleBtn: 'Hide schedule',
    scheduleMonFri: 'Monday - Friday',
    scheduleSat: 'Saturday',
    scheduleSun: 'Sunday',
    scheduleHourCol: 'Hour',
    scheduleMinCol: 'Scheduled departure minutes',
    refreshCountdown: (sec: number) => `${sec} seconds until data refresh`,
    refreshingNow: 'Refreshing live data...',
    minShort: 'min',
    secShort: 'sec',
    hrShort: 'hr',
    metersLabel: 'meters',
    stopsListTitle: 'Stops on route',
    stopsCount: (n: number) => `${n} stops`,
    activeVehiclesOnLine: (n: number) =>
      n === 0 ? 'No active GPS vehicles' : n === 1 ? '1 active vehicle' : `${n} active vehicles`,
    disabilityAccessible: 'Wheelchair accessible',
    vehiclePopupFleet: 'Fleet no.',
    vehiclePopupPlate: 'License plate',
    vehiclePopupHeadsign: 'Direction',
    vehiclePopupLive: 'Real-time GPS position (TPBI)',

    plannerTitle: 'Journey planner',
    fromLabel: 'From',
    toLabel: 'To',
    chooseStartPlaceholder: 'Choose starting point...',
    chooseEndPlaceholder: 'Choose destination...',
    swapPoints: 'Swap points',
    useCurrentLocation: 'Current location',
    pickPointOnMap: 'Point on map',
    pickStartOnMapHint: 'Click on the map to choose the starting point',
    pickEndOnMapHint: 'Click on the map to choose the destination',
    favoritesGroup: 'Favorites',
    historyGroup: 'History',
    stopsGroup: 'Stations',
    linesGroup: 'Lines',
    placesGroup: 'Places / Addresses',
    startTimeLabel: 'Start time',
    startDateLabel: 'Start date',
    leaveNow: 'Now',
    showAdvancedOptions: 'Show advanced options',
    hideAdvancedOptions: 'Hide advanced options',
    maxWalkLabel: 'Maximum walking distance',
    transportModesLabel: 'Vehicle types',
    modeTram: 'Tram',
    modeTrolley: 'Trolleybus',
    modeBus: 'Bus / Regional',
    modeMetro: 'Metro',
    disabilityFriendlyLabel: 'Wheelchair accessible',
    findBestRoutesBtn: 'FIND THE BEST ROUTES',
    searchingRoutes: 'Calculating optimal routes...',
    noRoutesFound: 'No routes found with the selected filters. Try increasing max walking distance.',
    leavesIn: 'Leaves in',
    transfersCount: (n: number) => (n === 1 ? '1 transfer' : `${n} transfers`),
    directRoute: 'Direct',
    seeDetails: 'See details',
    backToResults: 'BACK TO RESULTS',
    walkLegLabel: 'Walk',
    rideLegLabel: 'Take line',
    boardAt: 'Board at',
    alightAt: 'Alight at',
    intermediateStops: (n: number) => (n === 1 ? '1 stop' : `${n} stops`),

    favoritesTitle: 'Favorites',
    searchFavoritesPlaceholder: 'Search favorites...',
    favTabAll: 'All',
    favTabStops: 'Stations',
    favTabLines: 'Lines',
    favTabPlaces: 'Places',
    addFavoriteMapPlaceBtn: '+ Save a map location',
    saveMapPointTitle: 'Save favorite location',
    placeNamePlaceholder: 'E.g., Home, Office, University...',
    saveBtn: 'Save',
    cancelBtn: 'Cancel',
    deleteFavorite: 'Remove favorite',
    emptyFavoritesTitle: 'No favorites saved yet',
    emptyFavoritesHint:
      'Tap "Save" on any station or line card, or pin a custom location on the map (stored locally on your device).',

    notificationsTitle: 'Service & Traffic Notifications',
    noNotifications: 'There are no active notifications right now.',
    closeBtn: 'Close',
    showOnMap: 'View on map'
  }
};

export function getCategoryTitle(cat: LineCategory, t: Translations): string {
  switch (cat) {
    case 'TRAM':
      return t.catTram;
    case 'TROLLEY':
      return t.catTrolley;
    case 'BUS':
      return t.catBus;
    case 'REGIONAL':
      return t.catRegional;
    case 'NIGHT':
      return t.catNight;
    case 'METRO':
      return t.catMetro;
  }
}
