import type { Stats } from "../types";

interface Props {
  stats: Stats;
  onChange: (stats: Stats) => void;
}

const STAT_LABELS: Array<[keyof Stats, string, string]> = [
  ["speed", "Speed", "#27c4ff"],
  ["stamina", "Stamina", "#ff7676"],
  ["power", "Power", "#ffb73a"],
  ["guts", "Guts", "#ff7ec1"],
  ["wit", "Wit", "#6ee687"],
];

export function StatInputs({ stats, onChange }: Props) {
  const set = (k: keyof Stats, v: number) => onChange({ ...stats, [k]: v });
  return (
    <div className="stat-inputs">
      <h3>Final Stats</h3>
      <div className="stat-grid">
        {STAT_LABELS.map(([k, label, color]) => (
          <label key={k} className="stat-row" style={{ borderColor: color }}>
            <span>{label}</span>
            <input
              type="number"
              min={0}
              max={1200}
              value={stats[k]}
              onChange={(e) => set(k, Number(e.target.value) || 0)}
            />
            <div className="stat-bar">
              <div
                className="stat-bar-fill"
                style={{
                  width: `${Math.min(100, (stats[k] / 1200) * 100)}%`,
                  background: color,
                }}
              />
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
