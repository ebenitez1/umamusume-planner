import { useState } from "react";
import { cardById, cards as allCards } from "../data";
import { CardPickerModal, CardThumb } from "./CardPickerModal";

interface Props {
  selected: string[];
  onChange: (cardIds: string[]) => void;
}

const SLOT_COUNT = 6;

// Visual deck: 6 slots each showing a card thumbnail when filled, "+" when
// empty. Clicking either opens the picker modal pre-filtered to that slot.
export function CardDeck({ selected, onChange }: Props) {
  const [pickingSlot, setPickingSlot] = useState<number | null>(null);

  const slots = Array.from({ length: SLOT_COUNT }, (_, i) => selected[i] ?? "");
  const setSlot = (idx: number, id: string) => {
    const next = [...selected];
    while (next.length < SLOT_COUNT) next.push("");
    next[idx] = id;
    onChange(next.filter(Boolean));
  };
  const clearSlot = (idx: number) => {
    const next = [...selected];
    next[idx] = "";
    onChange(next.filter(Boolean));
  };

  const playableCards = allCards.filter((c) => c.hasGameplay).length;

  return (
    <div className="card-deck">
      <h3>
        Support Cards — {playableCards} of {allCards.length} cards have curated skills
      </h3>
      <div className="card-deck-grid">
        {slots.map((id, idx) => {
          const card = cardById.get(id);
          return (
            <div key={idx} className="card-deck-slot">
              {card ? (
                <>
                  <CardThumb card={card} onClick={() => setPickingSlot(idx)} size="small" />
                  <button
                    type="button"
                    className="card-deck-slot-clear"
                    onClick={() => clearSlot(idx)}
                    aria-label="Remove card"
                    title="Remove"
                  >
                    ×
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="card-deck-empty"
                  onClick={() => setPickingSlot(idx)}
                  aria-label="Add a card to this slot"
                >
                  <span className="card-deck-empty-plus">+</span>
                  <span className="card-deck-empty-label">Add Card</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      <CardPickerModal
        open={pickingSlot !== null}
        onClose={() => setPickingSlot(null)}
        onPick={(id) => {
          if (pickingSlot !== null) setSlot(pickingSlot, id);
        }}
        excludeIds={selected.filter((_, i) => i !== pickingSlot)}
      />
    </div>
  );
}
