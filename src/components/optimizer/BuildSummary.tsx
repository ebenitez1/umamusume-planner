import { useState } from 'react';
import type { OptimizerSummary } from '../../types';
import { useStore } from '../../store';
import { ExplainBuildModal } from './ExplainBuildModal';

interface StatDef {
  key: keyof OptimizerSummary;
  label: string;
  tone?: 'gold' | 'accent' | 'teal' | 'danger';
  format?: (v: number) => string;
}

const pct = (v: number) => `${v}%`;
const two = (v: number) => v.toFixed(2);

const STAT_DEFS: StatDef[] = [
  { key: 'bestScore', label: 'Best Score', tone: 'gold' },
  { key: 'usedPoints', label: 'Used Points' },
  { key: 'totalPoints', label: 'Total Points' },
  { key: 'remaining', label: 'Remaining' },
  { key: 'consistencyPct', label: 'Consistency', tone: 'teal', format: pct },
  { key: 'expectedValue', label: 'Expected Value' },
  { key: 'totalSv', label: 'Total SV', tone: 'accent' },
  { key: 'expectedActivations', label: 'Exp. Activations', format: two },
  { key: 'svPerSp', label: 'SV per SP', format: two },
  { key: 'skillDensity', label: 'Skill Density', format: two },
  { key: 'estActivationScore', label: 'Est. Activation Score', tone: 'gold' },
  { key: 'aptitudeTestScore', label: 'Aptitude Test Score', tone: 'teal' },
];

/**
 * Twelve-stat summary of the last optimizer run plus the Explain Build
 * modal launcher.
 */
export function BuildSummary() {
  const result = useStore((s) => s.optimizerResult);
  const [explainOpen, setExplainOpen] = useState(false);

  return (
    <section className="panel">
      <div className="summary-head">
        <h2 className="panel-title">Summary</h2>
        <button
          type="button"
          className="btn"
          disabled={!result}
          onClick={() => setExplainOpen(true)}
        >
          Explain Build
        </button>
      </div>
      {!result ? (
        <p className="buy-empty">Run the optimizer (add skills) to see build stats.</p>
      ) : (
        <div className="summary-grid">
          {STAT_DEFS.map(({ key, label, tone, format }) => {
            const raw = result.summary[key];
            const negative = key === 'remaining' && raw < 0;
            return (
              <div key={key} className={`summary-stat ${negative ? 'danger' : (tone ?? '')}`}>
                <div className="label">{label}</div>
                <div className="value">{format ? format(raw) : raw.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      )}
      {explainOpen && result && (
        <ExplainBuildModal explain={result.explain} onClose={() => setExplainOpen(false)} />
      )}
    </section>
  );
}
