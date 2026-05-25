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

// Determine which corner (1-indexed) the uma is in, or 0 on a straight.
// Uses real course geometry when available; otherwise falls back to a
// heuristic 3-corner model matching what RaceTrack draws.
function cornerAt(position: number, course: RaceSimState["course"]): number {
  if (course.corners.length > 0) {
    for (let i = 0; i < course.corners.length; i++) {
      const c = course.corners[i];
      if (position >= c.start && position < c.start + c.length) return i + 1;
    }
    return 0;
  }
  // Fallback (no kachi geometry for this race).
  if (position >= course.finalCornerStart && position < course.finalStraightStart) return 3;
  const frac = position / course.distance;
  if (frac >= 0.10 && frac < 0.22) return 1;
  if (frac >= 0.38 && frac < 0.50) return 2;
  return 0;
}

// Return slope value at the given position. Positive = uphill, negative =
// downhill, 0 = flat. Maps the slope's `slope` field to a small integer
// magnitude (the game's slope condition uses ±1/±2 typically).
function slopeAt(position: number, course: RaceSimState["course"]): number {
  for (const s of course.slopes) {
    if (position >= s.start && position < s.start + s.length) {
      // Slope field is in raw 1/100000 units; sign is what matters most
      // for condition checks. Bucket to {-2, -1, 1, 2}.
      const mag = Math.abs(s.slope) > 8000 ? 2 : 1;
      return s.slope > 0 ? mag : -mag;
    }
  }
  return 0;
}

// Course rotation per venue. The skill 'Right-Handed ◯' has condition
// rotation==1 — so 1 = right-handed (CW), 2 = left-handed (CCW).
//   Right (1): Nakayama, Kyoto, Hanshin, Sapporo, Hakodate, Fukushima, Kokura
//   Left  (2): Tokyo, Niigata, Chukyo, Longchamp
const LEFT_HANDED_VENUES = new Set(["Tokyo", "Niigata", "Chukyo", "Longchamp"]);
function rotationFor(trackName: string): number {
  return LEFT_HANDED_VENUES.has(trackName) ? 2 : 1;
}

// Bounds (0..1 fractions of total distance) of the four phases.
// Matches PHASE_BOUNDS in types.ts.
const PHASE_BOUNDS_RACE = [0, 1 / 6, 2 / 3, 5 / 6, 1] as const;

// Compute the Context dict for one uma at the current tick.
export function buildContext(uma: UmaSimState, state: RaceSimState): Context {
  const phase = currentPhase(uma.position, state.course.distance);
  const distRate = (uma.position / state.course.distance) * 100;       // 0..100
  const remain = state.course.distance - uma.position;
  const corner = cornerAt(uma.position, state.course);
  const onStraight = corner === 0;
  const slope = slopeAt(uma.position, state.course);

  // Position within current phase (0..1) — used for phase_*half_random.
  // Previously these were keyed on race-relative position which meant
  // phase_firsthalf_random was always 0 during the last spurt (a bug).
  const phaseStartFrac = PHASE_BOUNDS_RACE[phase];
  const phaseEndFrac = PHASE_BOUNDS_RACE[phase + 1];
  const phaseLen = phaseEndFrac - phaseStartFrac;
  const inPhaseFrac = phaseLen > 0
    ? ((uma.position / state.course.distance) - phaseStartFrac) / phaseLen
    : 0;
  const inFirstHalfOfPhase = inPhaseFrac < 0.5;
  const inFirstQuarterOfPhase = inPhaseFrac < 0.25;
  const inLaterHalfOfPhase = inPhaseFrac >= 0.5;

  // Final corner sub-positioning — for is_finalcorner_laterhalf.
  const inFinalCorner =
    uma.position >= state.course.finalCornerStart &&
    uma.position < state.course.finalStraightStart;
  const finalCornerMid =
    (state.course.finalCornerStart + state.course.finalStraightStart) / 2;
  const inFinalCornerLaterHalf =
    inFinalCorner && uma.position >= finalCornerMid;
  // Note: orderRate is intentionally unused in single-uma mode; the
  // context below forces order_rate = 1 (favorable) per FORMULAS.md.

  // Position-relative gaps (bashin lengths). Empty when no opponents.
  let bashinDiffTop = 0;
  let bashinDiffInfront = 0;
  let bashinDiffBehind = 0;
  if (state.umas.length > 1) {
    const leader = state.umas.find((u) => u.order === 1) ?? uma;
    const infront = state.umas.find((u) => u.order === uma.order - 1);
    const behind = state.umas.find((u) => u.order === uma.order + 1);
    bashinDiffTop = (leader.position - uma.position) / BASHIN_M;
    bashinDiffInfront = infront ? (infront.position - uma.position) / BASHIN_M : 0;
    bashinDiffBehind = behind ? (uma.position - behind.position) / BASHIN_M : 0;
  }

  const ctx: Context = {
    // Use real order when there are opponents; favor "leading" otherwise.
    order: uma.order,
    order_rate: state.umas.length > 1 ? (uma.order / state.umas.length) * 100 : 1,
    phase,
    distance_rate: distRate,
    remain_distance: remain,
    course_distance: state.course.distance,
    running_style: uma.styleNum,
    distance_type: DISTANCE_TYPE_NUM[state.meeting.distance],
    ground_type: GROUND_TYPE_NUM[state.course.surface],
    track_id: 0, // not modeled — track_id matters for course-specific skills;
                 // we'd need to map ChampionMeeting → game track IDs to fill.

    is_finalcorner: inFinalCorner ? 1 : 0,
    is_finalcorner_laterhalf: inFinalCornerLaterHalf ? 1 : 0,
    is_last_straight: uma.position >= state.course.finalStraightStart ? 1 : 0,
    is_lastspurt: phase === 3 ? 1 : 0,
    // Real overtake tracking when opponents exist; favor "always overtaking"
    // in single-uma mode so position-gated skills aren't silently blocked.
    is_overtake: state.umas.length > 1 ? (uma.overtakeTickRemaining > 0 ? 1 : 0) : 1,

    // Trivial helpers some skills use.
    always: 1,
    rotation: rotationFor(state.meeting.track),

    base_speed:   uma.stats.speed,
    base_stamina: uma.stats.stamina,
    base_power:   uma.stats.power,
    base_guts:    uma.stats.guts,
    base_wiz:     uma.stats.wit,

    // Random rolls — fixed once per (phase × bucket) per uma per race.
    // phase_*half_random uses position within the CURRENT PHASE (not the
    // race), so e.g. phase_firsthalf_random fires in the first half of
    // last spurt for skills like Homestretch Haste.
    phase_random:               rollOrLookup(uma.randomRolls.phase, phase),
    phase_firsthalf_random:     inFirstHalfOfPhase    ? rollOrLookup(uma.randomRolls.phaseFirstHalf,    phase) : 0,
    phase_laterhalf_random:     inLaterHalfOfPhase    ? rollOrLookup(uma.randomRolls.phaseLaterHalf,    phase) : 0,
    phase_firstquarter_random:  inFirstQuarterOfPhase ? rollOrLookup(uma.randomRolls.phaseFirstQuarter, phase) : 0,
    all_corner_random:          uma.randomRolls.allCorner,
    straight_random:            uma.randomRolls.straight,
    corner_random:              corner > 0 ? rollOrLookup(uma.randomRolls.corner, corner) : 0,
    phase_corner_random:        corner > 0 ? rollOrLookup(uma.randomRolls.corner, phase * 10 + corner) : 0,
    is_finalcorner_random:      corner === 3 ? uma.randomRolls.allCorner : 0,

    // Position deltas (bashin lengths).
    distance_diff_top: bashinDiffTop,
    bashin_diff_top: bashinDiffTop,
    bashin_diff_infront: bashinDiffInfront,
    bashin_diff_behind: bashinDiffBehind,
    distance_diff_rate: 0,

    change_order_onetime: uma.changeOrderCount,

    // Course state.
    corner,
    on_straight: onStraight ? 1 : 0,
    slope,

    // Still-deferred variables.
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
    // No sim metadata — treat as a passive: log it once, then lock the
    // skill out for the rest of the race so it doesn't loop. (Was a bug:
    // "Pace Chaser Savvy" fired 1163× because we returned without
    // setting cooldown.)
    uma.activationLog.push({
      tick: state.tick,
      timeS: state.timeS,
      positionM: uma.position,
      skillId: skill.id,
      skillName: skill.name,
    });
    uma.cooldowns.set(skill.id, 99999);   // effectively infinite
    uma.activatedSkillIds.add(skill.id);
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
    positionM: uma.position,
    skillId: skill.id,
    skillName: skill.name,
    effectKind: sim.effectKind,
    effectValue: sim.effectValue,
  });
}

// Per-activation Wit-roll probability — formula from KuromiAK's mechanics doc
// as implemented in kachi-dev/uma-tools/uma-skill-tools/RaceSolver.ts line 967:
//   P(activate) = max(100 - 9000/wit, 20) / 100
// Floor at 20% even with very low Wit. At wit=400 P≈78%, wit=800 P≈89%,
// wit=1200 P≈93%. Passives (no trigger) skip the roll — they always apply.
function witActivationProb(wit: number): number {
  if (wit <= 0) return 0.20;
  return Math.max(100 - 9000 / wit, 20) / 100;
}

// UmaTools tag → our phase name. Skills tagged `l_2` (final leg) etc.
// should only check their conditions when the uma is in that phase —
// otherwise `phase_firsthalf_random==2` etc. can match during the wrong
// phase and fire the skill way too early.
const PHASE_NAMES = ["opening", "middle", "final", "spurt"] as const;

export function tickSkills(state: RaceSimState): void {
  for (const uma of state.umas) {
    if (uma.finished) continue;
    const ctx = buildContext(uma, state);
    const currentPhaseName = PHASE_NAMES[
      currentPhase(uma.position, state.course.distance)
    ];

    for (const skill of uma.skills) {
      const trigger = skill.sim?.trigger;

      // Phase gate from the skill's `type` tags (l_0..l_3 mapped to
      // opening/middle/final/spurt during transform). If the skill is
      // tagged for specific phases, don't check it outside them.
      if (skill.tags?.phase?.length) {
        if (!skill.tags.phase.includes(currentPhaseName)) continue;
      }

      // Terrain gate (cor/str/slo). If the skill is tagged for corners,
      // it only checks conditions when the uma is actually in a corner;
      // same for straights and slopes.
      if (skill.tags?.terrain?.length) {
        const t = skill.tags.terrain;
        const inCorner = ctx.corner !== 0;
        const inSlope = (ctx.slope ?? 0) !== 0;
        const isOnStraight = !inCorner;
        const ok =
          (t.includes("corner") && inCorner) ||
          (t.includes("straight") && isOnStraight) ||
          (t.includes("slope") && inSlope);
        if (!ok) continue;
      }
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

      // In real Umamusume, nearly every skill activates AT MOST ONCE
      // per race (the cooldown system is only used by a small handful
      // of special skills). Default to fire-once for all rarities.
      if (uma.activatedSkillIds.has(skill.id)) continue;
      // Cooldown still tracked for future use (some passives use it
      // as an infinite lock — see applyEffect).
      if (uma.cooldowns.has(skill.id)) continue;

      // Passive skills (no trigger) fire once at race start. No Wit roll.
      if (!trigger) {
        if (state.tick > 1) continue;
        applyEffect(uma, skill, state);
        if (uma.isPlayer) uma.skillDiagnostics.get(skill.id)!.activations++;
        continue;
      }

      if (!conditionTrue) continue;

      // Wit roll: even with conditions met, the skill has a per-tick
      // probability of actually activating, scaling with Wit. If it
      // fails, the skill stays eligible and rolls again next tick (so
      // long as conditions remain true).
      if (Math.random() > witActivationProb(uma.stats.wit)) continue;

      applyEffect(uma, skill, state);
      if (uma.isPlayer) uma.skillDiagnostics.get(skill.id)!.activations++;
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
