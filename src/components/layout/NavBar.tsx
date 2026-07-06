import { Gauge, Sparkles, FolderHeart, Rabbit } from 'lucide-react';
import clsx from 'clsx';
import { useStore } from '../../store';
import type { TabId } from '../../types';

const TABS: { id: TabId; label: string; Icon: typeof Gauge }[] = [
  { id: 'simulator', label: 'Race Simulator', Icon: Gauge },
  { id: 'optimizer', label: 'Skill Optimizer', Icon: Sparkles },
  { id: 'builds', label: 'My Builds', Icon: FolderHeart },
];

export function NavBar() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Rabbit size={20} />
        Uma Planner
      </div>
      <div className="nav-tabs">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className={clsx('nav-tab', activeTab === id && 'active')}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
