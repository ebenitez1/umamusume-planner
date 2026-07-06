/**
 * Side-by-side build comparison: pick 2–3 sources ("current" + saved builds),
 * simulate each against the SAME race config, competition level, and rival
 * seed, and show columns + grouped placement bars.
 */
import { useState } from 'react';
import { GitCompareArrows } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useStore } from '../../store';
import { SKILLS_BY_ID } from '../../data/skills';
import { simulate, type CompetitionLevel } from '../../utils/simulator';
import { formatFinishTime } from './SimulationResults';
import type { SimulationOutcome, SkillEntry } from '../../types';

const MAX_SOURCES = 3;
const CURRENT_KEY = '__current__';
const SERIES_COLORS = ['var(--accent)', 'var(--accent-2)', 'var(--gold)'];

export interface ComparisonViewProps {
  competition: CompetitionLevel;
  /** The current working skill list (already filtered by include checkboxes). */
  currentSkills: SkillEntry[];
}

interface ComparisonEntry {
  key: string;
  label: string;
  outcome: SimulationOutcome;
}

function skillsFromIds(ids: number[]): SkillEntry[] {
  return ids
    .map((id) => SKILLS_BY_ID.get(id))
    .filter((s): s is SkillEntry => s !== undefined);
}

export function ComparisonView({ competition, currentSkills }: ComparisonViewProps) {
  const uma = useStore((s) => s.uma);
  const aptitudes = useStore((s) => s.aptitudes);
  const race = useStore((s) => s.race);
  const builds = useStore((s) => s.builds);
  const pushToast = useStore((s) => s.pushToast);

  const [chosen, setChosen] = useState<string[]>([CURRENT_KEY]);
  const [results, setResults] = useState<ComparisonEntry[] | null>(null);

  const toggle = (key: string): void => {
    setChosen((prev) => {
      if (prev.includes(key)) return prev.filter((k) => k !== key);
      if (prev.length >= MAX_SOURCES) return prev;
      return [...prev, key];
    });
  };

  const runComparison = (): void => {
    // One shared seed → identical rival fields, so differences are build-only.
    const seed = Math.floor(Math.random() * 0xffffffff);
    const entries: ComparisonEntry[] = [];

    for (const key of chosen) {
      if (key === CURRENT_KEY) {
        entries.push({
          key,
          label: 'Current',
          outcome: simulate({
            uma,
            aptitudes,
            race,
            skills: currentSkills,
            competitionLevel: competition,
            seed,
          }),
        });
      } else {
        const build = builds.find((b) => b.id === key);
        if (!build) continue;
        entries.push({
          key,
          label: build.name,
          outcome: simulate({
            uma: build.uma,
            aptitudes: build.aptitudes,
            race, // same race config for every column
            skills: skillsFromIds(build.skillIds),
            competitionLevel: competition,
            seed,
          }),
        });
      }
    }

    setResults(entries);
    pushToast(`Compared ${entries.length} builds over 1000 runs each`, 'success');
  };

  const fieldSize = results?.[0]?.outcome.placementDistribution.length ?? 0;
  const chartData = Array.from({ length: fieldSize }, (_, i) => {
    const row: Record<string, number> = { place: i + 1 };
    results?.forEach((entry, idx) => {
      row[`s${idx}`] = Number(((entry.outcome.placementDistribution[i] ?? 0) * 100).toFixed(2));
    });
    return row;
  });

  return (
    <section className="panel sim-comparison">
      <h2 className="panel-title">Build Comparison</h2>
      <p className="sim-hint">
        Pick 2–3 builds — each is simulated with the current race config and the
        same rival field for a fair head-to-head.
      </p>

      <div className="sim-compare-sources">
        <label className="sim-compare-source">
          <input
            type="checkbox"
            checked={chosen.includes(CURRENT_KEY)}
            disabled={!chosen.includes(CURRENT_KEY) && chosen.length >= MAX_SOURCES}
            onChange={() => toggle(CURRENT_KEY)}
          />
          <span>Current (working state)</span>
        </label>
        {builds.map((b) => (
          <label key={b.id} className="sim-compare-source">
            <input
              type="checkbox"
              checked={chosen.includes(b.id)}
              disabled={!chosen.includes(b.id) && chosen.length >= MAX_SOURCES}
              onChange={() => toggle(b.id)}
            />
            <span>{b.name}</span>
          </label>
        ))}
        {builds.length === 0 && (
          <span className="sim-hint">
            No saved builds yet — save one from the Optimizer to compare against.
          </span>
        )}
      </div>

      <button
        type="button"
        className="btn sim-compare-btn"
        disabled={chosen.length < 2}
        onClick={runComparison}
      >
        <GitCompareArrows size={14} />
        Compare {chosen.length} Builds
      </button>

      {results && results.length > 0 && (
        <div className="sim-compare-results">
          <div className="sim-compare-table-wrap">
            <table className="sim-compare-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  {results.map((entry, idx) => (
                    <th key={entry.key} style={{ color: SERIES_COLORS[idx] }}>
                      {entry.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Win %</td>
                  {results.map((e) => (
                    <td key={e.key}>{e.outcome.winPct.toFixed(1)}%</td>
                  ))}
                </tr>
                <tr>
                  <td>Top 3 %</td>
                  {results.map((e) => (
                    <td key={e.key}>{e.outcome.top3Pct.toFixed(1)}%</td>
                  ))}
                </tr>
                <tr>
                  <td>Mean Finish</td>
                  {results.map((e) => (
                    <td key={e.key}>{formatFinishTime(e.outcome.meanFinishS)}</td>
                  ))}
                </tr>
                <tr>
                  <td>Stamina Margin</td>
                  {results.map((e) => (
                    <td
                      key={e.key}
                      className={e.outcome.staminaMarginPct >= 0 ? 'good' : 'bad'}
                    >
                      {e.outcome.staminaMarginPct >= 0 ? '+' : ''}
                      {e.outcome.staminaMarginPct.toFixed(1)}%
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <div className="sim-chart">
            <span className="field-label">Placement Probability by Build</span>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="place"
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  stroke="var(--border)"
                />
                <YAxis
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  stroke="var(--border)"
                  tickFormatter={(v: number) => `${v}%`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(148, 163, 184, 0.08)' }}
                  contentStyle={{
                    background: 'var(--panel-2)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    color: 'var(--text)',
                  }}
                  formatter={(value) => `${Number(value).toFixed(1)}%`}
                  labelFormatter={(label) => `Place ${label}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {results.map((entry, idx) => (
                  <Bar
                    key={entry.key}
                    dataKey={`s${idx}`}
                    name={entry.label}
                    fill={SERIES_COLORS[idx]}
                    radius={[3, 3, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}
