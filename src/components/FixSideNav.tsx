import type { ActivePanel, LangCode } from '../types';
import type { Translations } from '../i18n/translations';
import {
  EnFlagSvg,
  RailFavoritesSvg,
  RailLinesSvg,
  RailMapSvg,
  RailNotificationsSvg,
  RailPlannerSvg,
  RoFlagSvg
} from './OfficialSvgs';

interface FixSideNavProps {
  activePanel: ActivePanel;
  drawerOpen: boolean;
  notificationsOpen: boolean;
  notificationsCount: number;
  lang: LangCode;
  t: Translations;
  onSelectPanel: (panel: ActivePanel) => void;
  onOpenNotifications: () => void;
  onSwitchLang: (lang: LangCode) => void;
}

export function FixSideNav({
  activePanel,
  drawerOpen,
  notificationsOpen,
  notificationsCount,
  lang,
  t,
  onSelectPanel,
  onOpenNotifications,
  onSwitchLang
}: FixSideNavProps) {
  const isSelected = (panel: ActivePanel) => {
    if (notificationsOpen) return false;
    if (panel === 'map') return activePanel === 'map' && !drawerOpen;
    return activePanel === panel && drawerOpen;
  };

  return (
    <aside class="fixSideNav" role="navigation" aria-label="InfoTB">
      <div class="fixNavContainer">
        <div class="topContainer">
          <button
            type="button"
            class={`navIcon ${isSelected('map') ? 'selected' : ''}`}
            title={t.navMap}
            aria-label={t.navMap}
            onClick={() => onSelectPanel('map')}
          >
            <RailMapSvg />
          </button>

          <button
            type="button"
            class={`navIcon ${isSelected('planner') ? 'selected' : ''}`}
            title={t.navPlanner}
            aria-label={t.navPlanner}
            onClick={() => onSelectPanel('planner')}
          >
            <RailPlannerSvg />
          </button>

          <button
            type="button"
            class={`navIcon ${isSelected('lines') ? 'selected' : ''}`}
            title={t.navLines}
            aria-label={t.navLines}
            onClick={() => onSelectPanel('lines')}
          >
            <RailLinesSvg />
          </button>

          <button
            type="button"
            class={`navIcon ${isSelected('favorites') ? 'selected' : ''}`}
            title={t.navFavorites}
            aria-label={t.navFavorites}
            onClick={() => onSelectPanel('favorites')}
          >
            <RailFavoritesSvg />
          </button>

          <button
            type="button"
            class={`navIcon navIconBadgeWrap ${notificationsOpen ? 'selected' : ''}`}
            title={t.navNotifications}
            aria-label={t.navNotifications}
            onClick={onOpenNotifications}
          >
            <RailNotificationsSvg />
            {notificationsCount > 0 && (
              <span class="matBadgeWarn">
                {notificationsCount > 99 ? '99+' : notificationsCount}
              </span>
            )}
          </button>
        </div>

        <div class="bottomConainer">
          <button
            type="button"
            class={`langIcon ${lang === 'ro' ? 'selected' : ''}`}
            title={t.langRo}
            aria-label={t.langRo}
            onClick={() => onSwitchLang('ro')}
          >
            <RoFlagSvg />
          </button>
          <button
            type="button"
            class={`langIcon ${lang === 'en' ? 'selected' : ''}`}
            title={t.langEn}
            aria-label={t.langEn}
            onClick={() => onSwitchLang('en')}
          >
            <EnFlagSvg />
          </button>
          <span class="appVersionBadge" title="InfoTB REA v1.1">
            {t.appVersion}
          </span>
        </div>
      </div>
    </aside>
  );
}
