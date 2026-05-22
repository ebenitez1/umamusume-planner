import { useMemo, useState } from "react";
import { skillById, skills } from "../data";

interface Props {
  added: string[];
  onChange: (skillIds: string[]) => void;
}

const MAX_RESULTS = 12;

// Lets the user search the full 1796-skill catalog and add skills manually
// for evaluation. Useful for inherited (parent) skills, scenario rewards,
// "what-if" testing of skills your current deck wouldn't teach.
export function CustomSkillAdder({ added, onChange }: Props) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    const addedSet = new Set(added);
    return skills
      .filter((s) => !addedSet.has(s.id) && s.name.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [query, added]);

  const add = (id: string) => {
    onChange([...added, id]);
    setQuery("");
  };

  const remove = (id: string) => {
    onChange(added.filter((x) => x !== id));
  };

  return (
    <div className="custom-skills">
      <h3>Custom Skills (test inherited / scenario rewards)</h3>
      <div className="custom-skills-input">
        <input
          type="text"
          placeholder="Search 1,796 skills by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {results.length > 0 && (
          <ul className="custom-skills-dropdown">
            {results.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => add(s.id)}>
                  <span className={`skill-rarity-dot rarity-${s.rarity}`} />
                  <span className="custom-skill-name">{s.name}</span>
                  <span className="custom-skill-desc">{s.description.slice(0, 80)}{s.description.length > 80 ? "…" : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {added.length > 0 && (
        <ul className="custom-skills-chips">
          {added.map((id) => {
            const s = skillById.get(id);
            if (!s) return null;
            return (
              <li key={id} className={`chip chip-${s.rarity}`}>
                <span>{s.name}</span>
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => remove(id)}
                  aria-label={`Remove ${s.name}`}
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
