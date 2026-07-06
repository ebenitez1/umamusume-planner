import { AppShell } from './components/layout/AppShell';
import { UmaHeader } from './components/layout/UmaHeader';
import { SkillOptimizer } from './components/optimizer/SkillOptimizer';
import { RatingCalculator } from './components/rating/RatingCalculator';
import { RaceSimulator } from './components/simulator/RaceSimulator';
import { MyBuilds } from './components/builds/MyBuilds';
import { useStore } from './store';

export default function App() {
  const activeTab = useStore((s) => s.activeTab);

  return (
    <AppShell>
      <UmaHeader />
      {activeTab === 'optimizer' && (
        <div className="optimizer-layout">
          <SkillOptimizer />
          <RatingCalculator />
        </div>
      )}
      {activeTab === 'simulator' && <RaceSimulator />}
      {activeTab === 'builds' && <MyBuilds />}
    </AppShell>
  );
}
