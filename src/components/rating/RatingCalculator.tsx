/**
 * Rating Calculator — persistent right-rail panel on the Optimizer tab.
 *
 * Stats, star level, and unique level are edited in the shared UmaHeader
 * (umaSlice); this panel only ECHOES them read-only and recalculates live.
 * Skill Score auto-populates from skillSlice.optimizerResult when present
 * (sum of picked skills' profile-rating contribution: white 220 / gold 380 /
 * pink 700), with a manual override input when there is no optimizer result.
 */
import { useState } from 'react';
import { useStore } from '../../store';
import type { StatKey } from '../../types';
import { RATING_TIERS } from '../../data/ratings';
import { computeRating, skillScoreFromPicked } from '../../utils/ratingCalc';
import './rating.css';

const STAT_FIELDS: { key: StatKey; label: string }[] = [
  { key: 'speed', label: 'Spd' },
  { key: 'stamina', label: 'Sta' },
  { key: 'power', label: 'Pow' },
  { key: 'guts', label: 'Guts' },
  { key: 'wisdom', label: 'Wis' },
];

/** U-tier ladder (UG..US9) and LG get the pink badge treatment. */
function isUTier(tier: string): boolean {
  return tier.startsWith('U') || tier === 'LG';
}

/** Minimum rating for a named tier (0 for the bottom tier / unknown). */
function tierMin(tier: string): number {
  const entry = RATING_TIERS.find((t) => t.tier === tier);
  return entry ? entry.min : 0;
}

export function RatingCalculator() {
  const uma = useStore((s) => s.uma);
  const optimizerResult = useStore((s) => s.optimizerResult);

  // Manual skill score, used only while there is no optimizer result.
  const [manualSkillScore, setManualSkillScore] = useState(0);

  const fromOptimizer = optimizerResult !== null;
  const skillScore = fromOptimizer
    ? skillScoreFromPicked(optimizerResult.picked)
    : manualSkillScore;

  const rating = computeRating({
    stats: uma.stats,
    starLevel: uma.starLevel,
    uniqueLevel: uma.uniqueLevel,
    skillScore,
  });

  // Progress within the current tier band toward the next tier.
  const currentMin = tierMin(rating.tier);
  const nextMin = tierMin(rating.nextTier);
  const atTop = rating.toNextTier <= 0 || nextMin <= currentMin;
  const progressPct = atTop
    ? 100
    : Math.max(0, Math.min(100, ((rating.total - currentMin) / (nextMin - currentMin)) * 100));

  return (
    <aside className="panel rating-panel" aria-label="Rating Calculator">
      <h2 className="panel-title">Rating Calculator</h2>

      {/* Big tier badge + total */}
      <div className="rating-hero">
        <span
          className={`rating-tier-badge${isUTier(rating.tier) ? ' u-tier' : ''}`}
          title={`Projected tier: ${rating.tier}`}
        >
          {rating.tier}
        </span>
        <span className="rating-total">{rating.total.toLocaleString('en-US')}</span>
        <span className="rating-total-label">Projected Rating</span>
      </div>

      {/* Points to next tier + progress bar */}
      <div className="rating-next">
        <div className="rating-next-row">
          {atTop ? (
            <span>
              <strong>{rating.tier}</strong> is the top tier
            </span>
          ) : (
            <span>
              <strong>{rating.toNextTier.toLocaleString('en-US')}</strong> pts to{' '}
              <strong>{rating.nextTier}</strong>
            </span>
          )}
          <span>{Math.floor(progressPct)}%</span>
        </div>
        <div
          className="rating-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.floor(progressPct)}
          aria-label={`Progress toward ${rating.nextTier}`}
        >
          <div className="rating-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      {/* Three-line breakdown */}
      <div className="rating-breakdown">
        <div className="rating-breakdown-row">
          <span className="rb-label">Stats</span>
          <span className="rb-value">{rating.breakdown.stats.toLocaleString('en-US')}</span>
        </div>
        <div className="rating-breakdown-row">
          <span className="rb-label">Skills</span>
          <span className="rb-value">{rating.breakdown.skills.toLocaleString('en-US')}</span>
        </div>
        <div className="rating-breakdown-row">
          <span className="rb-label">Unique</span>
          <span className="rb-value">{rating.breakdown.unique.toLocaleString('en-US')}</span>
        </div>
      </div>

      {/* Skill score source */}
      <div className="rating-skill-source">
        <span className="field-label">Skill Score</span>
        {fromOptimizer ? (
          <>
            <span className="badge from-optimizer" title="Auto-populated from the optimizer's picked skills">
              from optimizer · {optimizerResult.picked.length}{' '}
              {optimizerResult.picked.length === 1 ? 'skill' : 'skills'} ·{' '}
              {skillScore.toLocaleString('en-US')} pts
            </span>
            <span className="rating-skill-hint">
              White 220 · Gold 380 · Unique 700 per learned skill.
            </span>
          </>
        ) : (
          <>
            <input
              className="input"
              type="number"
              min={0}
              step={10}
              value={manualSkillScore}
              aria-label="Manual skill score"
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setManualSkillScore(Math.max(0, v));
              }}
            />
            <span className="rating-skill-hint">
              Manual entry — run the optimizer to auto-populate (white 220 / gold 380 / unique
              700 per skill).
            </span>
          </>
        )}
      </div>

      {/* Read-only stat echoes (edited in the shared header above) */}
      <div className="rating-stats-echo" aria-label="Current stats (read-only)">
        {STAT_FIELDS.map(({ key, label }) => (
          <div className="rating-stat-echo" key={key}>
            <span className="rs-label">{label}</span>
            <span className="rs-value">{uma.stats[key]}</span>
          </div>
        ))}
      </div>
      <div className="rating-meta-echo">
        <span>
          Star: <span className="rm-star">{'★'.repeat(uma.starLevel)}</span>
        </span>
        <span>
          Unique: <span className="rm-unique">Lv{uma.uniqueLevel}</span>
        </span>
      </div>
      <span className="rating-echo-note">Edit stats, star, and unique level in the header.</span>
    </aside>
  );
}
