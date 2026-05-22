// Per-tick skill activation loop.
//
// For each uma each tick:
//   1. Build a Context dict mapping the condition vars to current values.
//   2. For each owned skill, evaluate its condition_groups[].precondition.
//   3. If precondition is newly-true and the skill isn't on cooldown,
//      activate: apply effect to uma state, set cooldown, log the event.
//
// Variables we currently model (covers the high-frequency conditions):
//   order, order_rate, phase, distance_rate, remain_distance,
//   is_finalcorner, is_last_straight, is_lastspurt,
//   running_style, distance_type, ground_type, course_distance, track_id,
//   base_speed, base_stamina, base_power, base_guts, base_wiz,
//   phase_random, phase_firsthalf_random, phase_laterhalf_random,
//   phase_firstquarter_random,
//
// Deferred (return 0 — will log as "unknown variable" once per name):
//   slope, corner, change_order_onetime, overtake_target_time, is_overtake,
//   blocked_side_continuetime, distance_diff_top, distance_diff_rate,
//   bashin_diff_behind, bashin_diff_infront, temptation_count, fan_count,
//   popularity, near_count, post_number — non-physics or lane mechanics.

import type { Skill } from "../../types";
import {
  evalString,
  type Context,
} from "./conditions";
import { currentPhase } from "./physics";
import {
  BASHIN_M,
  DEFAULT_COOLDOWN_S,
  DISTANCE_TYPE_NUM,
  GROUND_TYPE_NUM,
  STYLE_NUM,
  TICK_S,
  type ActiveEffect,
  type RaceSimState,
  type UmaSimState,
} from "./types";

// ---------------------------------------------------------------------------
// Random rolls — rolled once per (phase / corner / etc.) bucket, kept on
// uma.randomRolls so multiple condition checks against the same bucket
// see the same value. We assume up to 6 possible values per roll (matches
// what's seen in conditions like phase_random==N for N up to 6).
// ---------------------------------------------------------------------------
const RANDOM_MAX = 6;

function rollOrLookup(bucket: Record<number, number>, key: number): number {
  if (bucket[key] === undefined) {
    bucket[key] = 1 + Math.floor(Math.random() * RANDOM_MAX);
  }
  return bucket[key];
}

// Compute the Context dict for one uma at the current tick.
export function buildContext(uma: UmaSimState, state: RaceSimState): Context {
  const phase = currentPhase(uma.position, state.course.distance);
  const distRate = (uma.position / state.course.distance) * 100;       // 0..100
  const remain = state.course.distance - uma.position;
  const orderRate = (uma.order / state.umas.length) * 100;             // 1..100

  // Position-relative gaps (bashin lengths).
  const leader = state.umas.find((u) => u.order === 1) ?? uma;
  const infront = state.umas.find((u) => u.order === uma.order - 1);
  const behind = state.umas.find((u) => u.order === uma.order + 1);
  const bashinDiffTop = (leader.position - uma.position) / BASHIN_M;
  const bashinDiffInfront = infront ? (infront.position - uma.position) / BASHIN_M : 0;
  const bashinDiffBehind = behind ? (uma.position - behind.position) / BASHIN_M : 0;

  const ctx: Context = {
    order: uma.order,
    order_rate: orderRate,
    phase,
    distance_rate: distRate,
    remain_distance: remain,
    course_distance: state.course.distance,
    running_style: uma.styleNum,
    distance_type: DISTANCE_TYPE_NUM[state.meeting.distance],
    ground_type: GROUND_TYPE_NUM[state.course.surface],
    track_id: 0, // not modeled — track_id matters for course-specific skills;
                 // we'd need to map ChampionMeeting → game track IDs to fill.

    is_finalcorner:
      uma.position >= state.course.finalCornerStart &&
      uma.position < state.course.finalStraightStart
        ? 1 : 0,
    is_last_straight: uma.position >= state.course.finalStraightStart ? 1 : 0,
    is_lastspurt: phase === 3 ? 1 : 0,
    is_overtake: uma.overtakeTickRemaining > 0 ? 1 : 0,

    base_speed:   uma.stats.speed,
    base_stamina: uma.stats.stamina,
    base_power:   uma.stats.power,
    base_guts:    uma.stats.guts,
    base_wiz:     uma.stats.wit,

    // Random rolls — fixed once per bucket per uma per race.
    phase_random:               rollOrLookup(uma.randomRolls.phase, phase),
    phase_firsthalf_random:     distRate < 50 ? rollOrLookup(uma.randomRolls.phaseFirstHalf, phase) : 0,
    phase_laterhalf_random:     distRate >= 50 ? rollOrLookup(uma.randomRolls.phaseLaterHalf, phase) : 0,
    phase_firstquarter_random:  distRate < 25 ? rollOrLookup(uma.randomRolls.phaseFirstQuarter, phase) : 0,

    // Position deltas (bashin lengths).
    distance_diff_top: bashinDiffTop,
    bashin_diff_top: bashinDiffTop,
    bashin_diff_infront: bashinDiffInfront,
    bashin_diff_behind: bashinDiffBehind,
    distance_diff_rate:
      uma.order === 1
        ? 0
        : ((leader.position - uma.position) / state.course.distance) * 100,

    change_order_onetime: uma.changeOrderCount,

    // Still-deferred variables — return 0 explicitly so conditions like
    // `==0` still match. Console logs unknown vars once for visibility.
    corner: 0,
    slope: 0,
    overtake_target_time: 0,
    blocked_side_continuetime: 0,
  };
  return ctx;
}

// ---------------------------------------------------------------------------
// Activation
// ---------------------------------------------------------------------------

function applyEffect(uma: UmaSimState, skill: Skill, state: RaceSimState): void {
  const sim = skill.sim;
  if (!sim || !sim.effectKind || sim.effectValue === undefined) {
    // No sim metadata — just log activation, no state change.
    uma.activationLog.push({
      tick: state.tick,
      timeS: state.timeS,
      skillId: skill.id,
      skillName: skill.name,
    });
    return;
  }

  const duration = sim.durationS ?? (sim.effectKind === "heal" ? 0 : 5);
  if (sim.effectKind === "heal") {
    // Heals are instantaneous in the v1 model — apply to hp and don't queue.
    uma.hp = Math.min(uma.hpMax, uma.hp + sim.effectValue);
  } else {
    const eff: ActiveEffect = {
      source: skill.id,
      kind: sim.effectKind,
      value: sim.effectValue,
      remainingS: duration,
    };
    uma.activeEffects.push(eff);
  }

  uma.cooldowns.set(skill.id, DEFAULT_COOLDOWN_S);
  uma.activatedSkillIds.add(skill.id);
  uma.activationLog.push({
    tick: state.tick,
    timeS: state.timeS,
    skillId: skill.id,
    skillName: skill.name,
    effectKind: sim.effectKind,
    effectValue: sim.effectValue,
  });
}

export function tickSkills(state: RaceSimState): void {
  for (const uma of state.umas) {
    if (uma.finished) continue;
    const ctx = buildContext(uma, state);

    for (const skill of uma.skills) {
      const trigger = skill.sim?.trigger;
      // For player only: evaluate condition every tick so we can report
      // "skill could have fired N times but was on cooldown" diagnostics.
      // Opponents skip the diagnostic to keep the sim fast.
      const conditionTrue = trigger ? evalString(trigger, ctx) : true;
      if (uma.isPlayer) {
        const diag = uma.skillDiagnostics.get(skill.id) ?? {
          preconditionTrueTicks: 0,
          activations: 0,
        };
        if (conditionTrue) {
          diag.preconditionTrueTicks++;
          if (diag.firstTrueAtS === undefined) diag.firstTrueAtS = state.timeS;
        }
        uma.skillDiagnostics.set(skill.id, diag);
      }

      // Already on cooldown → can't fire even if condition is true.
      if (uma.cooldowns.has(skill.id)) continue;
      // Unique skills fire at most once per race.
      if (skill.rarity === "unique" && uma.activatedSkillIds.has(skill.id)) continue;

      // Passive skills (no trigger) fire once at race start.
      if (!trigger) {
        if (state.tick > 1) continue;
        applyEffect(uma, skill, state);
        if (uma.isPlayer) uma.skillDiagnostics.get(skill.id)!.activations++;
        continue;
      }

      if (conditionTrue) {
        applyEffect(uma, skill, state);
        if (uma.isPlayer) uma.skillDiagnostics.get(skill.id)!.activations++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Full tick (physics + skills)
// ---------------------------------------------------------------------------

// Skills evaluate FIRST (so they affect this tick's velocity), then physics
// advances using the new effects in play.
export function tick(state: RaceSimState, tickPhysicsFn: (s: RaceSimState) => void): void {
  tickSkills(state);
  tickPhysicsFn(state);
}

export const _internal = { TICK_S, STYLE_NUM };
