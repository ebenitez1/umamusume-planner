/**
 * Race + field configuration for the simulator.
 * Stats are read from the shared umaSlice (edited in the header strip) and
 * shown read-only with a sync indicator; race fields write to raceSlice.
 */
import { Play } from 'lucide-react';
import { useStore } from '../../store';
import { SKILLS_BY_ID } from '../../data/skills';
import {
  DISTANCE_CLASSES,
  DISTANCE_CLASS_ORDER,
  FIELD_SIZE_MAX,
  FIELD_SIZE_MIN,
  STRATEGIES,
  STRATEGY_ORDER,
  SURFACE_LABELS,
} from '../../data/races';
import { COMPETITION_LEVELS, type CompetitionLevel } from '../../utils/simulator';
import type { DistanceClass, SkillEntry, StatKey, Strategy, Surface } from '../../types';

const STAT_KEYS: StatKey[] = ['speed', 'stamina', 'power', 'guts', 'wisdom'];
const STAT_LABELS: Record<StatKey, string> = {
  speed: 'Speed',
  stamina: 'Stamina',
  power: 'Power',
  guts: 'Guts',
  wisdom: 'Wit',
};

export interface SimulatorInputsProps {
  competition: CompetitionLevel;
  onCompetitionChange: (level: CompetitionLevel) => void;
  /** Skill ids the user unchecked (excluded from the run). */
  excludedSkillIds: ReadonlySet<number>;
  onToggleSkill: (id: number) => void;
  onRun: () => void;
}

export function SimulatorInputs({
  competition,
  onCompetitionChange,
  excludedSkillIds,
  onToggleSkill,
  onRun,
}: SimulatorInputsProps) {
  const stats = useStore((s) => s.uma.stats);
  const race = useStore((s) => s.race);
  const setRaceField = useStore((s) => s.setRaceField);
  const selectedSkillIds = useStore((s) => s.selectedSkillIds);

  const selectedSkills = selectedSkillIds
    .map((id) => SKILLS_BY_ID.get(id))
    .filter((s): s is SkillEntry => s !== undefined);

  const compHint = COMPETITION_LEVELS.find((l) => l.id === competition)?.hint ?? '';

  return (
    <section className="panel sim-inputs">
      <h2 className="panel-title">Simulation Setup</h2>

      <div className="sim-section">
        <div className="sim-section-head">
          <span className="field-label">Uma Stats</span>
          <span className="sync-indicator">Synced from header</span>
        </div>
        <div className="sim-stats-row">
          {STAT_KEYS.map((key) => (
            <div key={key} className="sim-stat-box">
              <span className="sim-stat-label">{STAT_LABELS[key]}</span>
              <span className="sim-stat-value">{stats[key]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sim-section">
        <span className="field-label">Race</span>
        <div className="sim-field-grid">
          <label className="sim-field">
            <span className="field-label">Surface</span>
            <select
              className="select"
              value={race.surface}
              onChange={(e) => setRaceField('surface', e.target.value as Surface)}
            >
              {(Object.keys(SURFACE_LABELS) as Surface[]).map((s) => (
                <option key={s} value={s}>
                  {SURFACE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="sim-field">
            <span className="field-label">Distance</span>
            <select
              className="select"
              value={race.distanceClass}
              onChange={(e) => setRaceField('distanceClass', e.target.value as DistanceClass)}
            >
              {DISTANCE_CLASS_ORDER.map((dc) => (
                <option key={dc} value={dc}>
                  {DISTANCE_CLASSES[dc].label} ({DISTANCE_CLASSES[dc].typicalMeters}m)
                </option>
              ))}
            </select>
          </label>
          <label className="sim-field">
            <span className="field-label">Strategy</span>
            <select
              className="select"
              value={race.strategy}
              onChange={(e) => setRaceField('strategy', e.target.value as Strategy)}
            >
              {STRATEGY_ORDER.map((st) => (
                <option key={st} value={st}>
                  {STRATEGIES[st].label}
                </option>
              ))}
            </select>
          </label>
          <label className="sim-field">
            <span className="field-label">Field Size</span>
            <input
              className="input"
              type="number"
              min={FIELD_SIZE_MIN}
              max={FIELD_SIZE_MAX}
              value={race.fieldSize}
              onChange={(e) => {
                const raw = Number(e.target.value);
                if (Number.isFinite(raw)) {
                  setRaceField(
                    'fieldSize',
                    Math.max(FIELD_SIZE_MIN, Math.min(FIELD_SIZE_MAX, Math.round(raw))),
                  );
                }
              }}
            />
          </label>
        </div>
      </div>

      <div className="sim-section">
        <span className="field-label">Competition Level</span>
        <div className="sim-seg" role="group" aria-label="Competition level">
          {COMPETITION_LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={l.id === competition ? 'active' : ''}
              onClick={() => onCompetitionChange(l.id)}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="sim-hint">{compHint}</p>
      </div>

      <div className="sim-section">
        <span className="field-label">Skills ({selectedSkills.length - excludedSkillIds.size} of {selectedSkills.length} included)</span>
        {selectedSkills.length === 0 ? (
          <p className="sim-hint">
            No skills selected — add skills in the Optimizer tab and they will appear here.
          </p>
        ) : (
          <ul className="sim-skill-list">
            {selectedSkills.map((skill) => (
              <li key={skill.id} className="sim-skill-row">
                <label>
                  <input
                    type="checkbox"
                    checked={!excludedSkillIds.has(skill.id)}
                    onChange={() => onToggleSkill(skill.id)}
                  />
                  <span className={`skill-dot ${skill.color}`} aria-hidden="true" />
                  <span className="sim-skill-name">{skill.name}</span>
                  <span className="sim-skill-sv">SV {skill.sv}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button type="button" className="btn btn-primary sim-run-btn" onClick={onRun}>
        <Play size={14} />
        Run Simulation (1000×)
      </button>
    </section>
  );
}
