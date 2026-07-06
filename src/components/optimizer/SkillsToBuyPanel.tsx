import type { RankedSkill } from '../../types';
import { useStore } from '../../store';

/**
 * Hint-level SP discounts (in-game table, ~10% per level):
 * Lv0 0%, Lv1 10%, Lv2 20%, Lv3 30%, Lv4 35%, Lv5 40%.
 * Selecting a level writes the discounted BASE cost into costOverrides
 * (Fast Learner's ×0.9 is applied on top by the optimizer, not stored).
 */
const HINT_DISCOUNTS = [0, 0.1, 0.2, 0.3, 0.35, 0.4] as const;

function costAtHintLevel(baseCost: number, level: number): number {
  return Math.max(1, Math.floor(baseCost * (1 - HINT_DISCOUNTS[level])));
}

/** Derive the hint level a stored override represents; −1 = custom cost. */
function hintLevelFor(baseCost: number, override: number | undefined): number {
  if (override === undefined) return 0;
  for (let lv = 0; lv < HINT_DISCOUNTS.length; lv++) {
    if (costAtHintLevel(baseCost, lv) === override) return lv;
  }
  return -1;
}

interface SkillsToBuyPanelProps {
  /** Skill ids highlighted by the Ideal Skill Builder. */
  highlightedIds: ReadonlySet<number>;
}

/**
 * Ranked candidate list. Rows the optimizer bought are marked BUY; rows
 * highlighted by the Ideal Skill Builder glow pink. Each row exposes a
 * hint-level selector (writes costOverrides) and a remove toggle that drops
 * the skill from the working pool (selectedSkillIds).
 */
export function SkillsToBuyPanel({ highlightedIds }: SkillsToBuyPanelProps) {
  const result = useStore((s) => s.optimizerResult);
  const costOverrides = useStore((s) => s.costOverrides);
  const setCostOverride = useStore((s) => s.setCostOverride);
  const removeSkill = useStore((s) => s.removeSkill);

  const ranked: RankedSkill[] = result?.ranked ?? [];
  const pickedIds = new Set((result?.picked ?? []).map((p) => p.skill.id));

  return (
    <section className="panel">
      <h2 className="panel-title">Skills to Buy</h2>
      {ranked.length === 0 ? (
        <p className="buy-empty">
          No candidate skills yet — add skills with the Skill Entry tools above, then the
          optimizer will rank them here.
        </p>
      ) : (
        <div className="buy-table-wrap">
          <table className="buy-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Skill</th>
                <th className="num">SV</th>
                <th className="num">Exp. Act.</th>
                <th className="num">SV/SP</th>
                <th className="num">Cost</th>
                <th>Hint</th>
                <th>Status</th>
                <th aria-label="Remove" />
              </tr>
            </thead>
            <tbody>
              {ranked.map((entry, i) => {
                const { skill } = entry;
                const isPicked = pickedIds.has(skill.id);
                const isHighlighted = highlightedIds.has(skill.id);
                const isLocked = entry.consistency <= 0;
                const hintLevel = hintLevelFor(skill.spCost, costOverrides[skill.id]);
                const rowClass = [
                  isPicked ? 'picked' : '',
                  isHighlighted ? 'highlighted' : '',
                  isLocked ? 'locked' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <tr key={skill.id} className={rowClass}>
                    <td className="num">{i + 1}</td>
                    <td>
                      <span className="buy-skill-name">
                        <span className={`skill-dot ${skill.color}`} title={skill.color} />
                        <span className="name" title={skill.description ?? skill.name}>
                          {skill.name}
                        </span>
                      </span>
                    </td>
                    <td className="num">{skill.sv}</td>
                    <td className="num">{(entry.consistency * 100).toFixed(0)}%</td>
                    <td className="num">{entry.svPerSp.toFixed(2)}</td>
                    <td className="num">{entry.effectiveCost}</td>
                    <td>
                      <select
                        className="select hint-select"
                        value={hintLevel}
                        onChange={(e) => {
                          const lv = Number(e.target.value);
                          if (lv <= 0) setCostOverride(skill.id, null);
                          else setCostOverride(skill.id, costAtHintLevel(skill.spCost, lv));
                        }}
                        aria-label={`${skill.name} hint level`}
                      >
                        {hintLevel === -1 && (
                          <option value={-1} disabled>
                            Custom
                          </option>
                        )}
                        {HINT_DISCOUNTS.map((_, lv) => (
                          <option key={lv} value={lv}>
                            {lv}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {isPicked ? (
                        <span className="picked-badge">BUY</span>
                      ) : isLocked ? (
                        <span className="badge">locked</span>
                      ) : !skill.purchasable ? (
                        <span className="badge">inherent</span>
                      ) : (
                        <span className="badge">skip</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="buy-remove"
                        title={`Remove ${skill.name} from the candidate pool`}
                        onClick={() => removeSkill(skill.id)}
                      >
                        &times;
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
