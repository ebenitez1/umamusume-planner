/**
 * Race Simulator tab (Agent 5) — Umalator-style Monte Carlo simulator.
 * Layout: inputs column | results column, with the build-comparison panel
 * spanning the full width underneath.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store';
import { SKILLS_BY_ID } from '../../data/skills';
import { DISTANCE_CLASSES, STRATEGIES, SURFACE_LABELS } from '../../data/races';
import { COMPETITION_LEVELS, simulate, type CompetitionLevel } from '../../utils/simulator';
import { SimulatorInputs } from './SimulatorInputs';
import { SimulationResults } from './SimulationResults';
import { ComparisonView } from './ComparisonView';
import type { SimulationOutcome, SkillEntry } from '../../types';
import './simulator.css';

// Module-scoped so it survives the component unmount/remount that happens
// when Ctrl+R switches to the simulator tab. Tracks the last simRunNonce we
// actually ran, so a run requested from another tab fires on mount, while a
// plain tab revisit (nonce unchanged) does not re-run.
let lastConsumedNonce = 0;

export function RaceSimulator() {
  const uma = useStore((s) => s.uma);
  const aptitudes = useStore((s) => s.aptitudes);
  const race = useStore((s) => s.race);
  const selectedSkillIds = useStore((s) => s.selectedSkillIds);
  const pushToast = useStore((s) => s.pushToast);
  const simRunNonce = useStore((s) => s.simRunNonce);

  const [competition, setCompetition] = useState<CompetitionLevel>('cm');
  const [excludedSkillIds, setExcludedSkillIds] = useState<ReadonlySet<number>>(new Set());
  const [outcome, setOutcome] = useState<SimulationOutcome | null>(null);
  const [runLabel, setRunLabel] = useState<string | null>(null);

  const includedSkills = useMemo(
    () =>
      selectedSkillIds
        .filter((id) => !excludedSkillIds.has(id))
        .map((id) => SKILLS_BY_ID.get(id))
        .filter((s): s is SkillEntry => s !== undefined),
    [selectedSkillIds, excludedSkillIds],
  );

  const toggleSkill = useCallback((id: number) => {
    setExcludedSkillIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleRun = useCallback(() => {
    const result = simulate({
      uma,
      aptitudes,
      race,
      skills: includedSkills,
      competitionLevel: competition,
    });
    const compLabel = COMPETITION_LEVELS.find((l) => l.id === competition)?.label ?? competition;
    const dc = DISTANCE_CLASSES[race.distanceClass];
    setOutcome(result);
    setRunLabel(
      `${SURFACE_LABELS[race.surface]} · ${dc.label} (${dc.typicalMeters}m) · ` +
        `${STRATEGIES[race.strategy].label} · Field ${race.fieldSize} · ${compLabel} field`,
    );
    pushToast('Simulation complete — 1000 runs', 'success');
  }, [uma, aptitudes, race, includedSkills, competition, pushToast]);

  // Global Ctrl+R (via uiSlice.simRunNonce) triggers a run — including the run
  // that requested the tab switch which mounts this component. Compare against
  // the module-scoped last-consumed value so a plain tab revisit never re-runs.
  useEffect(() => {
    if (simRunNonce !== 0 && simRunNonce !== lastConsumedNonce) {
      lastConsumedNonce = simRunNonce;
      handleRun();
    }
  }, [simRunNonce, handleRun]);

  return (
    <div className="sim-page">
      <SimulatorInputs
        competition={competition}
        onCompetitionChange={setCompetition}
        excludedSkillIds={excludedSkillIds}
        onToggleSkill={toggleSkill}
        onRun={handleRun}
      />
      <SimulationResults outcome={outcome} runLabel={runLabel} />
      <ComparisonView competition={competition} currentSkills={includedSkills} />
    </div>
  );
}
