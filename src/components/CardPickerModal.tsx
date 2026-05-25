import { useMemo, useState } from "react";
import { cards, supportCardImageUrl } from "../data";
import type { CardRarity, CardType, SupportCard } from "../types";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (cardId: string) => void;
  excludeIds?: string[]; // already-picked card ids to dim/skip
}

const TYPES: Array<{ key: CardType | "all"; label: string }> = [
  { key: "all",     label: "All" },
  { key: "speed",   label: "Speed" },
  { key: "stamina", label: "Stamina" },
  { key: "power",   label: "Power" },
  { key: "guts",    label: "Guts" },
  { key: "wit",     label: "Wit" },
  { key: "friend",  label: "Friend" },
];

const RARITIES: Array<{ key: CardRarity | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: "SSR", label: "SSR" },
  { key: "SR",  label: "SR" },
  { key: "R",   label: "R" },
];

export function CardPickerModal({ open, onClose, onPick, excludeIds = [] }: Props) {
  const [type, setType] = useState<CardType | "all">("all");
  const [rarity, setRarity] = useState<CardRarity | "all">("SSR");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const exclude = new Set(excludeIds);
    const q = search.trim().toLowerCase();
    return cards.filter((c) => {
      if (exclude.has(c.id)) return false;
      if (type !== "all" && c.type !== type) return false;
      if (rarity !== "all" && c.rarity !== rarity) return false;
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [type, rarity, search, excludeIds]);

  if (!open) return null;

  return (
    <div className="card-modal-backdrop" onClick={onClose}>
      <div className="card-modal" onClick={(e) => e.stopPropagation()}>
        <header className="card-modal-header">
          <h3>Pick a Support Card ({filtered.length})</h3>
          <button className="card-modal-close" onClick={onClose} aria-label="Close">×</button>
        </header>
        <div className="card-modal-filters">
          <input
            type="text"
            placeholder="Search by character or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="card-modal-search"
          />
          <div className="card-modal-chiprow">
            {TYPES.map((t) => (
              <button
                key={t.key}
                className={`filter-chip ${type === t.key ? "filter-chip-active" : ""}`}
                onClick={() => setType(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="card-modal-chiprow">
            {RARITIES.map((r) => (
              <button
                key={r.key}
                className={`filter-chip ${rarity === r.key ? "filter-chip-active" : ""}`}
                onClick={() => setRarity(r.key)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="card-modal-grid">
          {filtered.map((c) => (
            <CardThumb key={c.id} card={c} onClick={() => { onPick(c.id); onClose(); }} />
          ))}
          {filtered.length === 0 && (
            <p className="empty">No cards match those filters.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function CardThumb({ card, onClick, size = "normal" }: {
  card: SupportCard;
  onClick?: () => void;
  size?: "small" | "normal";
}) {
  const url = supportCardImageUrl(card.apiId);
  return (
    <button type="button" className={`card-thumb card-thumb-${size}`} onClick={onClick} title={card.name}>
      {url ? (
        <img
          src={url}
          alt={card.name}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <div className="card-thumb-fallback">{card.name}</div>
      )}
      <span className={`card-thumb-rarity card-thumb-rarity-${card.rarity}`}>{card.rarity}</span>
      {card.iconUrl && (
        <img
          src={card.iconUrl}
          alt=""
          className="card-thumb-type"
          width={22}
          height={22}
          loading="lazy"
        />
      )}
      {size === "normal" && <span className="card-thumb-name">{card.name}</span>}
    </button>
  );
}
