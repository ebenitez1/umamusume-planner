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
  { label: "Opening", start: 0,        end: 1 / 6 },
  { label: "Middle",  start: 1 / 6,    end: 2 / 3 },
  { label: "Final",   start: 2 / 3,    end: 5 / 6 },
  { label: "Spurt",   start: 5 / 6,    end: 1     },
] as const;

const PIN_PALETTE = [
  "#ff58b6", "#6ee687", "#27c4ff", "#ffbe2a", "#ff6b6b",
  "#b07bff", "#5fffae", "#f6c14b", "#ff9534", "#79d7ff",
];

export function RaceTrack({ meeting, activations, finalCornerStart, finalStraightStart }: Props) {
  const distance = meeting.distanceMeters;
  const W = 720, H = 130;
  const TRACK_TOP = 32, TRACK_H = 34;
  const PAD = 8;
  const x = (m: number) => PAD + (W - PAD * 2) * (m / distance);

  // Prefer real course geometry. Fall back to a derived "final corner only"
  // if the meeting wasn't matched against kachi's course_data.
  const geom = meeting.geometry;
  const corners = geom?.corners
    ? geom.corners.map((c, i) => ({ name: i + 1 === geom.corners.length ? "Final Corner" : `Corner ${i + 1}`, start: c.start, end: c.start + c.length }))
    : [{ name: "Final Corner", start: finalCornerStart, end: finalStraightStart }];

  const slopes = geom?.slopes ?? [];

  // Assign one color per unique skillId for the activation pins.
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
            y={TRACK_TOP - 8}
            fontSize={9}
            fill="#9aa1b3"
            textAnchor="middle"
          >
            {p.label}
          </text>
        </g>
      ))}

      {/* Corner regions — all corners from real course data */}
      {corners.map((c, i) => (
        <g key={`corner-${i}`}>
          <rect
            x={x(c.start)}
            y={TRACK_TOP}
            width={x(c.end) - x(c.start)}
            height={TRACK_H}
            fill={c.name === "Final Corner" ? "rgba(255, 141, 183, 0.22)" : "rgba(255, 141, 183, 0.10)"}
            stroke="rgba(255, 141, 183, 0.4)"
            strokeWidth={0.5}
          />
          <text
            x={x(c.start) + (x(c.end) - x(c.start)) / 2}
            y={TRACK_TOP + TRACK_H / 2 + 3}
            fontSize={8}
            fill="rgba(255, 141, 183, 0.95)"
            textAnchor="middle"
            style={{ pointerEvents: "none" }}
          >
            {c.name === "Final Corner" ? "FC" : `C${i + 1}`}
          </text>
          <title>{c.name}: {Math.round(c.start)}m – {Math.round(c.end)}m ({Math.round(c.end - c.start)}m long)</title>
        </g>
      ))}

      {/* Slope sections — green for downhill, orange for uphill, below track */}
      {slopes.map((s, i) => {
        const isUp = s.slope > 0;
        return (
          <g key={`slope-${i}`}>
            <rect
              x={x(s.start)}
              y={TRACK_TOP + TRACK_H + 2}
              width={x(s.start + s.length) - x(s.start)}
              height={6}
              fill={isUp ? "rgba(255, 153, 51, 0.7)" : "rgba(110, 230, 135, 0.7)"}
            />
            <title>{isUp ? "Uphill" : "Downhill"} {Math.round(s.start)}m – {Math.round(s.start + s.length)}m</title>
          </g>
        );
      })}
      {slopes.length > 0 && (
        <g>
          <rect x={x(0)} y={TRACK_TOP + TRACK_H + 2} width={6} height={6} fill="rgba(255, 153, 51, 0.7)" />
          <text x={x(0) + 10} y={TRACK_TOP + TRACK_H + 8} fontSize={8} fill="#9aa1b3">uphill</text>
          <rect x={x(0) + 50} y={TRACK_TOP + TRACK_H + 2} width={6} height={6} fill="rgba(110, 230, 135, 0.7)" />
          <text x={x(0) + 60} y={TRACK_TOP + TRACK_H + 8} fontSize={8} fill="#9aa1b3">downhill</text>
        </g>
      )}

      {/* Final straight band — distinct from FC */}
      <rect
        x={x(finalStraightStart)}
        y={TRACK_TOP}
        width={x(distance) - x(finalStraightStart)}
        height={TRACK_H}
        fill="rgba(110, 230, 135, 0.12)"
        stroke="rgba(110, 230, 135, 0.3)"
        strokeWidth={0.5}
      />
      <text
        x={x(finalStraightStart) + 4}
        y={TRACK_TOP + TRACK_H - 4}
        fontSize={8}
        fill="rgba(110, 230, 135, 0.85)"
      >
        Final straight
      </text>

      {/* Finish line */}
      <line
        x1={x(distance)}
        y1={TRACK_TOP - 4}
        x2={x(distance)}
        y2={TRACK_TOP + TRACK_H + 4}
        stroke="#fff"
        strokeWidth={2}
      />

      {/* Activation pins above the track */}
      {activations.map((a, i) => {
        const px = x(a.positionM);
        const color = skillColors.get(a.skillId) ?? "#fff";
        const stagger = (i % 3) * 4;
        const pinTop = TRACK_TOP - 18 - stagger;
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
            y1={TRACK_TOP + TRACK_H + 9}
            x2={x(distance * f)}
            y2={TRACK_TOP + TRACK_H + 12}
            stroke="#9aa1b3"
          />
          <text
            x={x(distance * f)}
            y={TRACK_TOP + TRACK_H + 22}
            fontSize={9}
            fill="#9aa1b3"
            textAnchor="middle"
          >
            {Math.round(distance * f)}m
          </text>
        </g>
      ))}

      {/* Summary line at the bottom */}
      {(activations.length > 0 || !geom) && (
        <g transform={`translate(${PAD}, ${H - 4})`}>
          <text fontSize={9} fill="#9aa1b3">
            {activations.length} activation{activations.length === 1 ? "" : "s"}
            {!geom && " · course geometry unavailable for this race"}
          </text>
        </g>
      )}
    </svg>
  );
}
