/**
 * Detected Skills review modal (Import agent) — shown after screenshot OCR /
 * screen capture. Each hit gets a checkbox, an editable match (dropdown of
 * fuzzy alternatives) and an editable SP cost; "Add Selected" commits to the
 * skill slice. Closes on Escape and on backdrop click.
 */

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../../store';
import { SKILLS_BY_ID, fuzzyFindSkills } from '../../data/skills';
import type { SkillEntry } from '../../types';
import type { OcrParseResult } from '../../utils/ocr';

interface DetectedSkillsModalProps {
  /** OCR output to review; null renders nothing (modal closed). */
  result: OcrParseResult | null;
  onClose: () => void;
}

interface RowState {
  key: number;
  included: boolean;
  skillId: number;
  cost: string;
  raw: string;
  similarity: number;
  options: SkillEntry[];
}

function similarityClass(sim: number): string {
  if (sim >= 0.9) return 'dsm-sim-high';
  if (sim >= 0.75) return 'dsm-sim-mid';
  return 'dsm-sim-low';
}

export function DetectedSkillsModal({
  result,
  onClose,
}: DetectedSkillsModalProps) {
  const pushToast = useStore((s) => s.pushToast);
  const [rows, setRows] = useState<RowState[]>([]);

  // Rebuild editable rows whenever a new OCR result arrives.
  useEffect(() => {
    if (!result) {
      setRows([]);
      return;
    }
    setRows(
      result.matched.map((d, i) => ({
        key: i,
        included: true,
        skillId: d.skill.id,
        cost: d.cost !== undefined ? String(d.cost) : '',
        raw: d.rawText,
        similarity: d.similarity,
        options: [
          d.skill,
          ...fuzzyFindSkills(d.rawText, 6).filter((s) => s.id !== d.skill.id),
        ],
      })),
    );
  }, [result]);

  // Escape to close.
  useEffect(() => {
    if (!result) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [result, onClose]);

  if (!result) return null;

  const patchRow = (key: number, patch: Partial<RowState>) =>
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );

  const includedRows = rows.filter((r) => r.included);

  const handleAddSelected = () => {
    if (includedRows.length === 0) return;
    const ids: number[] = [];
    const overrides: Record<number, number> = {};
    for (const r of includedRows) {
      ids.push(r.skillId);
      const n = parseInt(r.cost, 10);
      if (r.cost.trim() !== '' && Number.isFinite(n) && n > 0) {
        overrides[r.skillId] = n;
      }
    }
    const st = useStore.getState();
    st.setSelectedSkillIds([...new Set([...st.selectedSkillIds, ...ids])]);
    if (Object.keys(overrides).length > 0) {
      st.setCostOverrides({ ...st.costOverrides, ...overrides });
    }
    pushToast(
      `Added ${ids.length} detected skill${ids.length === 1 ? '' : 's'}`,
      'success',
    );
    onClose();
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal dsm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Detected skills"
      >
        <div className="imp-modal-head">
          <h3>Detected Skills</h3>
          <span className="sbm-count">
            {result.matched.length} match
            {result.matched.length === 1 ? '' : 'es'}
            {result.unmatched.length > 0 &&
              ` · ${result.unmatched.length} unrecognized`}
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

        {rows.length === 0 ? (
          <p className="imp-empty">
            No known skills were detected in the image. Try a tighter crop of
            the skill list, or add skills manually.
          </p>
        ) : (
          <div className="dsm-rows">
            {rows.map((r) => {
              const skill = SKILLS_BY_ID.get(r.skillId);
              return (
                <div
                  key={r.key}
                  className={`dsm-row ${r.included ? '' : 'dsm-row-off'}`}
                >
                  <input
                    type="checkbox"
                    checked={r.included}
                    onChange={(e) =>
                      patchRow(r.key, { included: e.target.checked })
                    }
                  />
                  <div className="dsm-main">
                    <select
                      className="select dsm-select"
                      value={r.skillId}
                      onChange={(e) =>
                        patchRow(r.key, {
                          skillId: parseInt(e.target.value, 10),
                        })
                      }
                    >
                      {r.options.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.name} ({opt.spCost} SP)
                        </option>
                      ))}
                    </select>
                    <span className="dsm-raw" title="Text read from the image">
                      read: “{r.raw}”
                    </span>
                  </div>
                  <input
                    className="input dsm-cost"
                    type="number"
                    min={1}
                    placeholder={skill ? String(skill.spCost) : 'SP'}
                    value={r.cost}
                    onChange={(e) => patchRow(r.key, { cost: e.target.value })}
                    title="SP cost override (blank = database cost)"
                  />
                  <span
                    className={`badge dsm-sim ${similarityClass(r.similarity)}`}
                    title="Match confidence"
                  >
                    {Math.round(r.similarity * 100)}%
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {result.unmatched.length > 0 && (
          <div className="dsm-unmatched">
            <h4>Unrecognized text</h4>
            <ul>
              {result.unmatched.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="sbm-footer">
          <span className="dsm-hint">
            Uncheck false positives; fix mismatches with the dropdown.
          </span>
          <div className="sbm-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddSelected}
              disabled={includedRows.length === 0}
            >
              Add Selected ({includedRows.length})
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
