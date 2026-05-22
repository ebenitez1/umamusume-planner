import { useMemo } from "react";
import { umas } from "../data";

interface Props {
  value: string;
  onChange: (id: string) => void;
}

export function UmaSelect({ value, onChange }: Props) {
  const { playable, unplayable } = useMemo(() => {
    const playable = umas.filter((u) => !u.unplayable);
    const unplayable = umas.filter((u) => u.unplayable);
    return { playable, unplayable };
  }, []);

  return (
    <label className="picker">
      <span className="picker-label">Uma</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <optgroup label={`Playable (${playable.length}) — full gameplay data`}>
          {playable.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </optgroup>
        <optgroup label={`Catalog only (${unplayable.length}) — no stats yet`}>
          {unplayable.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </optgroup>
      </select>
    </label>
  );
}
