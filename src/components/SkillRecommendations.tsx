import { useMemo } from "react";
import type { ChampionMeeting, SkillRecommendation, Style } from "../types";
import { cardById, skillById, skillIconUrl, umaById } from "../data";
import { rateSkillForBuild, totalBuildGain } from "../lib/skillRating";

interface Props {
  recommendations: SkillRecommendation[];
  ownedSkillIds: string[];
  onToggle: (skillId: string) => void;
  meeting: ChampionMeeting;
  style: Style;
}

const PRIORITY_LABEL: Record<SkillRecommendation["priority"], string> = {
  core: "Core (take these)",
  strong: "Strong picks",
  "nice-to-have": "Nice to have",
  avoid: "Do Not Get (won't activate in this race)",
};

export function SkillRecommendations({
  recommendations,
  ownedSkillIds,
  onToggle,
  meeting,
  style,
}: Props) {
  const ctx = useMemo(() => ({ meeting, style }), [meeting, style]);

  // Per-skill rating + sort each priority bucket by expected gain.
  const groupedRated = useMemo(() => {
    const out: Record<
      string,
      Array<{ rec: SkillRecommendation; rating: ReturnType<typeof rateSkillForBuild> }>
    > = {};
    for (const r of recommendations) {
      const rating = rateSkillForBuild(r.skill, ctx);
      (out[r.priority] ??= []).push({ rec: r, rating });
    }
    for (const k of Object.keys(out)) {
      out[k].sort((a, b) => b.rating.gainBashin - a.rating.gainBashin);
    }
    return out;
  }, [recommendations, ctx]);

  // Build total — sum of expected gain across CHECKED skills only.
  const buildTotal = useMemo(() => {
    const ownedSkills = ownedSkillIds
      .map((id) => skillById.get(id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));
    return totalBuildGain(ownedSkills, ctx);
  }, [ownedSkillIds, ctx]);

  if (recommendations.length === 0) {
    return (
      <div className="skill-recs">
        <p className="empty">No skill recommendations yet — pick a uma, meeting, and some cards.</p>
      </div>
    );
  }

  const owned = new Set(ownedSkillIds);

  return (
    <div className="skill-recs">
      <div className="skill-build-total">
        <span className="skill-build-total-label">Build skills total</span>
        <span className="skill-build-total-val">
          +{buildTotal.totalBashin.toFixed(1)} bashin
          <span className="skill-build-total-sub">
            ({buildTotal.totalMeters.toFixed(0)} m · {ownedSkillIds.length} skills checked)
          </span>
        </span>
      </div>

      {(["core", "strong", "nice-to-have", "avoid"] as const).map((p) =>
        groupedRated[p]?.length ? (
          <section key={p} className={`skill-group skill-group-${p}`}>
            <h4>{PRIORITY_LABEL[p]}</h4>
            <ul>
              {groupedRated[p].map(({ rec: r, rating }) => {
                const sourceLabel = r.source?.fromUmaId
                  ? umaById.get(r.source.fromUmaId)?.name
                  : r.source?.fromCardId
                    ? cardById.get(r.source.fromCardId)?.name
                    : r.source?.manual
                      ? "Manually added"
                      : "Scenario / inherited";
                const iconUrl = skillIconUrl(r.skill.iconid);
                return (
                  <li key={r.skill.id} className={`skill skill-${r.skill.rarity}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={owned.has(r.skill.id)}
                        onChange={() => onToggle(r.skill.id)}
                      />
                      {iconUrl && (
                        <img
                          className="skill-icon"
                          src={iconUrl}
                          alt=""
                          loading="lazy"
                          width={36}
                          height={36}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <div className="skill-body">
                        <div className="skill-head">
                          <span className="skill-name">{r.skill.name}</span>
                          <span
                            className="skill-gain"
                            title={`Activation ~${(rating.activationProb * 100).toFixed(0)}%  ×  context ${rating.contextMult.toFixed(2)}`}
                          >
                            {rating.blocked
                              ? "0.0"
                              : (rating.gainBashin >= 0 ? "+" : "") + rating.gainBashin.toFixed(1)}{" "}
                            bashin
                          </span>
                        </div>
                        <p className="skill-desc">{r.skill.description}</p>
                        <p className="skill-source">From: {sourceLabel}</p>
                        <ul className="skill-reasons">
                          {r.reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                          {rating.notes.length > 0 && (
                            <li className="skill-rating-notes">
                              {rating.notes.join(" · ")}
                            </li>
                          )}
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
