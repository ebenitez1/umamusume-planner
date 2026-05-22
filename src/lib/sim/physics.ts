// Tick-by-tick physics for the race simulator.
// Pure functions — every step is a deterministic transform of state in/out.
// Skill effects are layered on top by sim/skills.ts.

import type { Style } from "../../types";
import {
  ACCEL_BASE,
  ACCEL_PER_POWER,
  APTITUDE_MULT,
  BASE_VELOCITY_SCALE,
  DIST_HP,
  HP_DRAIN_AGGRESSION,
  HP_DRAIN_BASE,
  HP_DRAIN_WIT_REDUCTION,
  PHASE_BOUNDS,
  PHASE_VEL_FRAC,
  type PhaseNum,
  STAMINA_HP,
  STAMINA_OUT_VEL_FRAC,
  TICK_S,
  type RaceSimState,
  type UmaSimState,
} from "./types";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function initialHp(uma: UmaSimState, distance: number): number {
  return Math.round(uma.stats.stamina * STAMINA_HP + distance * DIST_HP);
}

// "Base velocity" = top sustainable speed without overshoot. Function of
// Speed stat + aptitudes for surface/distance/style.
export function baseVelocity(uma: UmaSimState): number {
  const aptM =
    APTITUDE_MULT[uma.aptitudes.surface] *
    APTITUDE_MULT[uma.aptitudes.distance] *
    APTITUDE_MULT[uma.aptitudes.style];
  // Rein in extremes — triple-S shouldn't be 1.33× a triple-B uma.
  const tempered = Math.pow(aptM, 0.7);
  return uma.stats.speed * BASE_VELOCITY_SCALE * tempered;
}

// ---------------------------------------------------------------------------
// Phase
// ---------------------------------------------------------------------------

export function currentPhase(position: number, distance: number): PhaseNum {
  const frac = position / distance;
  if (frac >= PHASE_BOUNDS[3]) return 3;
  if (frac >= PHASE_BOUNDS[2]) return 2;
  if (frac >= PHASE_BOUNDS[1]) return 1;
  return 0;
}

// Target velocity = base × phase modifier × style modifier
export function targetVelocity(uma: UmaSimState, phase: PhaseNum, style: Style): number {
  const base = baseVelocity(uma);
  return base * PHASE_VEL_FRAC[phase][style];
}

// ---------------------------------------------------------------------------
// Per-tick advancement
// ---------------------------------------------------------------------------

export function tickPhysics(state: RaceSimState): void {
  const dt = TICK_S;
  for (const uma of state.umas) {
    if (uma.finished) continue;
    const phase = currentPhase(uma.position, state.course.distance);

    // Tick down active effects + cooldowns.
    for (const eff of uma.activeEffects) eff.remainingS -= dt;
    uma.activeEffects = uma.activeEffects.filter((e) => e.remainingS > 0);
    for (const [k, v] of uma.cooldowns) {
      const next = v - dt;
      if (next <= 0) uma.cooldowns.delete(k);
      else uma.cooldowns.set(k, next);
    }

    // Compute target velocity. Active "speed" effects bump the target;
    // accel effects bump the rate of change; debuffs reduce.
    let target = targetVelocity(uma, phase, uma.style);
    let accelBonus = 0;
    for (const e of uma.activeEffects) {
      if (e.kind === "speed") target += e.value;
      else if (e.kind === "accel") accelBonus += e.value;
      else if (e.kind === "debuff") target += e.value; // value typically negative
    }

    // HP-out penalty: cap effective velocity at a fraction of base.
    if (uma.hp <= 0) {
      const cap = baseVelocity(uma) * STAMINA_OUT_VEL_FRAC;
      if (target > cap) target = cap;
    }

    // Move velocity toward target.
    const accel = (ACCEL_BASE + uma.stats.power * ACCEL_PER_POWER + accelBonus) * dt;
    if (uma.velocity < target) {
      uma.velocity = Math.min(target, uma.velocity + accel);
    } else if (uma.velocity > target) {
      uma.velocity = Math.max(target, uma.velocity - accel);
    }

    // Drain HP based on velocity vs base. Aggressive (above base) costs more.
    const base = baseVelocity(uma);
    const overshoot = Math.max(0, (uma.velocity - base) / base);
    const witReduction = uma.stats.wit * HP_DRAIN_WIT_REDUCTION;
    const drainPerSec =
      HP_DRAIN_BASE * (1 - witReduction) * (1 + overshoot * HP_DRAIN_AGGRESSION);
    uma.hp -= drainPerSec * dt;

    // Recover from heal effects (apply once per tick).
    for (const e of uma.activeEffects) {
      if (e.kind === "heal") {
        uma.hp += e.value * dt;
        if (uma.hp > uma.hpMax) uma.hp = uma.hpMax;
      }
    }

    // Advance position. Check finish.
    uma.position += uma.velocity * dt;
    if (uma.position >= state.course.distance) {
      uma.position = state.course.distance;
      uma.finished = true;
      uma.finishTime = state.timeS + dt;
    }
  }

  // Recompute order — 1 = furthest along, sorted by position desc.
  // Finished umas keep their order based on finish time.
  const sortable = [...state.umas].sort((a, b) => {
    if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.position - a.position;
  });
  for (let i = 0; i < sortable.length; i++) sortable[i].order = i + 1;

  state.tick++;
  state.timeS += dt;
  state.finished = state.umas.every((u) => u.finished);
}
