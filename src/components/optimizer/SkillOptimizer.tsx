import { useEffect, useState } from 'react';
import type { SkillEntry } from '../../types';
import { useStore } from '../../store';
import { SKILLS_BY_ID } from '../../data/skills';
import { runOptimizer, OPTIMIZE_TARGET_LABELS, type OptimizeTarget } from '../../utils/optimizer';
import { RaceConfigPanel } from './RaceConfigPanel';
import { SkillScoringWeights } from './SkillScoringWeights';
import { IdealSkillBuilder } from './IdealSkillBuilder';
import { SkillsToBuyPanel } from './SkillsToBuyPanel';
import { BuildSummary } from './BuildSummary';
import { SkillEntryTools } from './SkillEntryTools';
import './optimizer.css';

const OPTIMIZE_TARGETS: OptimizeTarget[] = ['rating', 'teamTrials', 'aptitudeTest'];

const RUN_DEBOUNCE_MS = 200;

/**
 * Skill Optimizer page (main column of the optimizer tab). Composes all
 * optimizer panels and re-runs the optimizer (debounced) whenever any
 * relevant input changes, publishing the result via setOptimizerResult so
 * the Rating panel can consume it.
 */
export function SkillOptimizer() {
  // Narrow store selections (Zustand v5 — never select fresh object literals).
  const spBudget = useStore((s) => s.spBudget);
  const fastLearner = useStore((s) => s.fastLearner);
  const officialOnly = useStore((s) => s.officialOnly);
  const weights = useStore((s) => s.weights);
  const selectedSkillIds = useStore((s) => s.selectedSkillIds);
  const costOverrides = useStore((s) => s.costOverrides);
  const race = useStore((s) => s.race);
  const aptitudes = useStore((s) => s.aptitudes);
  const setSpBudget = useStore((s) => s.setSpBudget);
  const setFastLearner = useStore((s) => s.setFastLearner);
  const setOfficialOnly = useStore((s) => s.setOfficialOnly);
  const setOptimizerResult = useStore((s) => s.setOptimizerResult);

  /** Optimize-for target (local UI state; not part of the store contract). */
  const [optimizeFor, setOptimizeFor] = useState<OptimizeTarget>('teamTrials');
  /** Skill ids highlighted by the Ideal Skill Builder. */
  const [highlightedIds, setHighlightedIds] = useState<ReadonlySet<number>>(new Set());

  // Reactive optimizer run, debounced.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const pool = selectedSkillIds
        .map((id) => SKILLS_BY_ID.get(id))
        .filter((s): s is SkillEntry => s !== undefined);
      setOptimizerResult(
        runOptimizer({
          skills: pool,
          aptitudes,
          race,
          spBudget,
          fastLearner,
          officialOnly,
          weights,
          costOverrides,
          optimizeFor,
        }),
      );
    }, RUN_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [
    selectedSkillIds,
    aptitudes,
    race,
    spBudget,
    fastLearner,
    officialOnly,
    weights,
    costOverrides,
    optimizeFor,
    setOptimizerResult,
  ]);

  return (
    <div className="skill-optimizer">
      <section className="panel">
        <h2 className="panel-title">Skill Optimizer</h2>
        <div className="opt-controls">
          <div className="opt-control">
            <label className="field-label" htmlFor="sp-budget">
              SP Budget
            </label>
            <input
              id="sp-budget"
              type="number"
              className="input"
              min={0}
              max={9999}
              step={10}
              value={spBudget}
              onChange={(e) => {
                const v = Number(e.target.value);
                setSpBudget(Number.isFinite(v) ? Math.max(0, Math.floor(v)) : 0);
              }}
            />
          </div>
          <div className="opt-control">
            <label className="field-label" htmlFor="optimize-for">
              Optimize For
            </label>
            <select
              id="optimize-for"
              className="select"
              value={optimizeFor}
              onChange={(e) => setOptimizeFor(e.target.value as OptimizeTarget)}
            >
              {OPTIMIZE_TARGETS.map((t) => (
                <option key={t} value={t}>
                  {OPTIMIZE_TARGET_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <label className="opt-toggle" title="Fast Learner: all skills cost 10% less SP">
            <input
              type="checkbox"
              checked={fastLearner}
              onChange={(e) => setFastLearner(e.target.checked)}
            />
            Fast Learner (−10% cost)
          </label>
          <label
            className="opt-toggle"
            title="Only consider skills released in the Global (EN) client"
          >
            <input
              type="checkbox"
              checked={officialOnly}
              onChange={(e) => setOfficialOnly(e.target.checked)}
            />
            Official EN Skills Only
          </label>
        </div>
      </section>

      <div className="opt-config-grid">
        <div className="opt-config-col">
          <RaceConfigPanel />
        </div>
        <div className="opt-config-col">
          <SkillScoringWeights />
          <IdealSkillBuilder onGenerate={setHighlightedIds} />
        </div>
      </div>

      <SkillEntryTools />

      <SkillsToBuyPanel highlightedIds={highlightedIds} />

      <BuildSummary />
    </div>
  );
}
