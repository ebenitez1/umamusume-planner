import { useState } from "react";
import type { ChampionMeeting, Uma, UmaBuild } from "../types";
import { runSimulation, runManySimulations, type AggregatedSimResult, type SimulationResult } from "../lib/sim/runner";
import { RaceTrack } from "./RaceTrack";

interface Props {
  uma: Uma;
  build: UmaBuild;
  meeting: ChampionMeeting;
}

export function SimulationPanel({ uma, build, meeting }: Props) {
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [agg, setAgg] = useState<AggregatedSimResult | null>(null);
  const [running, setRunning] = useState(false);

  const run = () => {
    setRunning(true);
    requestAnimationFrame(() => {
      const r = runSimulation(uma, build, meeting);
      setResult(r);
      setAgg(null);
      setRunning(false);
    });
  };

  const runMany = (n: number) => {
    setRunning(true);
    requestAnimationFrame(() => {
      const a = runManySimulations(uma, build, meeting, { runs: n });
      setAgg(a);
      setResult(a.sampleRun);   // also show the last run's chart/track
      setRunning(false);
    });
  };

  return (
    <section className="sim-panel">
      <div className="sim-header">
        <h3>Race Simulator</h3>
        <div className="sim-button-group">
          <button className="sim-run" onClick={run} disabled={running}>
            {running ? "Running…" : "Run 1 race"}
          </button>
          <button className="sim-run sim-run-secondary" onClick={() => runMany(20)} disabled={running}>
            {running ? "Running…" : "Run 20 races (avg)"}
          </button>
        </div>
      </div>
      <p className="sim-variance-note">
        Activations vary 4–12 per single run due to game randomness
        (phase_random rolls 1-in-6 per phase, Wit roll per tick, fresh opponents
        each race). Multi-run averages smooth this out.
      </p>
      {agg && <SimAggregateView agg={agg} />}
      {result && <SimResultView result={result} meeting={meeting} />}
      {!result && !agg && <p className="empty">No simulation yet. Click a button above.</p>}
    </section>
  );
}

function SimAggregateView({ agg }: { agg: AggregatedSimResult }) {
  return (
    <details open className="sim-detail">
      <summary>Aggregated over {agg.runs} runs</summary>
      <div className="sim-agg-summary">
        <div><span>Mean finish</span><strong>{agg.meanFinishTimeS.toFixed(2)}s</strong></div>
        <div><span>Median finish</span><strong>{agg.medianFinishTimeS.toFixed(2)}s</strong></div>
        <div><span>Mean rank</span><strong>{agg.meanRank.toFixed(2)}</strong></div>
        <div><span>Win rate</span><strong>{(agg.winRate * 100).toFixed(0)}%</strong></div>
        <div><span>Top-3 rate</span><strong>{(agg.top3Rate * 100).toFixed(0)}%</strong></div>
        <div><span>HP-out rate</span><strong>{(agg.hpOutRate * 100).toFixed(0)}%</strong></div>
      </div>
      <h4 className="sim-agg-h4">Per-skill activation rate</h4>
      <ul className="sim-diagnostics">
        {agg.skillRates.map((s) => {
          const pct = (s.firedInRuns / agg.runs) * 100;
          const status = s.firedInRuns >= agg.runs * 0.7
            ? "fired"
            : s.firedInRuns >= agg.runs * 0.2 ? "ready" : "never";
          return (
            <li key={s.skillId} className={`sim-diag-${status}`}>
              <span className="sim-diag-status">
                {status === "fired" ? "✓" : status === "ready" ? "◐" : "·"}
              </span>
              <strong>{s.skillName}</strong>
              <span className="sim-diag-stats">
                {s.firedInRuns}/{agg.runs} runs · {pct.toFixed(0)}%
                {s.avgFiredTimeS !== undefined && ` · avg @ ${s.avgFiredTimeS.toFixed(1)}s`}
              </span>
              {s.condition && (
                <span className="sim-diag-cond" title="Activation condition">
                  {s.condition}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </details>
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
        <summary>Track + skill activations</summary>
        <RaceTrack meeting={meeting} activations={result.playerActivations} />
      </details>

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
                {d.condition && (
                  <span className="sim-diag-cond" title="Condition that must be true for this skill to fire">
                    {d.condition}
                  </span>
                )}
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
