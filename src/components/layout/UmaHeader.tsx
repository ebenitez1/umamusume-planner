import { useStore } from '../../store';
import type { StatKey, UmaConfig } from '../../types';

const STAT_FIELDS: { key: StatKey; label: string }[] = [
  { key: 'speed', label: 'Speed' },
  { key: 'stamina', label: 'Stamina' },
  { key: 'power', label: 'Power' },
  { key: 'guts', label: 'Guts' },
  { key: 'wisdom', label: 'Wisdom' },
];

const STAR_LEVELS: UmaConfig['starLevel'][] = [1, 2, 3, 4, 5];
const UNIQUE_LEVELS: UmaConfig['uniqueLevel'][] = [1, 2, 3, 4, 5, 6];

/**
 * Persistent stat strip shown on every tab. Bound to umaSlice, so the
 * optimizer, rating panel, and simulator always share one uma.
 */
export function UmaHeader() {
  const uma = useStore((s) => s.uma);
  const setStat = useStore((s) => s.setStat);
  const setStarLevel = useStore((s) => s.setStarLevel);
  const setUniqueLevel = useStore((s) => s.setUniqueLevel);
  const currentBuildId = useStore((s) => s.currentBuildId);
  const buildName = useStore((s) =>
    s.currentBuildId ? s.builds.find((b) => b.id === s.currentBuildId)?.name : undefined,
  );

  return (
    <header className="uma-header">
      {STAT_FIELDS.map(({ key, label }) => (
        <div className="stat-field" key={key}>
          <label className="field-label" htmlFor={`uma-stat-${key}`}>
            {label}
          </label>
          <input
            id={`uma-stat-${key}`}
            className="input"
            type="number"
            min={1}
            max={2500}
            value={uma.stats[key]}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) setStat(key, Math.max(0, Math.min(2500, v)));
            }}
          />
        </div>
      ))}

      <div className="stat-field">
        <label className="field-label" htmlFor="uma-star">
          Star
        </label>
        <select
          id="uma-star"
          className="select"
          value={uma.starLevel}
          onChange={(e) => setStarLevel(Number(e.target.value) as UmaConfig['starLevel'])}
        >
          {STAR_LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              {'★'.repeat(lv)}
            </option>
          ))}
        </select>
      </div>

      <div className="stat-field">
        <label className="field-label" htmlFor="uma-unique">
          Unique
        </label>
        <select
          id="uma-unique"
          className="select"
          value={uma.uniqueLevel}
          onChange={(e) => setUniqueLevel(Number(e.target.value) as UmaConfig['uniqueLevel'])}
        >
          {UNIQUE_LEVELS.map((lv) => (
            <option key={lv} value={lv}>
              Lv{lv}
            </option>
          ))}
        </select>
      </div>

      <div className="uma-header-meta">
        {currentBuildId && buildName && (
          <span className="badge" title="Currently loaded build">
            Build: {buildName}
          </span>
        )}
        <span className="sync-indicator" title="These stats are shared by all tabs">
          synced
        </span>
      </div>
    </header>
  );
}
