import { useState } from 'preact/hooks';
import type { LangCode, StaticTransitData, TransitLine, TransitNotification } from '../types';
import type { Translations } from '../i18n/translations';
import { CloseXSvg } from './OfficialSvgs';

interface NotificationsModalProps {
  open: boolean;
  notifications: TransitNotification[];
  data: StaticTransitData | null;
  lang: LangCode;
  t: Translations;
  onClose: () => void;
  onSelectLine: (line: TransitLine) => void;
  onFocusCoords: (lat: number, lng: number) => void;
}

export function NotificationsModal({
  open,
  notifications,
  data,
  lang,
  t,
  onClose,
  onSelectLine,
  onFocusCoords
}: NotificationsModalProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!open) return null;

  return (
    <div class="stbModalOverlay" onClick={onClose}>
      <div class="stbNotificationsModal" onClick={e => e.stopPropagation()}>
        <div class="stbModalHeader">
          <h2>{t.notificationsTitle}</h2>
          <button type="button" class="iconCircleBtn" aria-label={t.closeBtn} onClick={onClose}>
            <CloseXSvg size={20} />
          </button>
        </div>

        <div class="stbModalContent">
          {notifications.length === 0 ? (
            <div class="emptyStateBox">
              <div class="emptyStateTitle">{t.noNotifications}</div>
            </div>
          ) : (
            notifications.map(n => {
              const isOpen = expandedId === n.id;
              const title = lang === 'en' ? n.titleEn : n.titleRo;
              const msg = lang === 'en' ? n.messageEn : n.messageRo;
              const lineObj = data?.lineByName.get(n.lineName);
              const dateStr = new Date(n.createdAt).toLocaleDateString(
                lang === 'en' ? 'en-GB' : 'ro-RO',
                { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }
              );

              return (
                <div
                  key={n.id}
                  class={`notifCard ${isOpen ? 'expanded' : ''}`}
                  onClick={() => setExpandedId(isOpen ? null : n.id)}
                >
                  <div class="notifTopRow">
                    <span
                      class="linePillMini"
                      style={{ backgroundColor: n.lineColor || '#33AA44' }}
                    >
                      {n.lineName}
                    </span>
                    <span class="notifTitle">{title}</span>
                    <span class="notifDate">{dateStr}</span>
                  </div>
                  <div class="notifBody">{msg}</div>
                  {isOpen && (lineObj || (n.lat !== undefined && n.lng !== undefined)) && (
                    <div class="notifActions">
                      {lineObj && (
                        <button
                          type="button"
                          class="textLinkBtn"
                          onClick={e => {
                            e.stopPropagation();
                            onClose();
                            onSelectLine(lineObj);
                          }}
                        >
                          {t.showOnMap} ({lineObj.name})
                        </button>
                      )}
                      {!lineObj && n.lat !== undefined && n.lng !== undefined && (
                        <button
                          type="button"
                          class="textLinkBtn"
                          onClick={e => {
                            e.stopPropagation();
                            onClose();
                            onFocusCoords(n.lat!, n.lng!);
                          }}
                        >
                          {t.showOnMap}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div class="stbModalFooter">
          <button type="button" class="primaryGreenBtn" onClick={onClose}>
            {t.closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
