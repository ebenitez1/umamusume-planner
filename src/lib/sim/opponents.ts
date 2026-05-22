// Generate a field of "meta-typical" opponent umas to race against the
// player's build. Stats are sampled around averages that vary with the
// race's distance; aptitudes are set to A across the board so opponents
// aren't artificially handicapped. Skills are a small pool of common
// final-leg / recovery picks appropriate for the distance.

import type {
  Aptitudes,
  ChampionMeeting,
  Skill,
  Stats,
  Style,
} from "../../types";
import { skills as allSkills } from "../../data";
import { STYLE_NUM, type UmaSimState } from "./types";
import { baseVelocity, initialHp } from "./physics";

// Gaussian-ish sample (mean ± stddev, clamped to [min, max]).
function sample(mean: number, stddev: number, min = 0, max = 1200): number {
  // Box-Muller for normal distribution.
  const u1 = Math.random() || 1e-6;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.round(Math.max(min, Math.min(max, mean + z * stddev)));
}

interface DistanceProfile {
  speed: [number, number];
  stamina: [number, number];
  power: [number, number];
  guts: [number, number];
  wit: [number, number];
  styles: Style[];          // styles the opponent pool draws from
}

const PROFILES: Record<ChampionMeeting["distance"], DistanceProfile> = {
  sprint: {
    speed:   [1080, 80],
    stamina: [500,  70],
    power:   [950,  80],
    guts:    [450,  70],
    wit:     [600,  80],
    styles:  ["runner", "runner", "runner", "early"],   // runners dominate
  },
  mile: {
    speed:   [1050, 80],
    stamina: [620,  80],
    power:   [880,  80],
    guts:    [450,  70],
    wit:     [620,  80],
    styles:  ["runner", "early", "early", "late"],
  },
  medium: {
    speed:   [1020, 80],
    stamina: [780,  90],
    power:   [820,  80],
    guts:    [450,  70],
    wit:     [620,  80],
    styles:  ["early", "early", "late", "late"],
  },
  long: {
    speed:   [950,  80],
    stamina: [930,  90],
    power:   [780,  70],
    guts:    [480,  70],
    wit:     [620,  80],
    styles:  ["late", "late", "end", "early"],
  },
};

// Pick N random skills from the catalog with a bias toward final-leg /
// distance-appropriate picks. Skips uniques (we don't give opponents
// character-locked uniques).
function pickOpponentSkills(distance: ChampionMeeting["distance"], n: number): Skill[] {
  const pool = allSkills.filter((s) => {
    if (s.rarity === "unique") return false;
    // Skip skills locked to the wrong distance.
    if (s.tags?.distances?.length && !s.tags.distances.includes(distance)) return false;
    // Favor final-leg / spurt skills.
    return true;
  });
  // Score by category bias; sample weighted-ish.
  const weighted = pool.map((s) => {
    let w = 1;
    if (s.category === "speed" || s.category === "acceleration") w += 2;
    if (s.category === "recovery" || s.category === "heal") w += distance === "sprint" ? 0 : 2;
    if (s.tags?.phase?.includes("final") || s.tags?.phase?.includes("spurt")) w += 2;
    return { s, w };
  });
  const out: Skill[] = [];
  for (let i = 0; i < n; i++) {
    const totalW = weighted.reduce((acc, x) => acc + x.w, 0);
    let r = Math.random() * totalW;
    for (let j = 0; j < weighted.length; j++) {
      r -= weighted[j].w;
      if (r <= 0) {
        out.push(weighted[j].s);
        weighted.splice(j, 1);   // no duplicates
        break;
      }
    }
  }
  return out;
}

function meta_aptitudes(meeting: ChampionMeeting, style: Style): Aptitudes {
  // All A for the meeting's traits, B for everything else.
  // This keeps opponents from being absurdly bad in any axis.
  const baseGrade = "B" as const;
  return {
    surface: {
      turf: meeting.surface === "turf" ? "A" : baseGrade,
      dirt: meeting.surface === "dirt" ? "A" : baseGrade,
    },
    distance: {
      sprint: meeting.distance === "sprint" ? "A" : baseGrade,
      mile:   meeting.distance === "mile"   ? "A" : baseGrade,
      medium: meeting.distance === "medium" ? "A" : baseGrade,
      long:   meeting.distance === "long"   ? "A" : baseGrade,
    },
    style: {
      runner: style === "runner" ? "A" : baseGrade,
      early:  style === "early"  ? "A" : baseGrade,
      late:   style === "late"   ? "A" : baseGrade,
      end:    style === "end"    ? "A" : baseGrade,
    },
  };
}

export function generateOpponent(
  index: number,
  meeting: ChampionMeeting
): UmaSimState {
  const profile = PROFILES[meeting.distance];
  const style = profile.styles[Math.floor(Math.random() * profile.styles.length)];
  const stats: Stats = {
    speed:   sample(profile.speed[0],   profile.speed[1]),
    stamina: sample(profile.stamina[0], profile.stamina[1]),
    power:   sample(profile.power[0],   profile.power[1]),
    guts:    sample(profile.guts[0],    profile.guts[1]),
    wit:     sample(profile.wit[0],     profile.wit[1]),
  };
  const apt = meta_aptitudes(meeting, style);
  const skillList = pickOpponentSkills(meeting.distance, 4);
  const distance = meeting.distanceMeters;

  const uma: UmaSimState = {
    id: `opp_${index}`,
    name: `Opponent ${index + 1}`,
    isPlayer: false,
    stats,
    style,
    styleNum: STYLE_NUM[style],
    aptitudes: { surface: apt.surface[meeting.surface], distance: apt.distance[meeting.distance], style: apt.style[style] },
    skills: skillList,
    position: 0,
    velocity: 0,
    hp: 0,
    hpMax: 0,
    order: index + 2,
    finished: false,
    cooldowns: new Map(),
    activeEffects: [],
    activatedSkillIds: new Set(),
    activationLog: [],
    prevOrder: index + 2,
    overtakeTickRemaining: 0,
    changeOrderCount: 0,
    skillDiagnostics: new Map(),
    randomRolls: {
      phase: {}, phaseFirstHalf: {}, phaseLaterHalf: {}, phaseFirstQuarter: {},
      corner: {}, allCorner: 1 + Math.floor(Math.random() * 6),
      straight: 1 + Math.floor(Math.random() * 6),
    },
  };
  uma.hpMax = initialHp(uma, distance);
  uma.hp = uma.hpMax;
  // Tiny warmup velocity so opponents don't start frozen.
  uma.velocity = baseVelocity(uma) * 0.6;
  return uma;
}

export function generateField(meeting: ChampionMeeting, n: number): UmaSimState[] {
  return Array.from({ length: n }, (_, i) => generateOpponent(i, meeting));
}
