import { useMemo, useState } from "react";
import { skillById, skillIconUrl, skills as allSkills } from "../data";

interface Props {
  skillIds: string[];
  onChange: (skillIds: string[]) => void;
}

const MAX_RESULTS = 20;

// Build Skills chip grid — shows the user's currently-selected skills as
// rounded chips (icon + name + ×) in a 2-column layout. "+ Add Skill" at
// the bottom toggles an inline search panel that filters the full 1,796-
// skill catalog. Matches umalator-global's UX.
export function BuildSkillsList({ skillIds, onChange }: Props) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");

  const ownedSet = useMemo(() => new Set(skillIds), [skillIds]);

  const ownedSkills = useMemo(
    () => skillIds.map((id) => skillById.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s)),
    [skillIds]
  );

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allSkills
      .filter((s) => !ownedSet.has(s.id) && s.name.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [query, ownedSet]);

  const remove = (id: string) => onChange(skillIds.filter((x) => x !== id));
  const add = (id: string) => {
    onChange([...skillIds, id]);
    setQuery("");
  };

  return (
    <div className="build-skills">
      <h3>Skills ({ownedSkills.length})</h3>

      {ownedSkills.length === 0 && (
        <p className="empty">No skills picked yet. Click "+ Add Skill" or check skills in the recommendations panel.</p>
      )}

      <div className="build-skills-grid">
        {ownedSkills.map((s) => {
          const iconUrl = skillIconUrl(s.iconid);
          return (
            <div key={s.id} className={`build-chip build-chip-${s.rarity}`}>
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt=""
                  width={28}
                  height={28}
                  loading="lazy"
                  className="build-chip-icon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span className={`build-chip-rarity-dot rarity-${s.rarity}`} />
              )}
              <span className="build-chip-name" title={s.description}>
                {s.name}
              </span>
              <button
                type="button"
                className="build-chip-x"
                onClick={() => remove(s.id)}
                aria-label={`Remove ${s.name}`}
                title="Remove"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>

      {adding && (
        <div className="build-skills-search">
          <input
            type="text"
            autoFocus
            placeholder="Search 1,796 skills by name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <ul className="build-skills-dropdown">
              {results.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => add(s.id)}>
                    <span className={`build-chip-rarity-dot rarity-${s.rarity}`} />
                    <span className="custom-skill-name">{s.name}</span>
                    <span className="custom-skill-desc">
                      {s.description.slice(0, 80)}
                      {s.description.length > 80 ? "…" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        className={`build-add ${adding ? "build-add-active" : ""}`}
        onClick={() => {
          setAdding((v) => !v);
          if (adding) setQuery("");
        }}
      >
        {adding ? "Close search" : "+ Add Skill"}
      </button>
    </div>
  );
}
