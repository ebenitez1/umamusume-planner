/**
 * Skill entry toolbar (Import agent) — rendered inside the optimizer page.
 * Manual add with fuzzy autocomplete, JSON import (paste or file), screenshot
 * OCR upload, screen capture, and the Skill Browser launcher.
 *
 * NOTE: OCR (screenshot/capture) loads Tesseract.js on demand and pulls its
 * worker/WASM/language data from a CDN — those two buttons need internet.
 */

import { useMemo, useRef, useState } from 'react';
import { useEffect } from 'react';
import { Camera, FileJson, Library, Monitor, Plus, X } from 'lucide-react';
import { useStore } from '../../store';
import {
  SKILLS_BY_ID,
  findSkillByName,
  fuzzyFindSkills,
} from '../../data/skills';
import type { SkillEntry } from '../../types';
import {
  matchSkillName,
  recognizeImage,
  recognizeScreenCapture,
} from '../../utils/ocr';
import type { OcrParseResult } from '../../utils/ocr';
import { SkillBrowserModal } from './SkillBrowserModal';
import { DetectedSkillsModal } from './DetectedSkillsModal';
import './import.css';

export function SkillEntryTools() {
  const addSkill = useStore((s) => s.addSkill);
  const setCostOverride = useStore((s) => s.setCostOverride);
  const pushToast = useStore((s) => s.pushToast);

  // --- manual entry -----------------------------------------------------
  const [query, setQuery] = useState('');
  const [chosenId, setChosenId] = useState<number | null>(null);
  const [costText, setCostText] = useState('');
  const [listOpen, setListOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  // --- tool modals / OCR state -------------------------------------------
  const [jsonOpen, setJsonOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrParseResult | null>(null);
  const [busy, setBusy] = useState<'screenshot' | 'capture' | null>(null);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo<SkillEntry[]>(
    () =>
      chosenId === null && query.trim().length >= 2
        ? fuzzyFindSkills(query, 8)
        : [],
    [query, chosenId],
  );

  const pickSuggestion = (skill: SkillEntry) => {
    setQuery(skill.name);
    setChosenId(skill.id);
    setListOpen(false);
  };

  const resolveManualSkill = (): SkillEntry | undefined => {
    if (chosenId !== null) return SKILLS_BY_ID.get(chosenId);
    return (
      findSkillByName(query) ??
      suggestions[0] ??
      matchSkillName(query)?.skill
    );
  };

  const handleAdd = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const skill = resolveManualSkill();
    if (!skill) {
      pushToast(`No skill matching "${trimmed}"`, 'error');
      return;
    }
    addSkill(skill.id);
    const n = parseInt(costText, 10);
    if (costText.trim() !== '' && Number.isFinite(n) && n > 0) {
      setCostOverride(skill.id, n);
    }
    pushToast(`Added ${skill.name}`, 'success');
    setQuery('');
    setChosenId(null);
    setCostText('');
    setListOpen(false);
    setHighlight(0);
  };

  const onQueryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown' && suggestions.length > 0) {
      e.preventDefault();
      setListOpen(true);
      setHighlight((h) => Math.min(h + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp' && suggestions.length > 0) {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (listOpen && suggestions.length > 0) {
        pickSuggestion(suggestions[Math.min(highlight, suggestions.length - 1)]);
      } else {
        handleAdd();
      }
    } else if (e.key === 'Escape') {
      setListOpen(false);
    }
  };

  // --- OCR ---------------------------------------------------------------
  const runOcr = async (job: 'screenshot' | 'capture', source?: File) => {
    setBusy(job);
    setProgress(0);
    try {
      const result =
        job === 'screenshot' && source
          ? await recognizeImage(source, setProgress)
          : await recognizeScreenCapture(setProgress);
      if (result.matched.length === 0 && result.unmatched.length === 0) {
        pushToast('No readable text found in the image', 'error');
      } else {
        setOcrResult(result);
      }
    } catch (err) {
      pushToast(err instanceof Error ? err.message : 'OCR failed', 'error');
    } finally {
      setBusy(null);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void runOcr('screenshot', file);
  };

  const resolvedPreview =
    chosenId === null && query.trim().length >= 2 ? suggestions[0] : null;

  return (
    <section className="panel skill-entry-tools">
      <h2 className="panel-title">Skill Entry</h2>

      <div className="set-manual">
        <div className="set-autocomplete">
          <input
            className="input set-query"
            type="text"
            placeholder="Add a skill by name…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setChosenId(null);
              setListOpen(true);
              setHighlight(0);
            }}
            onFocus={() => setListOpen(true)}
            onBlur={() => window.setTimeout(() => setListOpen(false), 120)}
            onKeyDown={onQueryKeyDown}
            aria-label="Skill name"
          />
          {listOpen && suggestions.length > 0 && (
            <ul className="set-suggestions" role="listbox">
              {suggestions.map((s, i) => (
                <li
                  key={s.id}
                  role="option"
                  aria-selected={i === highlight}
                  className={`set-suggestion ${i === highlight ? 'active' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSuggestion(s);
                  }}
                  onMouseEnter={() => setHighlight(i)}
                >
                  <span className={`sbm-dot sbm-dot-${s.color}`} />
                  <span className="set-suggestion-name">{s.name}</span>
                  <span className="set-suggestion-cost">{s.spCost} SP</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <input
          className="input set-cost"
          type="number"
          min={1}
          placeholder={
            chosenId !== null
              ? `${SKILLS_BY_ID.get(chosenId)?.spCost ?? ''} SP`
              : resolvedPreview
                ? `${resolvedPreview.spCost} SP`
                : 'SP cost'
          }
          value={costText}
          onChange={(e) => setCostText(e.target.value)}
          title="Optional SP cost override (blank = database cost)"
          aria-label="SP cost override"
        />
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleAdd}
          disabled={query.trim().length === 0}
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="set-actions">
        <button type="button" className="btn" onClick={() => setJsonOpen(true)}>
          <FileJson size={14} /> Import JSON
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => fileRef.current?.click()}
          disabled={busy !== null}
        >
          <Camera size={14} /> Upload Screenshot
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => void runOcr('capture')}
          disabled={busy !== null}
        >
          <Monitor size={14} /> Screen Capture
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setBrowserOpen(true)}
        >
          <Library size={14} /> Browse Skills
        </button>
        {busy !== null && (
          <span className="set-busy">
            Scanning… {Math.round(progress * 100)}%
          </span>
        )}
      </div>
      <p className="set-note">
        Screenshot OCR downloads its engine (Tesseract.js) on first use — those
        two buttons need an internet connection.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onFileChange}
      />

      <JsonImportModal open={jsonOpen} onClose={() => setJsonOpen(false)} />
      <SkillBrowserModal
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
      />
      <DetectedSkillsModal
        result={ocrResult}
        onClose={() => setOcrResult(null)}
      />
    </section>
  );
}

/* ======================================================================== *
 * JSON import modal
 * Accepts: [{ "name": "...", "cost"?: 123 }, { "id": 200341 }, "Skill Name"]
 * (or the same array under a top-level { "skills": [...] } key).
 * ======================================================================== */

interface JsonImportModalProps {
  open: boolean;
  onClose: () => void;
}

interface ImportReport {
  added: number;
  unknown: string[];
}

function JsonImportModal({ open, onClose }: JsonImportModalProps) {
  const pushToast = useStore((s) => s.pushToast);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const jsonFileRef = useRef<HTMLInputElement>(null);

  // Escape to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setText(await file.text());
      setError(null);
      setReport(null);
    } catch {
      setError('Could not read that file.');
    }
  };

  const handleImport = () => {
    setError(null);
    setReport(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setError('Invalid JSON.');
      return;
    }
    let items: unknown[];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as { skills?: unknown }).skills)
    ) {
      items = (parsed as { skills: unknown[] }).skills;
    } else {
      items = [];
    }
    if (items.length === 0) {
      setError(
        'Expected a JSON array like [{"name": "Corner Adept ○", "cost": 110}].',
      );
      return;
    }

    const ids: number[] = [];
    const overrides: Record<number, number> = {};
    const unknown: string[] = [];
    for (const item of items) {
      let skill: SkillEntry | undefined;
      let cost: number | undefined;
      let label = '';
      if (typeof item === 'string') {
        label = item;
        skill = findSkillByName(item) ?? matchSkillName(item)?.skill;
      } else if (typeof item === 'object' && item !== null) {
        const rec = item as { name?: unknown; id?: unknown; cost?: unknown };
        if (typeof rec.id === 'number' && SKILLS_BY_ID.has(rec.id)) {
          skill = SKILLS_BY_ID.get(rec.id);
        } else if (typeof rec.name === 'string') {
          label = rec.name;
          skill = findSkillByName(rec.name) ?? matchSkillName(rec.name)?.skill;
        } else {
          label = JSON.stringify(item);
        }
        if (typeof rec.cost === 'number' && rec.cost > 0) {
          cost = Math.round(rec.cost);
        }
      } else {
        label = String(item);
      }
      if (skill) {
        ids.push(skill.id);
        if (cost !== undefined) overrides[skill.id] = cost;
      } else {
        unknown.push(label || '(unrecognized entry)');
      }
    }

    if (ids.length > 0) {
      const st = useStore.getState();
      st.setSelectedSkillIds([...new Set([...st.selectedSkillIds, ...ids])]);
      if (Object.keys(overrides).length > 0) {
        st.setCostOverrides({ ...st.costOverrides, ...overrides });
      }
    }
    setReport({ added: ids.length, unknown });
    pushToast(
      ids.length > 0
        ? `Imported ${ids.length} skill${ids.length === 1 ? '' : 's'}`
        : 'No skills matched that JSON',
      ids.length > 0 ? 'success' : 'error',
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
        className="modal imp-json-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import skills from JSON"
      >
        <div className="imp-modal-head">
          <h3>Import Skills from JSON</h3>
          <button
            type="button"
            className="imp-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <p className="set-note">
          Paste an array of {'{'}"name" | "id", "cost"?{'}'} objects (plain
          name strings also work), or load a .json file.
        </p>
        <textarea
          className="input imp-textarea"
          rows={8}
          spellCheck={false}
          placeholder='[{"name": "Corner Adept ○", "cost": 110}, {"name": "Straightaway Adept"}]'
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError(null);
            setReport(null);
          }}
        />
        {error && <p className="imp-error">{error}</p>}
        {report && (
          <div className="imp-report">
            <p>
              Imported <strong>{report.added}</strong> skill
              {report.added === 1 ? '' : 's'}.
            </p>
            {report.unknown.length > 0 && (
              <>
                <p className="imp-error">
                  {report.unknown.length} entr
                  {report.unknown.length === 1 ? 'y' : 'ies'} not recognized:
                </p>
                <ul className="imp-unknown-list">
                  {report.unknown.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="sbm-footer">
          <button
            type="button"
            className="btn"
            onClick={() => jsonFileRef.current?.click()}
          >
            Choose File…
          </button>
          <div className="sbm-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleImport}
              disabled={text.trim().length === 0}
            >
              Import
            </button>
            <button type="button" className="btn" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <input
          ref={jsonFileRef}
          type="file"
          accept=".json,application/json,.txt"
          style={{ display: 'none' }}
          onChange={(e) => void handleFile(e)}
        />
      </div>
    </div>
  );
}
