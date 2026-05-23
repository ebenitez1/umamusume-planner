// Tick-by-tick physics for the race simulator.
// Pure functions — every step is a deterministic transform of state in/out.
// Formulas are documented in FORMULAS.md.

import {
  APTITUDE_MULT,
  BASE_ACCEL,
  DECEL_PER_PHASE,
  GUTS_DRAIN_CONSTANT,
  GUTS_DRAIN_NUM,
  HP_BASE_COEF,
  HP_DRAIN_DENOM,
  HP_DRAIN_NUM,
  HP_DRAIN_OFFSET,
  HP_STRAT_COEF,
  OVERTAKE_FLAG_TICKS,
  PHASE_BOUNDS,
  POST_START_GUTS_CONSTANT,
  POST_START_GUTS_SCALE,
  POST_START_MIN_VEL_FRAC,
  POWER_STAT_CONSTANT,
  SPEED_STAT_CONSTANT,
  SPEED_STAT_SCALE,
  START_DASH_ACCEL,
  START_DASH_VELOCITY_FRAC,
  STRAT_ACCEL_COEF,
  STRAT_VEL_COEF,
  TICK_S,
  type PhaseNum,
  type RaceSimState,
  type UmaSimState,
} from "./types";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

export function initialHp(uma: UmaSimState, distance: number): number {
  return Math.round(HP_BASE_COEF * HP_STRAT_COEF[uma.style] * uma.stats.stamina + distance);
}

export function postStartMinSpeed(uma: UmaSimState, baseSpeed: number): number {
  return POST_START_MIN_VEL_FRAC * baseSpeed
    + Math.sqrt(POST_START_GUTS_CONSTANT * uma.stats.guts) * POST_START_GUTS_SCALE;
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

// ---------------------------------------------------------------------------
// Target velocity
// ---------------------------------------------------------------------------

// Per-phase target velocity. Speed-stat contribution kicks in at phase 2.
export function targetVelocity(uma: UmaSimState, phase: PhaseNum, baseSpeed: number): number {
  // Phase 3 (spurt) — simplified: phase-2 target plus boost terms.
  // (Full spurt calculator is deferred — this is a reasonable approximation.)
  if (phase === 3) {
    const phase2 = baseSpeed * STRAT_VEL_COEF[uma.style][2];
    const speedContrib = speedStatContribution(uma);
    return phase2 + 0.01 * baseSpeed + 1.05 + speedContrib;
  }

  const stratMult = STRAT_VEL_COEF[uma.style][phase];
  let target = baseSpeed * stratMult;

  // Speed-stat contribution applies in phase 2+ only (and we apply to spurt above).
  if (phase >= 2) {
    target += speedStatContribution(uma);
  }
  return target;
}

function speedStatContribution(uma: UmaSimState): number {
  const apt =
    APTITUDE_MULT[uma.aptitudes.surface] *
    APTITUDE_MULT[uma.aptitudes.distance];
  return Math.sqrt(SPEED_STAT_CONSTANT * uma.stats.speed) * apt * SPEED_STAT_SCALE;
}

// ---------------------------------------------------------------------------
// Acceleration
// ---------------------------------------------------------------------------

export function baseAcceleration(uma: UmaSimState, phase: PhaseNum): number {
  const stratMult = STRAT_ACCEL_COEF[uma.style][Math.min(phase, 2) as 0 | 1 | 2];
  const aptMult =
    APTITUDE_MULT[uma.aptitudes.surface] *
    APTITUDE_MULT[uma.aptitudes.distance];
  return BASE_ACCEL * Math.sqrt(POWER_STAT_CONSTANT * uma.stats.power) * stratMult * aptMult;
}

// ---------------------------------------------------------------------------
// HP drain
// ---------------------------------------------------------------------------

export function hpDrainPerSec(uma: UmaSimState, velocity: number, baseSpeed: number, phase: PhaseNum): number {
  // 20 * (v - baseSpeed + 12)^2 / 144
  const overshoot = velocity - baseSpeed + HP_DRAIN_OFFSET;
  let drain = HP_DRAIN_NUM * overshoot * overshoot / HP_DRAIN_DENOM;
  // Guts modifier (phase 2+ only): 1 + 200/sqrt(600*guts)
  if (phase >= 2 && uma.stats.guts > 0) {
    drain *= 1 + GUTS_DRAIN_NUM / Math.sqrt(GUTS_DRAIN_CONSTANT * uma.stats.guts);
  }
  // statusMod / groundMod default to 1 for now (we don't model pacedown,
  // rushed, downhill, or non-Good ground in v2).
  return drain;
}

// ---------------------------------------------------------------------------
// Per-tick advancement
// ---------------------------------------------------------------------------

export function tickPhysics(state: RaceSimState): void {
  const dt = TICK_S;
  const baseSpeed = state.course.baseSpeed;

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

    // Compute target velocity (game's target, plus effect modifiers).
    let target = targetVelocity(uma, phase, baseSpeed);
    let accelBonus = 0;
    let currentSpeedBump = 0;
    for (const e of uma.activeEffects) {
      if (e.kind === "speed") target += e.value;
      else if (e.kind === "accel") accelBonus += e.value;
      else if (e.kind === "debuff") target += e.value;   // value typically negative
      else if (e.kind === "current_speed") currentSpeedBump += e.value;
    }

    // Stamina-out: target collapses to post-start minimum, accel becomes -1.2.
    let decel = DECEL_PER_PHASE[phase];
    if (uma.hp <= 0) {
      target = postStartMinSpeed(uma, baseSpeed);
      decel = -1.2;
    }

    // Compute acceleration.
    let accel = baseAcceleration(uma, phase) + accelBonus;
    // Start dash: +24 accel until velocity passes 0.85 * baseSpeed.
    if (uma.startDashActive) {
      if (uma.velocity > START_DASH_VELOCITY_FRAC * baseSpeed) {
        uma.startDashActive = false;
      } else {
        accel += START_DASH_ACCEL;
      }
    }

    // Move velocity toward target.
    if (uma.velocity < target) {
      uma.velocity = Math.min(target, uma.velocity + accel * dt);
    } else if (uma.velocity > target) {
      // Decel is in m/s/s, negative.
      uma.velocity = Math.max(target, uma.velocity + decel * dt);
    }

    // Apply current_speed effects as a one-shot bump to current velocity
    // (rare — most speed skills bump target, not current).
    if (currentSpeedBump !== 0) {
      uma.velocity += currentSpeedBump * dt;
    }

    // Drain HP.
    uma.hp -= hpDrainPerSec(uma, uma.velocity, baseSpeed, phase) * dt;

    // Heal effects (instantaneous-per-tick).
    for (const e of uma.activeEffects) {
      if (e.kind === "heal") {
        uma.hp = Math.min(uma.hpMax, uma.hp + e.value);
        e.remainingS = 0;   // heals are single-tick; mark for cleanup
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

  // Order tracking (only relevant when opponents exist; preserved for
  // future multi-uma mode and for the diagnostics fields).
  for (const u of state.umas) u.prevOrder = u.order;
  const sortable = [...state.umas].sort((a, b) => {
    if (a.finished && b.finished) return (a.finishTime ?? 0) - (b.finishTime ?? 0);
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.position - a.position;
  });
  for (let i = 0; i < sortable.length; i++) sortable[i].order = i + 1;
  for (const u of state.umas) {
    if (u.finished) continue;
    if (u.order < u.prevOrder) {
      u.overtakeTickRemaining = OVERTAKE_FLAG_TICKS;
      u.changeOrderCount += u.prevOrder - u.order;
    } else if (u.overtakeTickRemaining > 0) {
      u.overtakeTickRemaining--;
    }
  }

  state.tick++;
  state.timeS += dt;
  state.finished = state.umas.every((u) => u.finished);
}
