import type { ChampionMeeting } from "../types";
import type { ActivationLog } from "../lib/sim/types";

interface Props {
  meeting: ChampionMeeting;
  activations: ActivationLog[];
  // Course shape — same fractions used by the sim.
  finalCornerStart: number;       // meters
  finalStraightStart: number;     // meters
}

// Heuristic corner positions (in m fractions of total distance) — matches
// what the sim's cornerAt() uses, so visual + sim agree.
function cornerRegions(distance: number, finalCornerStart: number, finalStraightStart: number) {
  return [
    { name: "Corner 1", start: distance * 0.10, end: distance * 0.22 },
    { name: "Corner 2", start: distance * 0.38, end: distance * 0.50 },
    { name: "Final Corner", start: finalCornerStart, end: finalStraightStart },
  ];
}

// Phase boundaries (matches PHASE_BOUNDS in sim/types.ts)
const PHASES = [
  { label: "Opening", start: 0,        end: 1 / 6 },
  { label: "Middle",  start: 1 / 6,    end: 2 / 3 },
  { label: "Final",   start: 2 / 3,    end: 5 / 6 },
  { label: "Spurt",   start: 5 / 6,    end: 1     },
] as const;

// Tiny color palette to differentiate up to ~10 skill pin colors.
const PIN_PALETTE = [
  "#ff58b6", "#6ee687", "#27c4ff", "#ffbe2a", "#ff6b6b",
  "#b07bff", "#5fffae", "#f6c14b", "#ff9534", "#79d7ff",
];

export function RaceTrack({ meeting, activations, finalCornerStart, finalStraightStart }: Props) {
  const distance = meeting.distanceMeters;
  const W = 720, H = 86;
  const TRACK_TOP = 22, TRACK_H = 32;
  const PAD = 8;

  const x = (m: number) => PAD + (W - PAD * 2) * (m / distance);

  const corners = cornerRegions(distance, finalCornerStart, finalStraightStart);

  // Group activations by skillId so same-skill repeats share a pin color.
  const skillColors = new Map<string, string>();
  let colorIdx = 0;
  for (const a of activations) {
    if (!skillColors.has(a.skillId)) {
      skillColors.set(a.skillId, PIN_PALETTE[colorIdx % PIN_PALETTE.length]);
      colorIdx++;
    }
  }

  return (
    <svg className="race-track" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Race track: ${meeting.name}`}>
      {/* Phase background bands */}
      {PHASES.map((p, i) => (
        <rect
          key={p.label}
          x={x(distance * p.start)}
          y={TRACK_TOP}
          width={x(distance * p.end) - x(distance * p.start)}
          height={TRACK_H}
          fill={i % 2 === 0 ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)"}
        />
      ))}

      {/* Phase boundary lines + labels */}
      {PHASES.map((p) => (
        <g key={`${p.label}-divider`}>
          <line
            x1={x(distance * p.start)}
            y1={TRACK_TOP}
            x2={x(distance * p.start)}
            y2={TRACK_TOP + TRACK_H}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth={1}
          />
          <text
            x={x(distance * (p.start + (p.end - p.start) / 2))}
            y={TRACK_TOP - 6}
            fontSize={9}
            fill="#9aa1b3"
            textAnchor="middle"
          >
            {p.label}
          </text>
        </g>
      ))}

      {/* Corner regions */}
      {corners.map((c) => (
        <g key={c.name}>
          <rect
            x={x(c.start)}
            y={TRACK_TOP}
            width={x(c.end) - x(c.start)}
            height={TRACK_H}
            fill="rgba(255, 141, 183, 0.12)"
            stroke="rgba(255, 141, 183, 0.3)"
            strokeWidth={0.5}
          />
          <title>{c.name}: {Math.round(c.start)}m – {Math.round(c.end)}m</title>
        </g>
      ))}

      {/* Final straight band */}
      <rect
        x={x(finalStraightStart)}
        y={TRACK_TOP}
        width={x(distance) - x(finalStraightStart)}
        height={TRACK_H}
        fill="rgba(110, 230, 135, 0.15)"
      />
      <text
        x={x(finalStraightStart) + 4}
        y={TRACK_TOP + TRACK_H - 4}
        fontSize={8}
        fill="rgba(110, 230, 135, 0.8)"
      >
        Final straight
      </text>

      {/* Finish line */}
      <line
        x1={x(distance)}
        y1={TRACK_TOP - 2}
        x2={x(distance)}
        y2={TRACK_TOP + TRACK_H + 2}
        stroke="#fff"
        strokeWidth={2}
      />

      {/* Activation pins — vertical line + dot above the track */}
      {activations.map((a, i) => {
        const px = x(a.positionM);
        const color = skillColors.get(a.skillId) ?? "#fff";
        // Stagger pin Y to reduce overlap when multiple skills fire close together.
        const stagger = (i % 3) * 4;
        const pinTop = TRACK_TOP - 14 - stagger;
        return (
          <g key={i}>
            <line x1={px} y1={pinTop + 4} x2={px} y2={TRACK_TOP} stroke={color} strokeWidth={1.5} />
            <circle cx={px} cy={pinTop} r={4} fill={color} stroke="rgba(0,0,0,0.4)" strokeWidth={0.5} />
            <title>{`${a.timeS.toFixed(1)}s @ ${Math.round(a.positionM)}m — ${a.skillName}${a.effectKind ? ` (${a.effectKind} ${a.effectValue! > 0 ? '+' : ''}${a.effectValue})` : ''}`}</title>
          </g>
        );
      })}

      {/* Distance axis ticks */}
      {[0, 0.25, 0.5, 0.75, 1].map((f) => (
        <g key={f}>
          <line
            x1={x(distance * f)}
            y1={TRACK_TOP + TRACK_H}
            x2={x(distance * f)}
            y2={TRACK_TOP + TRACK_H + 3}
            stroke="#9aa1b3"
          />
          <text
            x={x(distance * f)}
            y={TRACK_TOP + TRACK_H + 14}
            fontSize={9}
            fill="#9aa1b3"
            textAnchor="middle"
          >
            {Math.round(distance * f)}m
          </text>
        </g>
      ))}

      {/* Legend for activations (compact, below) */}
      {activations.length > 0 && (
        <g transform={`translate(${PAD}, ${H - 4})`}>
          <text fontSize={9} fill="#9aa1b3">{activations.length} activation{activations.length === 1 ? "" : "s"} — hover a pin for details</text>
        </g>
      )}
    </svg>
  );
}
