import type { SkillRecommendation } from "../types";
import { cardById, umaById } from "../data";

interface Props {
  recommendations: SkillRecommendation[];
  ownedSkillIds: string[];
  onToggle: (skillId: string) => void;
}

const PRIORITY_LABEL: Record<SkillRecommendation["priority"], string> = {
  core: "Core (take these)",
  strong: "Strong picks",
  "nice-to-have": "Nice to have",
};

export function SkillRecommendations({ recommendations, ownedSkillIds, onToggle }: Props) {
  if (recommendations.length === 0) {
    return (
      <div className="skill-recs">
        <p className="empty">No skill recommendations yet — pick a uma, meeting, and some cards.</p>
      </div>
    );
  }
  const grouped = recommendations.reduce<Record<string, SkillRecommendation[]>>(
    (acc, r) => {
      (acc[r.priority] ??= []).push(r);
      return acc;
    },
    {}
  );

  const owned = new Set(ownedSkillIds);

  return (
    <div className="skill-recs">
      {(["core", "strong", "nice-to-have"] as const).map((p) =>
        grouped[p]?.length ? (
          <section key={p} className={`skill-group skill-group-${p}`}>
            <h4>{PRIORITY_LABEL[p]}</h4>
            <ul>
              {grouped[p].map((r) => {
                const sourceLabel = r.source?.fromUmaId
                  ? umaById.get(r.source.fromUmaId)?.name
                  : r.source?.fromCardId
                    ? cardById.get(r.source.fromCardId)?.name
                    : "Scenario / inherited";
                return (
                  <li key={r.skill.id} className={`skill skill-${r.skill.rarity}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={owned.has(r.skill.id)}
                        onChange={() => onToggle(r.skill.id)}
                      />
                      <div className="skill-body">
                        <div className="skill-head">
                          <span className="skill-name">{r.skill.name}</span>
                          <span className="skill-pts">+{r.skill.ratingPoints}</span>
                        </div>
                        <p className="skill-desc">{r.skill.description}</p>
                        <p className="skill-source">From: {sourceLabel}</p>
                        <ul className="skill-reasons">
                          {r.reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null
      )}
    </div>
  );
}
