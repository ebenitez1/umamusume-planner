import type { AptitudeGrade, DistanceClass, Strategy, Surface } from '../../types';
import { useStore } from '../../store';
import {
  APTITUDE_GRADES,
  DISTANCE_CLASSES,
  DISTANCE_CLASS_ORDER,
  STRATEGIES,
  STRATEGY_ORDER,
  SURFACE_LABELS,
} from '../../data/races';

function gradeClass(grade: AptitudeGrade): string {
  if (grade === 'S' || grade === 'A') return 'grade-good';
  if (grade === 'B' || grade === 'C') return 'grade-avg';
  if (grade === 'G') return 'grade-terrible';
  return 'grade-bad';
}

interface GradePickerProps {
  label: string;
  grade: AptitudeGrade;
  onChange: (grade: AptitudeGrade) => void;
}

function GradePicker({ label, grade, onChange }: GradePickerProps) {
  return (
    <div className="apt-cell">
      <label className="field-label">{label}</label>
      <select
        className={`select ${gradeClass(grade)}`}
        value={grade}
        onChange={(e) => onChange(e.target.value as AptitudeGrade)}
        aria-label={`${label} aptitude grade`}
      >
        {APTITUDE_GRADES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Race Configuration: the target race (surface / distance class / strategy)
 * plus the uma's ten aptitude grades — all bound to raceSlice.
 */
export function RaceConfigPanel() {
  const race = useStore((s) => s.race);
  const aptitudes = useStore((s) => s.aptitudes);
  const setRaceField = useStore((s) => s.setRaceField);
  const setAptitude = useStore((s) => s.setAptitude);

  return (
    <section className="panel">
      <h2 className="panel-title">Race Configuration</h2>

      <div className="race-config-row">
        <div className="opt-control">
          <label className="field-label">Track</label>
          <select
            className="select"
            value={race.surface}
            onChange={(e) => setRaceField('surface', e.target.value as Surface)}
          >
            {(['turf', 'dirt'] as Surface[]).map((s) => (
              <option key={s} value={s}>
                {SURFACE_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="opt-control">
          <label className="field-label">Distance</label>
          <select
            className="select"
            value={race.distanceClass}
            onChange={(e) => setRaceField('distanceClass', e.target.value as DistanceClass)}
          >
            {DISTANCE_CLASS_ORDER.map((d) => (
              <option key={d} value={d}>
                {DISTANCE_CLASSES[d].label}
              </option>
            ))}
          </select>
        </div>
        <div className="opt-control">
          <label className="field-label">Strategy</label>
          <select
            className="select"
            value={race.strategy}
            onChange={(e) => setRaceField('strategy', e.target.value as Strategy)}
          >
            {STRATEGY_ORDER.map((s) => (
              <option key={s} value={s}>
                {STRATEGIES[s].label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="apt-section-label">Track Aptitude</div>
      <div className="apt-grid two">
        {(['turf', 'dirt'] as Surface[]).map((s) => (
          <GradePicker
            key={s}
            label={SURFACE_LABELS[s]}
            grade={aptitudes.track[s]}
            onChange={(g) => setAptitude('track', s, g)}
          />
        ))}
      </div>

      <div className="apt-section-label">Distance Aptitude</div>
      <div className="apt-grid">
        {DISTANCE_CLASS_ORDER.map((d) => (
          <GradePicker
            key={d}
            label={DISTANCE_CLASSES[d].label}
            grade={aptitudes.distance[d]}
            onChange={(g) => setAptitude('distance', d, g)}
          />
        ))}
      </div>

      <div className="apt-section-label">Strategy Aptitude</div>
      <div className="apt-grid">
        {STRATEGY_ORDER.map((s) => (
          <GradePicker
            key={s}
            label={STRATEGIES[s].label}
            grade={aptitudes.strategy[s]}
            onChange={(g) => setAptitude('strategy', s, g)}
          />
        ))}
      </div>
    </section>
  );
}
