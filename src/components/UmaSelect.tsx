import { useEffect, useMemo, useState } from "react";
import { umaById, umas } from "../data";

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

  // If the user types a search that filters out the current selection, the
  // native <select> would visually display the first option but value would
  // stay stale. Auto-select the first filtered uma so dropdown + state stay
  // in sync — typing 'dai' immediately picks Daiwa Scarlet.
  useEffect(() => {
    if (!search.trim()) return;
    if (filtered.length === 0) return;
    if (filtered.some((u) => u.id === value)) return;
    onChange(filtered[0].id);
  }, [filtered, search, value, onChange]);

  // Make sure the currently-selected uma is always visible in the dropdown
  // even when the search would otherwise filter it out — pinned to the top
  // under a "Selected" group.
  const selectedUma = umaById.get(value);
  const groupedRest = useMemo(() => {
    const out = new Map<number, typeof umas>();
    for (const u of filtered) {
      if (selectedUma && u.id === selectedUma.id) continue; // dedupe — shown in pinned group
      const charId = Math.floor(u.gameId / 100);
      const list = out.get(charId) ?? [];
      list.push(u);
      out.set(charId, list);
    }
    return [...out.entries()].sort((a, b) =>
      (a[1][0].name ?? "").localeCompare(b[1][0].name ?? "")
    );
  }, [filtered, selectedUma]);

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
        {selectedUma && (
          <optgroup label="Selected">
            <option value={selectedUma.id}>{selectedUma.name}</option>
          </optgroup>
        )}
        {groupedRest.map(([charId, list]) => (
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
