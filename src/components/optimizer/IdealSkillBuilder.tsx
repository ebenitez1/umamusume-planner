import { useState } from 'react';
import type { RaceConfig, SkillEntry } from '../../types';
import { useStore } from '../../store';
import { SKILLS_BY_ID } from '../../data/skills';

export type IdealCategory = 'track' | 'distance' | 'strategy' | 'general';

const CATEGORY_LABELS: Record<IdealCategory, string> = {
  track: 'Track',
  distance: 'Distance',
  strategy: 'Strategy',
  general: 'General',
};

const CATEGORY_ORDER: IdealCategory[] = ['track', 'distance', 'strategy', 'general'];

interface IdealSkillBuilderProps {
  /** Receives the set of matching skill ids to highlight in the ranked list. */
  onGenerate: (ids: ReadonlySet<number>) => void;
}

function matchesCategory(skill: SkillEntry, category: IdealCategory, race: RaceConfig): boolean {
  const tags = skill.aptitudeTags;
  switch (category) {
    case 'track':
      return tags.surface?.includes(race.surface) ?? false;
    case 'distance':
      return tags.distance?.includes(race.distanceClass) ?? false;
    case 'strategy':
      return tags.strategy?.includes(race.strategy) ?? false;
    case 'general':
      return (
        (!tags.surface || tags.surface.length === 0) &&
        (!tags.distance || tags.distance.length === 0) &&
        (!tags.strategy || tags.strategy.length === 0)
      );
  }
}

/**
 * Ideal Skill Builder: pick which aptitude categories the "ideal" build
 * should lean on, then Generate Build highlights every candidate skill in
 * the ranked list that matches the current race config in those categories.
 */
export function IdealSkillBuilder({ onGenerate }: IdealSkillBuilderProps) {
  const race = useStore((s) => s.race);
  const selectedSkillIds = useStore((s) => s.selectedSkillIds);
  const pushToast = useStore((s) => s.pushToast);

  const [checked, setChecked] = useState<Record<IdealCategory, boolean>>({
    track: true,
    distance: true,
    strategy: true,
    general: false,
  });

  const toggle = (cat: IdealCategory) =>
    setChecked((prev) => ({ ...prev, [cat]: !prev[cat] }));

  const generate = () => {
    const ids = new Set<number>();
    for (const id of selectedSkillIds) {
      const skill = SKILLS_BY_ID.get(id);
      if (!skill) continue;
      for (const cat of CATEGORY_ORDER) {
        if (checked[cat] && matchesCategory(skill, cat, race)) {
          ids.add(id);
          break;
        }
      }
    }
    onGenerate(ids);
    pushToast(
      ids.size > 0
        ? `Ideal build: ${ids.size} matching skill${ids.size === 1 ? '' : 's'} highlighted`
        : 'No candidate skills match the selected categories',
      ids.size > 0 ? 'success' : 'info',
    );
  };

  return (
    <section className="panel">
      <h2 className="panel-title">Ideal Skill Builder</h2>
      <div className="ideal-checks">
        {CATEGORY_ORDER.map((cat) => (
          <label key={cat} className="opt-toggle">
            <input type="checkbox" checked={checked[cat]} onChange={() => toggle(cat)} />
            {CATEGORY_LABELS[cat]}
          </label>
        ))}
      </div>
      <div className="ideal-actions">
        <button type="button" className="btn btn-primary" onClick={generate}>
          Generate Build
        </button>
        <button type="button" className="btn" onClick={() => onGenerate(new Set())}>
          Clear
        </button>
        <span className="ideal-hint">Highlights matching skills in the ranked list below.</span>
      </div>
    </section>
  );
}
