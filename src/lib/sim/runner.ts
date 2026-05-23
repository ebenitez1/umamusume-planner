// Top-level sim runner — turn an UmaBuild + ChampionMeeting into a finished
// RaceSimState and a packaged SimulationResult that the UI can consume.

import type {
  ChampionMeeting,
  Skill,
  Uma,
  UmaBuild,
} from "../../types";
import { skillById } from "../../data";
import { initialHp, postStartMinSpeed, tickPhysics } from "./physics";
import { computeBaseSpeed } from "./types";
import { tick } from "./skills";
import {
  DEFAULT_FINAL_CORNER_FRAC,
  DEFAULT_FINAL_STRAIGHT_FRAC,
  MAX_TICKS,
  STYLE_NUM,
  type ActivationLog,
  type RaceSimState,
  type UmaSimState,
} from "./types";

export interface SimulationResult {
  /** finish times in seconds keyed by uma id */
  finishTimes: Map<string, number>;
  /** final ordered list (1st, 2nd, ...) */
  finishOrder: Array<{ id: string; name: string; timeS: number; isPlayer: boolean }>;
  /** player's velocity sample at each tick (m/s) */
  playerVelocitySeries: Array<{ tickIdx: number; timeS: number; velocity: number; hp: number }>;
  /** player's skill activation events */
  playerActivations: ActivationLog[];
  /** per-skill diagnostics: condition-true count, activation count, etc. */
  playerSkillDiagnostics: Array<{
    skillId: string;
    skillName: string;
    preconditionTrueTicks: number;
    activations: number;
    firstTrueAtS?: number;
  }>;
  /** flags for at-a-glance feedback */
  flags: {
    hpOutBeforeSpurt: boolean;
    finishedFirst: boolean;
    finishedTop3: boolean;
  };
}

export function buildPlayerUma(uma: Uma, build: UmaBuild, meeting: ChampionMeeting): UmaSimState {
  const skills = build.skillIds.map((id) => skillById.get(id)).filter(Boolean) as Skill[];
  const playerUma: UmaSimState = {
    id: "player",
    name: uma.name,
    isPlayer: true,
    stats: build.stats,
    style: build.preferredStyle,
    styleNum: STYLE_NUM[build.preferredStyle],
    aptitudes: {
      surface: build.aptitudes.surface[meeting.surface],
      distance: build.aptitudes.distance[meeting.distance],
      style: build.aptitudes.style[build.preferredStyle],
    },
    skills,
    position: 0,
    velocity: 0,
    hp: 0,
    hpMax: 0,
    order: 1,
    finished: false,
    cooldowns: new Map(),
    activeEffects: [],
    activatedSkillIds: new Set(),
    activationLog: [],
    startDashActive: true,
    prevOrder: 1,
    overtakeTickRemaining: 0,
    changeOrderCount: 0,
    skillDiagnostics: new Map(),
    randomRolls: {
      phase: {}, phaseFirstHalf: {}, phaseLaterHalf: {}, phaseFirstQuarter: {},
      corner: {}, allCorner: 1 + Math.floor(Math.random() * 6),
      straight: 1 + Math.floor(Math.random() * 6),
    },
  };
  playerUma.hpMax = initialHp(playerUma, meeting.distanceMeters);
  playerUma.hp = playerUma.hpMax;
  const baseSpeed = computeBaseSpeed(meeting.distanceMeters);
  playerUma.velocity = postStartMinSpeed(playerUma, baseSpeed);
  return playerUma;
}

export function runSimulation(
  uma: Uma,
  build: UmaBuild,
  meeting: ChampionMeeting,
  _opts: { opponentCount?: number } = {}
): SimulationResult {
  // v2: single-uma mode (no opponents). Order conditions evaluate as
  // "always true" for any order check, matching uma-skill-tools' approach.
  // Useful for build comparison; head-to-head finish-rank is deferred.
  const playerUma = buildPlayerUma(uma, build, meeting);
  const umas = [playerUma];

  const state: RaceSimState = {
    tick: 0,
    timeS: 0,
    meeting,
    umas,
    course: {
      distance: meeting.distanceMeters,
      surface: meeting.surface,
      finalCornerStart: meeting.distanceMeters * DEFAULT_FINAL_CORNER_FRAC,
      finalStraightStart: meeting.distanceMeters * DEFAULT_FINAL_STRAIGHT_FRAC,
      baseSpeed: computeBaseSpeed(meeting.distanceMeters),
    },
    finished: false,
  };

  const velSeries: SimulationResult["playerVelocitySeries"] = [];
  let hpOutBeforeSpurt = false;

  while (!state.finished && state.tick < MAX_TICKS) {
    tick(state, tickPhysics);

    // sample player velocity every 4 ticks (~15 samples/sec @ 1/15s tick)
    if (state.tick % 4 === 0) {
      velSeries.push({
        tickIdx: state.tick,
        timeS: state.timeS,
        velocity: playerUma.velocity,
        hp: playerUma.hp,
      });
    }
    if (!hpOutBeforeSpurt && playerUma.hp <= 0 && playerUma.position < state.course.finalStraightStart) {
      hpOutBeforeSpurt = true;
    }
  }

  // Final sample so the chart's last point matches the actual end state.
  velSeries.push({
    tickIdx: state.tick,
    timeS: state.timeS,
    velocity: playerUma.velocity,
    hp: playerUma.hp,
  });

  // Build result.
  const finishTimes = new Map<string, number>();
  for (const u of state.umas) {
    finishTimes.set(u.id, u.finishTime ?? state.timeS);
  }

  const sorted = [...state.umas].sort((a, b) => {
    const ta = a.finishTime ?? Infinity;
    const tb = b.finishTime ?? Infinity;
    return ta - tb;
  });
  const finishOrder = sorted.map((u) => ({
    id: u.id,
    name: u.name,
    timeS: u.finishTime ?? state.timeS,
    isPlayer: u.isPlayer,
  }));

  const playerRank = finishOrder.findIndex((u) => u.isPlayer) + 1;

  // Package per-skill diagnostics for every skill in the player's loadout.
  const diagnostics = playerUma.skills.map((s) => {
    const d = playerUma.skillDiagnostics.get(s.id);
    return {
      skillId: s.id,
      skillName: s.name,
      preconditionTrueTicks: d?.preconditionTrueTicks ?? 0,
      activations: d?.activations ?? 0,
      firstTrueAtS: d?.firstTrueAtS,
    };
  }).sort((a, b) => b.preconditionTrueTicks - a.preconditionTrueTicks);

  return {
    finishTimes,
    finishOrder,
    playerVelocitySeries: velSeries,
    playerActivations: playerUma.activationLog,
    playerSkillDiagnostics: diagnostics,
    flags: {
      hpOutBeforeSpurt,
      finishedFirst: playerRank === 1,
      finishedTop3: playerRank >= 1 && playerRank <= 3,
    },
  };
}
