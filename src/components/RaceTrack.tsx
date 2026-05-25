import type { ChampionMeeting } from "../types";
import type { ActivationLog } from "../lib/sim/types";

interface Props {
  meeting: ChampionMeeting;
  activations: ActivationLog[];
  finalCornerStart: number;
  finalStraightStart: number;
}

// Phase boundaries (matches PHASE_BOUNDS in sim/types.ts)
const PHASES = [
  { label: "Opening", start: 0,        end: 1 / 6,    color: "var(--accent-2)" },
  { label: "Middle",  start: 1 / 6,    end: 2 / 3,    color: "#ffbe2a" },
  { label: "Final",   start: 2 / 3,    end: 5 / 6,    color: "var(--accent)" },
  { label: "Spurt",   start: 5 / 6,    end: 1,        color: "#b07bff" },
] as const;

const PIN_PALETTE = [
  "#ff58b6", "#6ee687", "#27c4ff", "#ffbe2a", "#ff6b6b",
  "#b07bff", "#5fffae", "#f6c14b", "#ff9534", "#79d7ff",
];

// Tokyo, Niigata, Chukyo, Longchamp = left-handed (CCW). Others = right (CW).
// Mirror of sim/skills.ts rotationFor — kept inline to avoid a sim dep.
const LEFT_HANDED = new Set(["Tokyo", "Niigata", "Chukyo", "Longchamp"]);
function isLeftHanded(track: string): boolean {
  return LEFT_HANDED.has(track);
}

export function RaceTrack({ meeting, activations }: Props) {
  const distance = meeting.distanceMeters;
  // Five-row layout from top to bottom:
  //   row 0 (PINS)      — skill activation pins
  //   row 1 (TERRAIN)   — elevation silhouette
  //   row 2 (SLOPES)    — uphill/downhill bands
  //   row 3 (TRACK)     — corners + straights with arrows
  //   row 4 (PHASES)    — phase colored bar
  //   below: section numbers + distance ticks
  const W = 760, H = 240;
  const PAD = 10;
  const ROW = { pins: 8, terrain: 32, slopes: 24, track: 24, phases: 22 };
  const Y_PINS_TOP = ROW.pins;
  const Y_TERRAIN_TOP = Y_PINS_TOP + 36;
  const Y_SLOPES_TOP = Y_TERRAIN_TOP + ROW.terrain + 2;
  const Y_TRACK_TOP = Y_SLOPES_TOP + ROW.slopes + 2;
  const Y_PHASES_TOP = Y_TRACK_TOP + ROW.track + 2;
  const Y_SECTIONS_TOP = Y_PHASES_TOP + ROW.phases + 2;
  const Y_DISTANCE_TOP = Y_SECTIONS_TOP + 18;

  const x = (m: number) => PAD + (W - PAD * 2) * (m / distance);

  const geom = meeting.geometry;
  const corners = geom?.corners ?? [];
  const slopes = geom?.slopes ?? [];
  // Use straights from geometry when available; otherwise derive from corners.
  const straights = geom?.straights ?? deriveStraights(distance, corners);
  const turnArrow = isLeftHanded(meeting.track) ? "↺" : "↻";

  // Assign one color per unique skillId for the activation pins.
  const skillColors = new Map<string, string>();
  let colorIdx = 0;
  for (const a of activations) {
    if (!skillColors.has(a.skillId)) {
      skillColors.set(a.skillId, PIN_PALETTE[colorIdx % PIN_PALETTE.length]);
      colorIdx++;
    }
  }

  // Build the terrain silhouette as a polyline from cumulative slope.
  // Each slope segment raises/lowers the line by length * sign of slope.
  const terrainPath = buildTerrainPath(distance, slopes, x, Y_TERRAIN_TOP, ROW.terrain);

  // Section grid — divide race into ~12 sections (matches the game's 12-segment
  // race model).
  const SECTION_COUNT = 12;
  const sections = Array.from({ length: SECTION_COUNT }, (_, i) => i + 1);

  return (
    <svg className="race-track" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Race track: ${meeting.name}`}>
      {/* ---- Skill activation pins above the terrain ---- */}
      {activations.map((a, i) => {
        const px = x(a.positionM);
        const color = skillColors.get(a.skillId) ?? "#fff";
        const stagger = (i % 3) * 5;
        const top = Y_PINS_TOP + 4 + stagger;
        return (
          <g key={`pin-${i}`}>
            <line x1={px} y1={top + 4} x2={px} y2={Y_TERRAIN_TOP - 2} stroke={color} strokeWidth={1.5} />
            <circle cx={px} cy={top} r={4} fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth={0.5} />
            <title>{`${a.timeS.toFixed(1)}s @ ${Math.round(a.positionM)}m — ${a.skillName}${a.effectKind ? ` (${a.effectKind} ${a.effectValue! > 0 ? '+' : ''}${a.effectValue})` : ''}`}</title>
          </g>
        );
      })}

      {/* ---- Terrain elevation silhouette ---- */}
      <rect x={PAD} y={Y_TERRAIN_TOP} width={W - PAD * 2} height={ROW.terrain} fill="rgba(255,255,255,0.025)" />
      <path d={terrainPath} fill="rgba(110, 230, 135, 0.32)" stroke="rgba(110, 230, 135, 0.7)" strokeWidth={1} />

      {/* ---- Slope bands (uphill orange, downhill cyan-green) ---- */}
      {slopes.map((s, i) => {
        const isUp = s.slope > 0;
        const fill = isUp ? "#ff9534" : "#5fd9d9";
        const w = Math.max(2, x(s.start + s.length) - x(s.start));
        return (
          <g key={`slope-${i}`}>
            <rect x={x(s.start)} y={Y_SLOPES_TOP} width={w} height={ROW.slopes} fill={fill} fillOpacity={0.55} />
            <text
              x={x(s.start) + 3}
              y={Y_SLOPES_TOP + ROW.slopes / 2 + 3}
              fontSize={9}
              fill="#1a0d00"
              style={{ fontWeight: 700 }}
            >
              {isUp ? "↗" : "↘"}{Math.round(s.start)}m
            </text>
            <title>{isUp ? "Uphill" : "Downhill"} {Math.round(s.start)}m – {Math.round(s.start + s.length)}m</title>
          </g>
        );
      })}

      {/* ---- Track row: straights and corners ---- */}
      {straights.map((s, i) => (
        <g key={`straight-${i}`}>
          <rect x={x(s.start)} y={Y_TRACK_TOP} width={x(s.end) - x(s.start)} height={ROW.track} fill="rgba(80, 100, 130, 0.5)" />
          <text x={(x(s.start) + x(s.end)) / 2} y={Y_TRACK_TOP + ROW.track / 2 + 3} fontSize={9} fill="#c5c8d2" textAnchor="middle">
            Straight →
          </text>
        </g>
      ))}
      {corners.map((c, i) => {
        const w = x(c.start + c.length) - x(c.start);
        const isFinal = i === corners.length - 1;
        return (
          <g key={`corner-${i}`}>
            <rect
              x={x(c.start)}
              y={Y_TRACK_TOP}
              width={w}
              height={ROW.track}
              fill={isFinal ? "rgba(255, 141, 183, 0.55)" : "rgba(180, 130, 200, 0.45)"}
            />
            {w >= 30 && (
              <text x={(x(c.start) + x(c.start + c.length)) / 2} y={Y_TRACK_TOP + ROW.track / 2 + 3} fontSize={9} fill="#2a0a20" textAnchor="middle" style={{ fontWeight: 700 }}>
                {turnArrow}C{i + 1}{isFinal ? " (FC)" : ""}
              </text>
            )}
            <title>{`${isFinal ? "Final " : ""}Corner ${i + 1}: ${Math.round(c.start)}m – ${Math.round(c.start + c.length)}m`}</title>
          </g>
        );
      })}

      {/* ---- Phase color bar ---- */}
      {PHASES.map((p) => (
        <g key={`phase-${p.label}`}>
          <rect
            x={x(distance * p.start)}
            y={Y_PHASES_TOP}
            width={x(distance * p.end) - x(distance * p.start)}
            height={ROW.phases}
            fill={p.color}
            fillOpacity={0.7}
          />
          <text
            x={(x(distance * p.start) + x(distance * p.end)) / 2}
            y={Y_PHASES_TOP + ROW.phases / 2 + 3}
            fontSize={9}
            fill="#0b0b16"
            textAnchor="middle"
            style={{ fontWeight: 700 }}
          >
            {p.label} leg
          </text>
        </g>
      ))}

      {/* ---- Section numbers (1-12) ---- */}
      {sections.map((n) => {
        const startM = (distance * (n - 1)) / SECTION_COUNT;
        const endM = (distance * n) / SECTION_COUNT;
        const cx = (x(startM) + x(endM)) / 2;
        return (
          <g key={`section-${n}`}>
            <line x1={x(endM)} y1={Y_SECTIONS_TOP - 2} x2={x(endM)} y2={Y_SECTIONS_TOP + 14} stroke="#3a4055" strokeWidth={0.5} />
            <text x={cx} y={Y_SECTIONS_TOP + 11} fontSize={10} fill="#9aa1b3" textAnchor="middle">{n}</text>
          </g>
        );
      })}

      {/* ---- Distance ticks ---- */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={`tick-${f}`}>
          <text x={x(distance * f)} y={Y_DISTANCE_TOP + 4} fontSize={9} fill="#9aa1b3" textAnchor="middle">
            {Math.round(distance * f).toLocaleString()}m
          </text>
        </g>
      ))}

      {/* ---- Finish line marker spanning all rows ---- */}
      <line x1={x(distance)} y1={Y_TERRAIN_TOP - 2} x2={x(distance)} y2={Y_PHASES_TOP + ROW.phases + 2} stroke="#fff" strokeWidth={1.5} />

      {/* ---- Summary text ---- */}
      <text x={PAD} y={H - 2} fontSize={9} fill="#9aa1b3">
        {activations.length} activation{activations.length === 1 ? "" : "s"}
        {!geom && " · course geometry unavailable for this race"}
        {geom && ` · turn direction: ${isLeftHanded(meeting.track) ? "left ↺" : "right ↻"}`}
      </text>
    </svg>
  );
}

// Derive straight sections from corner positions when course_data didn't
// supply them explicitly.
function deriveStraights(
  distance: number,
  corners: Array<{ start: number; length: number }>
): Array<{ start: number; end: number }> {
  if (!corners.length) return [{ start: 0, end: distance }];
  const out: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const c of corners) {
    if (c.start > cursor) out.push({ start: cursor, end: c.start });
    cursor = c.start + c.length;
  }
  if (cursor < distance) out.push({ start: cursor, end: distance });
  return out;
}

// Generate a polygon path approximating an elevation silhouette. Integrate
// the signed slope value across position to get a relative height curve;
// normalize to fit within the row height. Each slope segment displaces the
// running elevation by its length * sign(slope); between slopes the
// elevation stays flat.
function buildTerrainPath(
  distance: number,
  slopes: Array<{ start: number; length: number; slope: number }>,
  x: (m: number) => number,
  topY: number,
  height: number
): string {
  // Build sample points (sorted by position).
  type Pt = { m: number; h: number };
  const pts: Pt[] = [{ m: 0, h: 0 }];
  let elevation = 0;
  const sorted = [...slopes].sort((a, b) => a.start - b.start);
  for (const s of sorted) {
    pts.push({ m: s.start, h: elevation });
    elevation += Math.sign(s.slope) * s.length;
    pts.push({ m: s.start + s.length, h: elevation });
  }
  pts.push({ m: distance, h: elevation });

  // Normalize elevation to [0, 1] within the row height.
  const minH = Math.min(0, ...pts.map((p) => p.h));
  const maxH = Math.max(0, ...pts.map((p) => p.h));
  const span = maxH - minH || 1;
  const yFor = (h: number) => topY + height - 2 - ((h - minH) / span) * (height - 4);

  let path = `M ${x(0).toFixed(1)} ${(topY + height).toFixed(1)}`;
  for (const p of pts) {
    path += ` L ${x(p.m).toFixed(1)} ${yFor(p.h).toFixed(1)}`;
  }
  path += ` L ${x(distance).toFixed(1)} ${(topY + height).toFixed(1)} Z`;
  return path;
}
