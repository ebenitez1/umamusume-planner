/**
 * Headline numbers + placement-distribution bar chart + warnings and
 * recommendations for the most recent simulation run.
 */
import { AlertTriangle, Lightbulb } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { SimulationOutcome } from '../../types';

export interface SimulationResultsProps {
  outcome: SimulationOutcome | null;
  /** Human-readable summary of the config the outcome was produced with. */
  runLabel: string | null;
}

/** 96.53 → "1:36.53" */
export function formatFinishTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds - mins * 60;
  return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
}

function barColor(place: number): string {
  if (place === 1) return 'var(--gold)';
  if (place <= 3) return 'var(--accent-2)';
  return 'var(--accent)';
}

export function SimulationResults({ outcome, runLabel }: SimulationResultsProps) {
  if (!outcome) {
    return (
      <section className="panel sim-results">
        <h2 className="panel-title">Results</h2>
        <p className="sim-placeholder">
          Configure the race on the left and press <strong>Run Simulation</strong> to
          Monte Carlo 1000 races against a simulated field.
        </p>
      </section>
    );
  }

  const chartData = outcome.placementDistribution.map((p, i) => ({
    place: i + 1,
    pct: Number((p * 100).toFixed(2)),
  }));

  const marginGood = outcome.staminaMarginPct >= 0;

  return (
    <section className="panel sim-results">
      <h2 className="panel-title">Results</h2>
      {runLabel && <p className="sim-run-label">{runLabel}</p>}

      <div className="sim-stat-cards">
        <div className="sim-card">
          <span className="sim-card-label">Win</span>
          <span className="sim-card-value gold">{outcome.winPct.toFixed(1)}%</span>
        </div>
        <div className="sim-card">
          <span className="sim-card-label">Top 3</span>
          <span className="sim-card-value teal">{outcome.top3Pct.toFixed(1)}%</span>
        </div>
        <div className="sim-card">
          <span className="sim-card-label">Mean Finish</span>
          <span className="sim-card-value">{formatFinishTime(outcome.meanFinishS)}</span>
        </div>
        <div className="sim-card">
          <span className="sim-card-label">Stamina Margin</span>
          <span className={`sim-card-value ${marginGood ? 'good' : 'bad'}`}>
            {outcome.staminaMarginPct >= 0 ? '+' : ''}
            {outcome.staminaMarginPct.toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="sim-chart">
        <span className="field-label">Finish Placement Probability</span>
        <ResponsiveContainer width="100%" height={240}>
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
              formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Probability']}
              labelFormatter={(label) => `Place ${label}`}
            />
            <Bar dataKey="pct" radius={[3, 3, 0, 0]}>
              {chartData.map((d) => (
                <Cell key={d.place} fill={barColor(d.place)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {outcome.warnings.length > 0 && (
        <div className="sim-issues warnings">
          <span className="field-label">
            <AlertTriangle size={12} /> Warnings
          </span>
          <ul>
            {outcome.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {outcome.recommendations.length > 0 && (
        <div className="sim-issues recommendations">
          <span className="field-label">
            <Lightbulb size={12} /> Recommendations
          </span>
          <ul>
            {outcome.recommendations.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {outcome.warnings.length === 0 && outcome.recommendations.length === 0 && (
        <p className="sim-hint sim-all-clear">
          All stat benchmarks for this distance are met — no warnings.
        </p>
      )}
    </section>
  );
}
