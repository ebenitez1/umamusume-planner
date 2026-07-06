/**
 * My Builds tab — grid of saved builds with Load / Share / Delete actions,
 * plus a "Save current as new build" entry point (opens SaveBuildModal via
 * uiSlice.saveModalOpen — the same modal Ctrl+S targets).
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../../store';
import { buildToShareUrl } from '../../utils/shareUrl';
import { SaveBuildModal } from './SaveBuildModal';
import type { Build, StatKey } from '../../types';
import './builds.css';

const STAT_LABELS: Record<StatKey, string> = {
  speed: 'SPD',
  stamina: 'STA',
  power: 'PWR',
  guts: 'GUT',
  wisdom: 'WIS',
};

const STAT_KEYS: StatKey[] = ['speed', 'stamina', 'power', 'guts', 'wisdom'];

function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

/** Top 3 stats of a build, highest first. */
function topStats(build: Build): { key: StatKey; value: number }[] {
  return STAT_KEYS.map((key) => ({ key, value: build.uma.stats[key] }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

/** Clipboard copy with a fallback for file:// / non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.clipboard &&
      typeof navigator.clipboard.writeText === 'function'
    ) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function MyBuilds() {
  const builds = useStore((s) => s.builds);
  const currentBuildId = useStore((s) => s.currentBuildId);
  const loadBuild = useStore((s) => s.loadBuild);
  const deleteBuild = useStore((s) => s.deleteBuild);
  const pushToast = useStore((s) => s.pushToast);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const setSaveModalOpen = useStore((s) => s.setSaveModalOpen);

  /** Id of the build whose Delete button is in "Confirm?" mode. */
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
    },
    [],
  );

  const handleLoad = (build: Build) => {
    loadBuild(build.id);
    pushToast(`Loaded build "${build.name}"`, 'success');
    setActiveTab('optimizer');
  };

  const handleShare = (build: Build) => {
    const url = buildToShareUrl(build);
    void copyText(url).then((ok) => {
      if (ok) pushToast('Share link copied to clipboard', 'success');
      else pushToast('Could not access clipboard — copy the URL manually', 'error');
    });
  };

  const handleDelete = (build: Build) => {
    if (confirmingId !== build.id) {
      setConfirmingId(build.id);
      if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
      confirmTimer.current = window.setTimeout(() => setConfirmingId(null), 3000);
      return;
    }
    if (confirmTimer.current !== null) window.clearTimeout(confirmTimer.current);
    setConfirmingId(null);
    deleteBuild(build.id);
    pushToast(`Deleted build "${build.name}"`, 'info');
  };

  const sorted = [...builds].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <section className="builds-page">
      <header className="builds-header">
        <div className="builds-header-text">
          <h2 className="panel-title">My Builds</h2>
          <div className="builds-count">
            {builds.length === 0
              ? 'No saved builds'
              : `${builds.length} saved build${builds.length === 1 ? '' : 's'}`}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setSaveModalOpen(true)}
        >
          Save current as new build
        </button>
      </header>

      {sorted.length === 0 ? (
        <div className="builds-empty">
          <p className="builds-empty-title">Nothing saved yet</p>
          <p>
            Set up your uma&apos;s stats, race config, and skills in the Skill
            Optimizer, then press <strong>Ctrl+S</strong> (or the button above)
            to save it as a build. Saved builds live in your browser and can be
            shared with anyone via a copyable URL.
          </p>
        </div>
      ) : (
        <div className="builds-grid">
          {sorted.map((build) => (
            <article
              key={build.id}
              className={
                build.id === currentBuildId ? 'build-card is-current' : 'build-card'
              }
            >
              <div className="build-card-top">
                <span className="build-card-name" title={build.name}>
                  {build.name}
                </span>
                <span className="build-card-date">{formatDate(build.createdAt)}</span>
              </div>

              <div className="build-card-summary">
                <div className="build-card-summary-row">
                  <span className="build-star-badge">
                    {'★'.repeat(build.uma.starLevel)}
                  </span>
                  <span>Unique Lv{build.uma.uniqueLevel}</span>
                  {build.id === currentBuildId && (
                    <span className="badge">Loaded</span>
                  )}
                </div>
                <div className="build-card-summary-row">
                  {topStats(build).map(({ key, value }) => (
                    <span key={key} className="build-stat-chip">
                      {STAT_LABELS[key]} <strong>{Math.round(value)}</strong>
                    </span>
                  ))}
                </div>
                <div className="build-card-summary-row">
                  <span>
                    {build.skillIds.length} skill
                    {build.skillIds.length === 1 ? '' : 's'}
                  </span>
                  <span>·</span>
                  <span>SP budget {build.spBudget}</span>
                </div>
              </div>

              <div className="build-card-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleLoad(build)}
                >
                  Load
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleShare(build)}
                >
                  Share
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={() => handleDelete(build)}
                >
                  {confirmingId === build.id ? 'Confirm?' : 'Delete'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* INTEGRATOR NOTE: if <SaveBuildModal/> gets mounted globally in
          AppShell (so Ctrl+S works on every tab), remove this line to avoid
          a double mount. */}
      <SaveBuildModal />
    </section>
  );
}
