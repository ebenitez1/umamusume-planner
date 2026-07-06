import { useStore } from '../../store';

/**
 * Consistency % vs Cost Efficiency % sliders. The two are locked to sum to
 * 100 — moving either one derives the other via skillSlice.setWeights.
 */
export function SkillScoringWeights() {
  const weights = useStore((s) => s.weights);
  const setWeights = useStore((s) => s.setWeights);

  return (
    <section className="panel">
      <h2 className="panel-title">Skill Scoring Weights</h2>

      <div className="weight-row">
        <span className="weight-label">Consistency</span>
        <input
          type="range"
          className="weight-slider"
          min={0}
          max={100}
          step={5}
          value={weights.consistency}
          onChange={(e) => setWeights(Number(e.target.value))}
          aria-label="Consistency weight percent"
        />
        <span className="weight-value">{weights.consistency}%</span>
      </div>

      <div className="weight-row">
        <span className="weight-label">Cost Efficiency</span>
        <input
          type="range"
          className="weight-slider"
          min={0}
          max={100}
          step={5}
          value={weights.costEfficiency}
          onChange={(e) => setWeights(100 - Number(e.target.value))}
          aria-label="Cost efficiency weight percent"
        />
        <span className="weight-value">{weights.costEfficiency}%</span>
      </div>

      <p className="weights-note">Weights always sum to 100% — moving one slider adjusts the other.</p>
    </section>
  );
}
