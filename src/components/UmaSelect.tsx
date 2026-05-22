import { useMemo, useState } from "react";
import { umas } from "../data";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

// Group umas by character (base game_id // 100) so multiple outfits of the
// same character (e.g. Special Week :: Special Dreamer, Special Week :: Maruzensky's
// Pal) cluster together.
export function UmaSelect({ value, onChange }: Props) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return umas;
    const q = search.toLowerCase();
    return umas.filter((u) => u.name.toLowerCase().includes(q));
  }, [search]);

  const grouped = useMemo(() => {
    const out = new Map<number, typeof umas>();
    for (const u of filtered) {
      const charId = Math.floor(u.gameId / 100);
      const list = out.get(charId) ?? [];
      list.push(u);
      out.set(charId, list);
    }
    return [...out.entries()].sort((a, b) =>
      (a[1][0].name ?? "").localeCompare(b[1][0].name ?? "")
    );
  }, [filtered]);

  return (
    <label className="picker">
      <span className="picker-label">Uma — {umas.length} available</span>
      <input
        type="text"
        placeholder="Search by name…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="picker-search"
      />
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {grouped.map(([charId, list]) => (
          <optgroup key={charId} label={list[0].name.split(" — ")[0]}>
            {list.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
