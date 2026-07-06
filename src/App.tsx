import { useEffect, useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { UmaHeader } from './components/layout/UmaHeader';
import { SkillOptimizer } from './components/optimizer/SkillOptimizer';
import { RatingCalculator } from './components/rating/RatingCalculator';
import { RaceSimulator } from './components/simulator/RaceSimulator';
import { MyBuilds } from './components/builds/MyBuilds';
import { SaveBuildModal } from './components/builds/SaveBuildModal';
import { RestoreBanner } from './components/builds/RestoreBanner';
import { parseShareHash } from './utils/shareUrl';
import { useStore } from './store';
import type { Build } from './types';

export default function App() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const setSaveModalOpen = useStore((s) => s.setSaveModalOpen);
  const requestSimRun = useStore((s) => s.requestSimRun);

  // Detect a shared build in the URL hash once, on first load.
  const [sharedBuild, setSharedBuild] = useState<Build | null>(() =>
    parseShareHash(window.location.hash),
  );

  const dismissShared = () => {
    setSharedBuild(null);
    // Clear the hash so a refresh doesn't re-prompt.
    history.replaceState(null, '', window.location.pathname + window.location.search);
  };

  // Global keyboard shortcuts: Ctrl+S save · Ctrl+O builds · Ctrl+R run sim.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        setSaveModalOpen(true);
      } else if (key === 'o') {
        e.preventDefault();
        setActiveTab('builds');
      } else if (key === 'r') {
        e.preventDefault();
        // Switch to the simulator (if needed) and request a run.
        setActiveTab('simulator');
        requestSimRun();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setActiveTab, setSaveModalOpen, requestSimRun]);

  return (
    <AppShell>
      {sharedBuild && (
        <RestoreBanner build={sharedBuild} onDismiss={dismissShared} />
      )}
      <UmaHeader />
      {activeTab === 'optimizer' && (
        <div className="optimizer-layout">
          <SkillOptimizer />
          <RatingCalculator />
        </div>
      )}
      {activeTab === 'simulator' && <RaceSimulator />}
      {activeTab === 'builds' && <MyBuilds />}
      <SaveBuildModal />
    </AppShell>
  );
}
