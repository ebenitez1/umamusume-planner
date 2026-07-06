/**
 * Skill Browser modal (Import agent) — full SKILLS catalog with color/type
 * filter chips, text search, multi-select rows, Add Selected / Add All
 * (filtered). Paginated (120 rows/page) so the 1,839-skill catalog stays
 * responsive. Closes on Escape and on backdrop click.
 */

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useStore } from '../../store';
import { SKILLS, normalizeSkillName } from '../../data/skills';
import type { SkillColor, SkillEntry, SkillType } from '../../types';

const COLOR_OPTIONS: SkillColor[] = [
  'white',
  'gold',
  'pink',
  'green',
  'blue',
  'red',
];

const TYPE_OPTIONS: SkillType[] = [
  'speed',
  'stamina',
  'power',
  'guts',
  'wisdom',
  'recovery',
  'passive',
  'debuff',
  'unique',
];

const PAGE_SIZE = 120;

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function aptitudeTagsFor(skill: SkillEntry): string[] {
  const tags: string[] = [];
  const t = skill.aptitudeTags;
  for (const v of t.surface ?? []) tags.push(cap(v));
  for (const v of t.distance ?? []) tags.push(cap(v));
  for (const v of t.strategy ?? []) tags.push(cap(v));
  for (const v of t.phase ?? []) tags.push(cap(v));
  for (const v of t.terrain ?? []) tags.push(cap(v));
  return tags;
}

/** Normalized names precomputed once — search stays cheap while typing. */
const NORMALIZED_NAMES: ReadonlyMap<number, string> = new Map(
  SKILLS.map((s) => [s.id, normalizeSkillName(s.name)]),
);

interface SkillBrowserModalProps {
  open: boolean;
  onClose: () => void;
}

export function SkillBrowserModal({ open, onClose }: SkillBrowserModalProps) {
  const selectedSkillIds = useStore((s) => s.selectedSkillIds);
  const pushToast = useStore((s) => s.pushToast);

  const [search, setSearch] = useState('');
  const [colors, setColors] = useState<SkillColor[]>([]);
  const [types, setTypes] = useState<SkillType[]>([]);
  const [officialOnly, setOfficialOnly] = useState(false);
  const [purchasableOnly, setPurchasableOnly] = useState(true);
  const [page, setPage] = useState(0);
  const [checked, setChecked] = useState<ReadonlySet<number>>(new Set());

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const inBuild = useMemo(() => new Set(selectedSkillIds), [selectedSkillIds]);

  const filtered = useMemo(() => {
    const q = normalizeSkillName(search);
    return SKILLS.filter((s) => {
      if (officialOnly && !s.official) return false;
      if (purchasableOnly && !s.purchasable) return false;
      if (colors.length > 0 && !colors.includes(s.color)) return false;
      if (types.length > 0 && !types.includes(s.type)) return false;
      if (q && !(NORMALIZED_NAMES.get(s.id) ?? '').includes(q)) return false;
      return true;
    });
  }, [search, colors, types, officialOnly, purchasableOnly]);

  // Reset the page whenever the filter set changes.
  useEffect(() => {
    setPage(0);
  }, [search, colors, types, officialOnly, purchasableOnly]);

  if (!open) return null;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    (safePage + 1) * PAGE_SIZE,
  );

  const toggleColor = (c: SkillColor) =>
    setColors((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  const toggleType = (t: SkillType) =>
    setTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  const toggleRow = (id: number) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const addIds = (ids: number[], label: string) => {
    if (ids.length === 0) return;
    const st = useStore.getState();
    const merged = [...new Set([...st.selectedSkillIds, ...ids])];
    const addedCount = merged.length - st.selectedSkillIds.length;
    st.setSelectedSkillIds(merged);
    pushToast(
      addedCount > 0
        ? `Added ${addedCount} skill${addedCount === 1 ? '' : 's'} ${label}`
        : 'All of those skills were already in the build',
      addedCount > 0 ? 'success' : 'info',
    );
  };

  const handleAddSelected = () => {
    addIds([...checked], 'from the browser');
    setChecked(new Set());
  };

  const handleAddAllFiltered = () => {
    addIds(
      filtered.map((s) => s.id),
      '(all filtered)',
    );
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal sbm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Skill browser"
      >
        <div className="imp-modal-head">
          <h3>Skill Browser</h3>
          <span className="sbm-count">
            {filtered.length} of {SKILLS.length} skills
          </span>
          <button
            type="button"
            className="imp-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="sbm-filters">
          <input
            className="input sbm-search"
            type="text"
            placeholder="Search skills…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <label className="sbm-check">
            <input
              type="checkbox"
              checked={officialOnly}
              onChange={(e) => setOfficialOnly(e.target.checked)}
            />
            Official EN only
          </label>
          <label className="sbm-check">
            <input
              type="checkbox"
              checked={purchasableOnly}
              onChange={(e) => setPurchasableOnly(e.target.checked)}
            />
            Purchasable only
          </label>
        </div>

        <div className="sbm-chip-row">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={`sbm-chip ${colors.includes(c) ? 'active' : ''}`}
              onClick={() => toggleColor(c)}
            >
              <span className={`sbm-dot sbm-dot-${c}`} />
              {cap(c)}
            </button>
          ))}
        </div>
        <div className="sbm-chip-row">
          {TYPE_OPTIONS.map((t) => (
            <button
              key={t}
              type="button"
              className={`sbm-chip ${types.includes(t) ? 'active' : ''}`}
              onClick={() => toggleType(t)}
            >
              {cap(t)}
            </button>
          ))}
        </div>

        <div className="sbm-table">
          {pageRows.length === 0 ? (
            <p className="imp-empty">No skills match the current filters.</p>
          ) : (
            pageRows.map((s) => (
              <div
                key={s.id}
                className={`sbm-row ${checked.has(s.id) ? 'checked' : ''}`}
                onClick={() => toggleRow(s.id)}
              >
                <input
                  type="checkbox"
                  checked={checked.has(s.id)}
                  onChange={() => toggleRow(s.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className={`sbm-dot sbm-dot-${s.color}`} title={s.color} />
                <span className="sbm-name" title={s.description ?? s.name}>
                  {s.name}
                  {inBuild.has(s.id) && (
                    <span className="badge sbm-inbuild">In build</span>
                  )}
                </span>
                <span className="sbm-meta">{cap(s.type)}</span>
                <span className="sbm-meta">{s.spCost} SP</span>
                <span className="sbm-meta sbm-sv">SV {s.sv}</span>
                <span className="sbm-tags">
                  {aptitudeTagsFor(s).map((tag) => (
                    <span key={tag} className="sbm-tag">
                      {tag}
                    </span>
                  ))}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="sbm-footer">
          <div className="sbm-pager">
            <button
              type="button"
              className="btn"
              disabled={safePage === 0}
              onClick={() => setPage(safePage - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={14} />
            </button>
            <span>
              Page {safePage + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="btn"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage(safePage + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="sbm-actions">
            <button
              type="button"
              className="btn"
              onClick={handleAddAllFiltered}
              disabled={filtered.length === 0}
            >
              Add All ({filtered.length} filtered)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddSelected}
              disabled={checked.size === 0}
            >
              Add Selected ({checked.size})
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
