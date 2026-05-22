import type {
  ChampionMeeting,
  Scenario,
  Skill,
  SkillRecommendation,
  Style,
  SupportCard,
  Uma,
  UmaRecommendation,
} from "../types";
import { cardById, championMeetings, scenarios, skillById, skills, umas } from "../data";
import { estimateBaselineRating } from "./rating";

interface RecommendContext {
  uma: Uma;
  meeting: ChampionMeeting;
  scenario: Scenario;
  cards: SupportCard[];
  style: Style;
}

function skillFitsContext(skill: Skill, ctx: RecommendContext): {
  fits: boolean;
  reasons: string[];
  mismatches: string[];
} {
  const reasons: string[] = [];
  const mismatches: string[] = [];
  let fits = false;

  const tags = skill.tags ?? {};

  // ---- positive matches ----
  if (tags.distances?.includes(ctx.meeting.distance)) {
    reasons.push(`Tagged for ${ctx.meeting.distance} distance`);
    fits = true;
  }
  if (tags.surfaces?.includes(ctx.meeting.surface)) {
    reasons.push(`Tagged for ${ctx.meeting.surface}`);
    fits = true;
  }
  if (tags.styles?.includes(ctx.style)) {
    reasons.push(`Synergizes with ${ctx.style} style`);
    fits = true;
  }
  // recovery/heal nearly always useful in mid+long
  if (
    (skill.category === "recovery" || skill.category === "heal") &&
    ctx.meeting.distance !== "sprint"
  ) {
    reasons.push("Recovery is critical at this distance");
    fits = true;
  }
  // final-leg speed/accel are bread-and-butter for non-runner styles
  if (
    (skill.category === "speed" || skill.category === "acceleration") &&
    ctx.style !== "runner" &&
    tags.phase?.some((p) => p === "final" || p === "spurt")
  ) {
    reasons.push("Final-leg burst skills win close finishes");
    fits = true;
  }
  // unique skill of the uma — always include
  if (skill.id === ctx.uma.uniqueSkillId) {
    reasons.unshift("This is the uma's unique skill — always take");
    fits = true;
  }
  // scenario-favored
  if (ctx.scenario.favoredSkillIds?.includes(skill.id)) {
    reasons.push(`Favored by ${ctx.scenario.name} scenario`);
    fits = true;
  }

  // ---- negative matches (will never activate in this race) ----
  // Distance-locked skills don't fire at all in the wrong distance.
  if (tags.distances?.length && !tags.distances.includes(ctx.meeting.distance)) {
    mismatches.push(
      `Locked to ${tags.distances.join("/")} — won't activate at ${ctx.meeting.distance}`
    );
  }
  // Surface-locked likewise (turf/dirt skills don't cross).
  if (tags.surfaces?.length && !tags.surfaces.includes(ctx.meeting.surface)) {
    mismatches.push(
      `Locked to ${tags.surfaces.join("/")} — won't activate on ${ctx.meeting.surface}`
    );
  }
  // Style-locked skills only fire for the right running style.
  if (tags.styles?.length && !tags.styles.includes(ctx.style)) {
    mismatches.push(
      `Locked to ${tags.styles.join("/")} style — won't activate for ${ctx.style}`
    );
  }

  return { fits, reasons, mismatches };
}

function priorityFor(
  skill: Skill,
  ctx: RecommendContext,
  reasons: string[],
  mismatches: string[]
): SkillRecommendation["priority"] {
  // Uma's own unique always wins, even if there's a mismatch (rare edge case).
  if (skill.id === ctx.uma.uniqueSkillId) return "core";
  // Mismatch with no overriding positive signal → don't get.
  if (mismatches.length > 0 && reasons.length === 0) return "avoid";
  // Mismatch but some positive signal → still avoid; the lock means the skill
  // literally won't trigger in this race, no amount of style/phase synergy
  // saves it.
  if (mismatches.length > 0) return "avoid";

  if (skill.rarity === "unique") return "core";
  if (skill.rarity === "rare" && reasons.length >= 2) return "core";
  if (skill.rarity === "rare") return "strong";
  if (reasons.length >= 2) return "strong";
  return "nice-to-have";
}

export function recommendSkills(ctx: RecommendContext): SkillRecommendation[] {
  const learnableIds = new Set<string>();
  // skills already on the uma
  learnableIds.add(ctx.uma.uniqueSkillId);
  for (const s of ctx.uma.awakeningSkillIds) learnableIds.add(s);
  // skills taught by chosen cards
  for (const c of ctx.cards) for (const s of c.taughtSkillIds) learnableIds.add(s);
  // scenario-favored skills are visible even if not on a card (player may
  // already own from prior runs or via scenario rewards)
  for (const s of ctx.scenario.favoredSkillIds ?? []) learnableIds.add(s);

  const recs: SkillRecommendation[] = [];
  for (const id of learnableIds) {
    const skill = skillById.get(id);
    if (!skill) continue;
    const { fits, reasons, mismatches } = skillFitsContext(skill, ctx);
    // Include skills that either fit OR are locked-out (so we can warn).
    if (!fits && mismatches.length === 0) continue;
    const source = sourceFor(skill, ctx);
    const priority = priorityFor(skill, ctx, reasons, mismatches);
    recs.push({
      skill,
      priority,
      // Show mismatches as part of the reasons array so the UI surfaces them.
      reasons: mismatches.length ? [...mismatches, ...reasons] : reasons,
      source,
    });
  }

  // sort: core first, then by ratingPoints desc; avoid sinks to the bottom
  const order: Record<SkillRecommendation["priority"], number> = {
    core: 0,
    strong: 1,
    "nice-to-have": 2,
    avoid: 3,
  };
  recs.sort((a, b) => {
    if (order[a.priority] !== order[b.priority]) return order[a.priority] - order[b.priority];
    return b.skill.ratingPoints - a.skill.ratingPoints;
  });

  return recs;
}

function sourceFor(skill: Skill, ctx: RecommendContext): SkillRecommendation["source"] {
  if (skill.id === ctx.uma.uniqueSkillId || ctx.uma.awakeningSkillIds.includes(skill.id)) {
    return { fromUmaId: ctx.uma.id };
  }
  for (const c of ctx.cards) {
    if (c.taughtSkillIds.includes(skill.id)) return { fromCardId: c.id };
  }
  return undefined;
}

// Cross-uma recommendation: given a meeting + scenario, which umas in the
// roster perform best, and in which style?
export function recommendUmas(
  meetingId: string,
  scenarioId: string,
  topN = 5
): UmaRecommendation[] {
  const meeting = championMeetings.find((m) => m.id === meetingId)!;
  const scenario = scenarios.find((s) => s.id === scenarioId)!;
  const out: UmaRecommendation[] = [];

  for (const uma of umas) {
    // skip catalog-only umas — they have no gameplay overlay
    if (uma.unplayable) continue;
    // try the uma's preferred style + any meta style for the meeting
    const stylesToTry = new Set<Style>([uma.preferredStyle, ...(meeting.metaStyles ?? [])]);
    let best: { style: Style; total: number; grade: string } | null = null;
    for (const style of stylesToTry) {
      const r = estimateBaselineRating(
        { ...uma, preferredStyle: style },
        meeting,
        scenario
      );
      if (!best || r.total > best.total) best = { style, total: r.total, grade: r.grade };
    }
    if (!best) continue;

    const rationale: string[] = [];
    const surfGrade = uma.aptitudes.surface[meeting.surface];
    const distGrade = uma.aptitudes.distance[meeting.distance];
    const styleGrade = uma.aptitudes.style[best.style];
    rationale.push(
      `Surface ${meeting.surface}: ${surfGrade}, Distance ${meeting.distance}: ${distGrade}, Style ${best.style}: ${styleGrade}`
    );
    if (meeting.metaStyles?.includes(best.style))
      rationale.push(`${best.style} is a meta style for this meeting`);
    if (uma.uniqueSkillId) {
      const u = skillById.get(uma.uniqueSkillId);
      if (u) {
        const fitsDist = u.tags?.distances?.includes(meeting.distance);
        if (fitsDist) rationale.push(`Unique skill scales with ${meeting.distance}`);
      }
    }
    out.push({ uma, style: best.style, rationale, expectedGrade: best.grade });
  }

  out.sort((a, b) => gradeRank(a.expectedGrade) - gradeRank(b.expectedGrade));
  return out.slice(0, topN);
}

function gradeRank(grade: string): number {
  const order = [
    "UG1", "UE", "UA", "UB", "UC", "SS+", "SS", "S+", "S",
    "A+", "A", "B+", "B", "C+", "C", "D", "E", "F", "G",
  ];
  return order.indexOf(grade);
}

// Style recommendation for a meeting: heuristic on meta + meeting profile.
export function recommendStyle(meetingId: string): { style: Style; reason: string }[] {
  const meeting = championMeetings.find((m) => m.id === meetingId)!;
  const out: { style: Style; reason: string }[] = [];
  if (meeting.metaStyles?.length) {
    for (const s of meeting.metaStyles) {
      out.push({ style: s, reason: `Meta-favored at ${meeting.name}` });
    }
  }
  // distance heuristics
  if (meeting.distance === "sprint")
    out.push({ style: "runner", reason: "Sprint races almost always favor Front Runner" });
  if (meeting.distance === "long")
    out.push({ style: "end", reason: "Long races leave room for End Closer comebacks" });
  return out;
}

export const debug = { cardById, skills };
