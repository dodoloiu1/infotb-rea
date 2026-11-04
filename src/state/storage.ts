import type { FavoriteItem, LangCode, PlacePoint } from '../types';

const KEY_LANG = 'infotb_rea_lang';
const KEY_FAVS = 'infotb_rea_favorites_v1';
const KEY_HISTORY = 'infotb_rea_history_v1';

export function loadSavedLang(): LangCode {
  try {
    const val = localStorage.getItem(KEY_LANG);
    return val === 'en' ? 'en' : 'ro';
  } catch {
    return 'ro';
  }
}

export function saveLang(lang: LangCode): void {
  try {
    localStorage.setItem(KEY_LANG, lang);
  } catch {
    // ignore storage quota errors
  }
}

export function loadFavorites(): FavoriteItem[] {
  try {
    const raw = localStorage.getItem(KEY_FAVS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavorites(items: FavoriteItem[]): void {
  try {
    localStorage.setItem(KEY_FAVS, JSON.stringify(items));
  } catch {
    // ignore
  }
}

export function loadSearchHistory(): PlacePoint[] {
  try {
    const raw = localStorage.getItem(KEY_HISTORY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSearchHistory(items: PlacePoint[]): void {
  try {
    localStorage.setItem(KEY_HISTORY, JSON.stringify(items.slice(0, 10)));
  } catch {
    // ignore
  }
}
