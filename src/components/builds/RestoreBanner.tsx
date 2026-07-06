/**
 * RestoreBanner — slim banner shown when a shared build is detected in the
 * URL hash (`#build=…`). The integrator decodes the hash in App (via
 * `parseShareHash` from src/utils/shareUrl.ts) and mounts this with the
 * decoded Build:
 *
 *   const [shared, setShared] = useState<Build | null>(
 *     () => parseShareHash(window.location.hash),
 *   );
 *   {shared && (
 *     <RestoreBanner build={shared} onDismiss={() => setShared(null)} />
 *   )}
 *
 * "Load" appends the build to buildSlice.builds (fresh id on collision) and
 * loads it via buildSlice.loadBuild; both Load and Dismiss call onDismiss so
 * the host can unmount the banner and clear the hash.
 */

import { useStore } from '../../store';
import type { Build } from '../../types';
import './builds.css';

export interface RestoreBannerProps {
  /** The decoded shared build (from parseShareHash / decodeBuild). */
  build: Build;
  /** Called after Load succeeds and when Dismiss is clicked. */
  onDismiss: () => void;
}

function freshId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function RestoreBanner({ build, onDismiss }: RestoreBannerProps) {
  const handleLoad = () => {
    const state = useStore.getState();
    // Never collide with an existing saved build's id (e.g. the sharer
    // opening their own link) — and never store an empty id.
    const needsNewId =
      !build.id || state.builds.some((b) => b.id === build.id);
    const stored: Build = needsNewId ? { ...build, id: freshId() } : build;

    useStore.setState((s) => ({ builds: [...s.builds, stored] }));
    const after = useStore.getState();
    after.loadBuild(stored.id);
    after.pushToast(`Loaded shared build "${stored.name}"`, 'success');
    after.setActiveTab('optimizer');
    onDismiss();
  };

  return (
    <div className="restore-banner" role="status">
      <span className="restore-banner-label">
        Shared build detected: <strong>{build.name}</strong> — load it into the
        planner?
      </span>
      <span className="restore-banner-actions">
        <button type="button" className="btn btn-primary" onClick={handleLoad}>
          Load
        </button>
        <button type="button" className="btn" onClick={onDismiss}>
          Dismiss
        </button>
      </span>
    </div>
  );
}
