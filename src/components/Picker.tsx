interface PickerOption {
  value: string;
  label: string;
  sub?: string;
}

interface Props {
  label: string;
  value: string;
  options: PickerOption[];
  onChange: (value: string) => void;
}

export function Picker({ label, value, options, onChange }: Props) {
  return (
    <label className="picker">
      <span className="picker-label">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
            {o.sub ? ` — ${o.sub}` : ""}
          </option>
        ))}
      </select>
    </label>
  );
}
