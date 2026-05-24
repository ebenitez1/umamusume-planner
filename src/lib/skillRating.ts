// Per-skill "expected distance gain" rating, context-aware.
//
// Goal: given a skill and the current build context (uma stats, style,
// meeting), estimate how many bashin lengths the skill is worth in this
// specific race. Inspired by umalator-global's distance-gain display.
//
// Math (analytical, not a sim):
//   - Speed skills:    gain_m ≈ Δv × duration × activation_prob × ctx_mult
//   - Accel skills:    treat the accel*duration "kick" as an equivalent
//                      Δv applied for half the duration (approximation)
//   - Heal skills:     1 hp ≈ 0.05 m of sustained late-race pace
//                      (covers ~0.5 m/s × 0.1 s); modest baseline credit
//   - Debuff skills:   half-credit since they slow opponents not you
//   - Passive skills:  small flat baseline (always on, but small effect)
//
// Activation probability heuristic:
//   - No condition → 1.0
//   - Single random gate (phase_random==N etc.) → ~0.20
//   - Double random gate → ~0.06 (rare skills with stacked rolls)
//   - Order/overtake gates → ~0.6 (typical for non-frontrunners)
//   - Phase-only gate (phase==2) → 1.0 (always hit eventually)
//
// Context multiplier:
//   - Distance / surface / style locked AGAINST → 0 (skill never fires)
//   - Distance / surface / style locked FOR the race → 1.2x
//   - Otherwise → 1.0
//
// All multipliers compose. Returns gain in bashin (1 bashin ≈ 2.5 m).

import type { ChampionMeeting, Skill, Style } from "../types";

const BASHIN_M = 2.5;

export interface SkillRatingContext {
  meeting: ChampionMeeting;
  style: Style;
}

export interface SkillRating {
  gainBashin: number;             // expected distance gain in bashin
  gainMeters: number;             // same, in meters
  activationProb: number;         // estimated 0..1 probability the skill fires
  contextMult: number;            // 0..1.5 from tags
  notes: string[];                // explanation tokens for the UI
  blocked: boolean;               // true when the skill is impossible (locked out)
}

// ---------------------------------------------------------------------------
// Activation probability — peek at the condition string for random gates.
// ---------------------------------------------------------------------------

function estimateActivationProb(skill: Skill): { prob: number; notes: string[] } {
  const notes: string[] = [];
  const trigger = skill.sim?.trigger ?? "";
  if (!trigger) {
    notes.push("Always-on (passive)");
    return { prob: 1.0, notes };
  }

  const randomGates =
    (trigger.match(/_random==/g) ?? []).length;
  const orderGates =
    (trigger.match(/\border\b\s*[=<>]/g) ?? []).length +
    (trigger.match(/order_rate/g) ?? []).length;
  const overtakeGate = /is_overtake==1/.test(trigger);
  const phaseOnly =
    /phase[=<>]/.test(trigger) && !randomGates && !orderGates && !overtakeGate;

  let prob = 1.0;

  if (randomGates >= 2) {
    prob *= 0.06;
    notes.push("Double random gate (~6%)");
  } else if (randomGates === 1) {
    prob *= 0.20;
    notes.push("Random gate (~20%)");
  }

  if (orderGates > 0) {
    prob *= 0.6;
    notes.push("Position gate (~60%)");
  }
  if (overtakeGate) {
    prob *= 0.7;
    notes.push("Overtake gate (~70%)");
  }
  if (phaseOnly) {
    notes.push("Phase-gated (deterministic)");
  }
  return { prob, notes };
}

// ---------------------------------------------------------------------------
// Context multiplier — tags vs the chosen race.
// ---------------------------------------------------------------------------

function contextMultiplier(skill: Skill, ctx: SkillRatingContext): {
  mult: number;
  notes: string[];
  blocked: boolean;
} {
  const notes: string[] = [];
  const tags = skill.tags ?? {};
  const m = ctx.meeting;

  // Hard locks → 0.
  if (tags.distances?.length && !tags.distances.includes(m.distance)) {
    notes.push(`Locked to ${tags.distances.join("/")} — won't fire at ${m.distance}`);
    return { mult: 0, notes, blocked: true };
  }
  if (tags.surfaces?.length && !tags.surfaces.includes(m.surface)) {
    notes.push(`Locked to ${tags.surfaces.join("/")} — won't fire on ${m.surface}`);
    return { mult: 0, notes, blocked: true };
  }
  if (tags.styles?.length && !tags.styles.includes(ctx.style)) {
    notes.push(`Locked to ${tags.styles.join("/")} — won't fire for ${ctx.style}`);
    return { mult: 0, notes, blocked: true };
  }

  // Positive matches → 1.2x (matches the race's profile).
  let mult = 1.0;
  if (tags.distances?.includes(m.distance)) { mult *= 1.15; notes.push("+15% distance fit"); }
  if (tags.surfaces?.includes(m.surface))   { mult *= 1.10; notes.push("+10% surface fit"); }
  if (tags.styles?.includes(ctx.style))     { mult *= 1.15; notes.push("+15% style fit"); }

  return { mult, notes, blocked: false };
}

// ---------------------------------------------------------------------------
// Effect → distance gain (meters)
// ---------------------------------------------------------------------------

function baseGainMeters(skill: Skill): number {
  const sim = skill.sim;
  if (!sim?.effectKind) {
    // Passive flat baseline — small contribution.
    return 50;
  }
  const value = Math.abs(sim.effectValue ?? 0);
  const duration = sim.durationS ?? 5;

  switch (sim.effectKind) {
    case "speed": {
      // Δv (m/s) sustained for `duration` s → Δv × duration m.
      return value * duration;
    }
    case "accel": {
      // Acceleration kick: roughly Δv = a × duration; gain ≈ Δv × duration/2.
      const equivDv = value * duration;
      return equivDv * duration * 0.5;
    }
    case "heal": {
      // 1 hp ≈ 0.05 m of late-race sustained pace (rough conversion).
      return value * 0.05;
    }
    case "debuff": {
      // Helps relatively (slows opponents). Half-credit since it's positional.
      return value * duration * 0.5;
    }
    case "buff": {
      return value * 30; // wit-style buffs — small flat contribution
    }
    default:
      return 30;
  }
}

// ---------------------------------------------------------------------------
// Top-level rating
// ---------------------------------------------------------------------------

export function rateSkillForBuild(skill: Skill, ctx: SkillRatingContext): SkillRating {
  const base = baseGainMeters(skill);
  const { prob, notes: probNotes } = estimateActivationProb(skill);
  const { mult, notes: ctxNotes, blocked } = contextMultiplier(skill, ctx);
  const meters = base * prob * mult;
  const notes = [...ctxNotes, ...probNotes];
  return {
    gainMeters: meters,
    gainBashin: meters / BASHIN_M,
    activationProb: prob,
    contextMult: mult,
    notes,
    blocked,
  };
}

// Convenience: compute total expected gain from a set of owned skills.
export function totalBuildGain(skills: Skill[], ctx: SkillRatingContext): {
  totalBashin: number;
  totalMeters: number;
} {
  let totalMeters = 0;
  for (const s of skills) totalMeters += rateSkillForBuild(s, ctx).gainMeters;
  return { totalMeters, totalBashin: totalMeters / BASHIN_M };
}
