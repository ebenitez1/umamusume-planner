import { useMemo } from "react";
import { cards } from "../data";
import type { CardRarity, CardType, SupportCard } from "../types";

interface Props {
  selected: string[];
  onChange: (cardIds: string[]) => void;
}

const SLOT_COUNT = 6;

const TYPE_LABELS: Record<CardType, string> = {
  speed: "Speed",
  stamina: "Stamina",
  power: "Power",
  guts: "Guts",
  wit: "Wit",
  friend: "Friend",
};
const TYPE_ORDER: CardType[] = ["speed", "stamina", "power", "guts", "wit", "friend"];
const RARITY_ORDER: CardRarity[] = ["SSR", "SR", "R"];

function buildGroupedOptions() {
  const buckets = new Map<string, SupportCard[]>();
  for (const c of cards) {
    const key = `${c.type}__${c.rarity}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(c);
  }
  return TYPE_ORDER.flatMap((t) =>
    RARITY_ORDER.map((r) => {
      const list = buckets.get(`${t}__${r}`) ?? [];
      if (!list.length) return null;
      const withGameplay = list.filter((c) => c.hasGameplay);
      const catalog = list.filter((c) => !c.hasGameplay);
      return {
        label: `${TYPE_LABELS[t]} ${r} (${list.length})`,
        gameplay: withGameplay,
        catalog,
      };
    }).filter(Boolean) as Array<{
      label: string;
      gameplay: SupportCard[];
      catalog: SupportCard[];
    }>
  );
}

export function CardDeck({ selected, onChange }: Props) {
  const groups = useMemo(buildGroupedOptions, []);

  const setSlot = (idx: number, id: string) => {
    const next = [...selected];
    while (next.length < SLOT_COUNT) next.push("");
    next[idx] = id;
    onChange(next.filter(Boolean));
  };

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => selected[i] ?? "");
  const totalCards = cards.length;
  const playableCards = cards.filter((c) => c.hasGameplay).length;

  return (
    <div className="card-deck">
      <h3>
        Support Card Deck (up to 6) — {playableCards} of {totalCards} cards have curated skills
      </h3>
      <div className="slot-grid">
        {slots.map((id, idx) => (
          <select
            key={idx}
            value={id}
            onChange={(e) => setSlot(idx, e.target.value)}
            className="card-slot"
          >
            <option value="">— empty slot —</option>
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.gameplay.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                {g.catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (no skills)
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
