import { useState } from "react";
import type { ChampionMeeting, Uma, UmaBuild } from "../types";
import { runSimulation, type SimulationResult } from "../lib/sim/runner";

interface Props {
  uma: Uma;
  build: UmaBuild;
  meeting: ChampionMeeting;
}

export function SimulationPanel({ uma, build, meeting }: Props) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    // Defer with rAF so the button has a chance to render its loading state
    // before we block the main thread with the sim.
    requestAnimationFrame(() => {
      const r = runSimulation(uma, build, meeting);
      setResult(r);
      setRunning(false);
    });
  };

  return (
    <section className="sim-panel">
      <div className="sim-header">
        <h3>Race Simulator</h3>
        <button className="sim-run" onClick={run} disabled={running}>
          {running ? "Running…" : "Run Simulation (single-uma time trial)"}
        </button>
      </div>
      {result && <SimResultView result={result} meeting={meeting} />}
      {!result && <p className="empty">No simulation yet. Click the button above to run one.</p>}
    </section>
  );
}

function SimResultView({ result, meeting }: { result: SimulationResult; meeting: ChampionMeeting }) {
  const player = result.finishOrder.find((u) => u.isPlayer)!;
  const playerRank = result.finishOrder.findIndex((u) => u.isPlayer) + 1;

  return (
    <div className="sim-result">
      <div className="sim-summary">
        <div className={`sim-rank rank-${Math.min(playerRank, 4)}`}>{ordinal(playerRank)}</div>
        <div className="sim-time">{player.timeS.toFixed(2)}s</div>
        {result.flags.hpOutBeforeSpurt && (
          <div className="sim-flag sim-flag-bad">⚠ Stamina-out before final straight</div>
        )}
        {result.flags.finishedFirst && (
          <div className="sim-flag sim-flag-good">🥇 Win</div>
        )}
        {result.flags.finishedTop3 && !result.flags.finishedFirst && (
          <div className="sim-flag sim-flag-meh">🥈 Top 3</div>
        )}
      </div>

      <details open className="sim-detail">
        <summary>Velocity over race ({result.playerVelocitySeries.length} samples)</summary>
        <VelocityChart series={result.playerVelocitySeries} meeting={meeting} />
      </details>

      <details className="sim-detail">
        <summary>Skill activations ({result.playerActivations.length})</summary>
        <ul className="sim-activations">
          {result.playerActivations.map((a, i) => (
            <li key={i}>
              <span className="sim-time-stamp">{a.timeS.toFixed(2)}s</span>
              <strong>{a.skillName}</strong>
              {a.effectKind && (
                <span className="sim-effect">
                  {" "}— {a.effectKind} {a.effectValue !== undefined ? (a.effectValue > 0 ? "+" : "") + a.effectValue : ""}
                </span>
              )}
            </li>
          ))}
        </ul>
      </details>

      <details className="sim-detail">
        <summary>Per-skill diagnostics — why did/didn't your skills fire?</summary>
        <ul className="sim-diagnostics">
          {result.playerSkillDiagnostics.map((d) => {
            const status =
              d.activations > 0
                ? "fired"
                : d.preconditionTrueTicks > 0
                  ? "ready"  // condition was true but cooldown / unique-spent blocked
                  : "never";
            return (
              <li key={d.skillId} className={`sim-diag-${status}`}>
                <span className="sim-diag-status">
                  {status === "fired" ? "✓" : status === "ready" ? "◐" : "·"}
                </span>
                <strong>{d.skillName}</strong>
                <span className="sim-diag-stats">
                  {d.activations > 0
                    ? `fired ${d.activations}×`
                    : d.preconditionTrueTicks > 0
                      ? `ready ${d.preconditionTrueTicks} tick${d.preconditionTrueTicks === 1 ? "" : "s"}, never fired`
                      : "never met conditions"}
                  {d.firstTrueAtS !== undefined && d.activations === 0 && ` (first @ ${d.firstTrueAtS.toFixed(1)}s)`}
                </span>
              </li>
            );
          })}
        </ul>
      </details>

      <details className="sim-detail">
        <summary>Finish order (top 8)</summary>
        <ol className="sim-finish-order">
          {result.finishOrder.slice(0, 8).map((u) => (
            <li key={u.id} className={u.isPlayer ? "you" : ""}>
              <span className="sim-finish-name">{u.name}</span>
              <span className="sim-finish-time">{u.timeS.toFixed(2)}s</span>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}

// Simple SVG line chart of velocity over time.
function VelocityChart({
  series,
  meeting,
}: {
  series: SimulationResult["playerVelocitySeries"];
  meeting: ChampionMeeting;
}) {
  const W = 600, H = 160, PAD = 24;
  const maxT = series[series.length - 1]?.timeS ?? 1;
  const minV = Math.min(...series.map((s) => s.velocity), 10);
  const maxV = Math.max(...series.map((s) => s.velocity), 25);
  const x = (t: number) => PAD + ((W - PAD * 2) * t) / maxT;
  const y = (v: number) => H - PAD - ((H - PAD * 2) * (v - minV)) / (maxV - minV);

  const path = series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(s.timeS).toFixed(1)} ${y(s.velocity).toFixed(1)}`).join(" ");
  const hpPath = series.map((s, i) => {
    const hpV = (s.hp / Math.max(1, Math.max(...series.map((x) => x.hp))));
    const yVal = H - PAD - (H - PAD * 2) * Math.max(0, Math.min(1, hpV));
    return `${i === 0 ? "M" : "L"} ${x(s.timeS).toFixed(1)} ${yVal.toFixed(1)}`;
  }).join(" ");

  // Phase boundary tick marks at distance fractions (we don't have per-tick
  // distance, so approximate from elapsed time fraction — close enough for
  // visualization).
  return (
    <svg className="sim-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Velocity over race">
      <text x={PAD} y={14} fontSize={10} fill="#9aa1b3">m/s</text>
      <text x={W - PAD - 40} y={H - 6} fontSize={10} fill="#9aa1b3">seconds → {meeting.distanceMeters}m</text>
      <path d={hpPath} fill="none" stroke="#ff6b6b" strokeWidth={1} strokeOpacity={0.4} strokeDasharray="3,3" />
      <path d={path} fill="none" stroke="#27c4ff" strokeWidth={2} />
    </svg>
  );
}

function ordinal(n: number): string {
  if (n <= 0) return "—";
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
