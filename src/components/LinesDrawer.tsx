import { useState } from 'preact/hooks';
import type { LineCategory, TransitLine } from '../types';
import { getCategoryTitle, type Translations } from '../i18n/translations';
import { normalizeRo } from '../utils/geo';
import { CloseXSvg, ModeMiniSvg, SearchMagnifierSvg } from './OfficialSvgs';

const CATEGORY_ORDER: LineCategory[] = [
  'TRAM',
  'TROLLEY',
  'BUS',
  'REGIONAL',
  'NIGHT',
  'METRO'
];

interface LinesDrawerProps {
  lines: TransitLine[];
  selectedLineNames: string[];
  t: Translations;
  onToggleLine: (line: TransitLine) => void;
  onResetLines: () => void;
}

export function LinesDrawer({
  lines,
  selectedLineNames,
  t,
  onToggleLine,
  onResetLines
}: LinesDrawerProps) {
  const [search, setSearch] = useState('');
  const q = normalizeRo(search);

  const filtered = q
    ? lines.filter(
        l =>
          normalizeRo(l.name).includes(q) ||
          normalizeRo(l.d0.to).includes(q) ||
          normalizeRo(l.d1.to).includes(q)
      )
    : lines;

  const selectedSet = new Set(selectedLineNames);

  return (
    <div class="linesContainer">
      <div class="lines-succes-top-container">
        <div class="drawerSearchInputBox">
          <input
            type="text"
            value={search}
            placeholder={t.searchLinePlaceholder}
            aria-label={t.searchLinePlaceholder}
            onInput={e => setSearch((e.target as HTMLInputElement).value)}
          />
          <span class="drawerInputIcon" onClick={() => search && setSearch('')}>
            {search ? <CloseXSvg size={18} /> : <SearchMagnifierSvg size={20} />}
          </span>
        </div>

        <div class="linesCounterContainer">
          {t.linesSelectedCount(selectedLineNames.length)}
        </div>
      </div>

      <div class="lines-success-container">
        <div class="searchedLines">
          <div class="listOfLines">
            {filtered.length === 0 ? (
              <div class="noResults">{t.noLinesFound}</div>
            ) : (
              CATEGORY_ORDER.map(cat => {
                const group = filtered.filter(l => l.cat === cat);
                if (group.length === 0) return null;
                return (
                  <div key={cat} class="lineGroupe">
                    <div class="titleGrupe">
                      <span class="grupeIcon">
                        <ModeMiniSvg cat={cat} color="#58586b" size={18} />
                      </span>
                      <span>{getCategoryTitle(cat, t)}</span>
                    </div>
                    <div class="lineGrupeContainer">
                      {group.map(line => {
                        const isSel = selectedSet.has(line.name);
                        return (
                          <div key={line.name} class="lineContainer">
                            <button
                              type="button"
                              class={`line ${isSel ? 'selected' : ''}`}
                              style={{
                                borderColor: line.color,
                                backgroundColor: isSel ? line.color : '#ffffff',
                                color: isSel ? '#ffffff' : '#1f2937'
                              }}
                              title={`${line.name}: ${line.d0.to} ↔ ${line.d1.to}`}
                              onClick={() => onToggleLine(line)}
                            >
                              {line.name}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {selectedLineNames.length > 0 && (
        <div class="reset-lines-button-container">
          <button type="button" class="resetLinesButton" onClick={onResetLines}>
            {t.deselectLines(selectedLineNames.length)}
          </button>
        </div>
      )}
    </div>
  );
}
