/**
 * Save Build modal — controlled by `uiSlice.saveModalOpen` (the integrator
 * binds Ctrl+S to `setSaveModalOpen(true)`).
 *
 * Save semantics:
 *  - No build loaded (`currentBuildId === null`): a single "Save" button
 *    creates a NEW build via `buildSlice.saveBuild(name)`.
 *  - A build is loaded: "Overwrite" re-snapshots the current state into the
 *    existing build via `buildSlice.updateBuild(id)` (renaming it if the name
 *    field was edited), while "Save as Copy" always creates a NEW independent
 *    build via `saveBuild(name)` — the loaded build is left untouched and the
 *    copy becomes current.
 *
 * Closes on Escape and on backdrop click.
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useStore } from '../../store';
import './builds.css';

export function SaveBuildModal() {
  const open = useStore((s) => s.saveModalOpen);
  const setSaveModalOpen = useStore((s) => s.setSaveModalOpen);
  const builds = useStore((s) => s.builds);
  const currentBuildId = useStore((s) => s.currentBuildId);
  const saveBuild = useStore((s) => s.saveBuild);
  const updateBuild = useStore((s) => s.updateBuild);
  const pushToast = useStore((s) => s.pushToast);

  const currentBuild = currentBuildId
    ? builds.find((b) => b.id === currentBuildId) ?? null
    : null;

  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Prefill the name (and focus) each time the modal opens.
  useEffect(() => {
    if (open) {
      setName(currentBuild ? currentBuild.name : '');
      // Focus after the element mounts.
      const t = window.setTimeout(() => inputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Escape closes the modal.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setSaveModalOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setSaveModalOpen]);

  if (!open) return null;

  const close = () => setSaveModalOpen(false);

  const handleSaveNew = () => {
    const build = saveBuild(name);
    pushToast(`Build "${build.name}" saved`, 'success');
    close();
  };

  const handleOverwrite = () => {
    if (!currentBuild) return;
    const updated = updateBuild(currentBuild.id);
    if (!updated) {
      pushToast('Could not overwrite build — saving as new instead', 'error');
      handleSaveNew();
      return;
    }
    const trimmed = name.trim();
    if (trimmed && trimmed !== updated.name) {
      // buildSlice has no rename action; patch the name directly.
      useStore.setState((s) => ({
        builds: s.builds.map((b) =>
          b.id === updated.id ? { ...b, name: trimmed } : b,
        ),
      }));
    }
    pushToast(`Build "${trimmed || updated.name}" updated`, 'success');
    close();
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    // Enter overwrites when a build is loaded, otherwise saves new.
    if (currentBuild) handleOverwrite();
    else handleSaveNew();
  };

  return (
    <div
      className="modal-backdrop"
      onClick={close}
      role="presentation"
    >
      <div
        className="modal save-build-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Save build"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="panel-title">
          {currentBuild ? 'Save Build' : 'Save New Build'}
        </h3>
        <form className="save-build-form" onSubmit={onSubmit}>
          <label className="field-label" htmlFor="save-build-name">
            Build name
          </label>
          <input
            id="save-build-name"
            ref={inputRef}
            className="input"
            type="text"
            value={name}
            maxLength={120}
            placeholder="e.g. CM Long — Late Surger"
            onChange={(e) => setName(e.target.value)}
          />
          {currentBuild ? (
            <p className="save-build-hint">
              &ldquo;Overwrite&rdquo; updates <strong>{currentBuild.name}</strong>{' '}
              with the current stats, race config, and skills.
              &ldquo;Save as Copy&rdquo; keeps it untouched and creates a new build.
            </p>
          ) : (
            <p className="save-build-hint">
              Snapshots the current uma stats, aptitudes, race config, skill
              list, and SP budget into a build stored in your browser.
            </p>
          )}
          <div className="save-build-actions">
            <button type="button" className="btn" onClick={close}>
              Cancel
            </button>
            {currentBuild ? (
              <>
                <button type="button" className="btn" onClick={handleSaveNew}>
                  Save as Copy
                </button>
                <button type="submit" className="btn btn-primary">
                  Overwrite
                </button>
              </>
            ) : (
              <button type="submit" className="btn btn-primary">
                Save
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
