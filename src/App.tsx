import { useMemo, useState } from "react";
import {
  championMeetings,
  meetingById,
  scenarioById,
  scenarios,
  umaById,
  umas,
  cardById,
} from "./data";
import type { Stats, Style, UmaBuild } from "./types";
import { rateBuild } from "./lib/rating";
import { recommendSkills, recommendStyle, recommendUmas } from "./lib/recommender";
import { Picker } from "./components/Picker";
import { UmaSelect } from "./components/UmaSelect";
import { UmaHeader } from "./components/UmaHeader";
import { CardDeck } from "./components/CardDeck";
import { CustomSkillAdder } from "./components/CustomSkillAdder";
import { SimulationPanel } from "./components/SimulationPanel";
import { StatInputs } from "./components/StatInputs";
import { RatingDisplay } from "./components/RatingDisplay";
import { SkillRecommendations } from "./components/SkillRecommendations";
import { UmaRecommendations } from "./components/UmaRecommendations";
import "./App.css";

const STYLES: Style[] = ["runner", "early", "late", "end"];
const STYLE_LABEL: Record<Style, string> = {
  runner: "Front Runner",
  early: "Pace Chaser",
  late: "Late Surger",
  end: "End Closer",
};

const DEFAULT_STATS: Stats = {
  speed: 1100,
  stamina: 600,
  power: 800,
  guts: 350,
  wit: 600,
};

export default function App() {
  // default to Special Week — outfit ID 100101 is "Special Dreamer" (her base form)
  const defaultUma =
    umas.find((u) => u.gameId === 100101) ??
    umas.find((u) => u.name.startsWith("Special Week")) ??
    umas[0];
  const [umaId, setUmaId] = useState(defaultUma.id);
  const [meetingId, setMeetingId] = useState(championMeetings[0].id);
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [cardIds, setCardIds] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>(DEFAULT_STATS);
  const [skillIds, setSkillIds] = useState<string[]>([]);
  const [customSkillIds, setCustomSkillIds] = useState<string[]>([]);
  const [style, setStyle] = useState<Style>("early");

  const uma = umaById.get(umaId)!;
  const meeting = meetingById.get(meetingId)!;
  const scenario = scenarioById.get(scenarioId)!;
  const cards = cardIds.map((id) => cardById.get(id)).filter(Boolean) as NonNullable<
    ReturnType<typeof cardById.get>
  >[];

  useMemo(() => {
    setSkillIds((cur) => {
      if (cur.length > 0) return cur;
      return [uma.uniqueSkillId, ...uma.awakeningSkillIds].filter(Boolean);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [umaId]);

  const build: UmaBuild = {
    umaId,
    meetingId,
    scenarioId,
    cardIds,
    stats,
    aptitudes: uma.aptitudes,
    skillIds,
    preferredStyle: style,
  };

  const rating = rateBuild(build, uma, meeting, scenario);
  const skillRecs = recommendSkills({
    uma, meeting, scenario, cards, style, customSkillIds,
  });
  const umaRecs = recommendUmas(meetingId, scenarioId, 5);
  const styleRecs = recommendStyle(meetingId);

  const toggleSkill = (id: string) => {
    setSkillIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
    );
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Umamusume Build Planner</h1>
        <p className="tagline">
          Pick your uma, the Champion Meeting, your scenario and cards — get
          skill recommendations and a rating estimate.
        </p>
      </header>

      <main className="app-main">
        <section className="config">
          <UmaHeader uma={uma} />
          <div className="config-row">
            <UmaSelect value={umaId} onChange={setUmaId} />
            <Picker
              label="Champion Meeting"
              value={meetingId}
              onChange={setMeetingId}
              options={championMeetings.map((m) => {
                const dist = m.distance.charAt(0).toUpperCase() + m.distance.slice(1);
                const prefix = m.cmNumber ? `CM${m.cmNumber} ` : "";
                return { value: m.id, label: `${prefix}[${dist}] ${m.name}` };
              })}
            />
            <Picker
              label="Scenario"
              value={scenarioId}
              onChange={setScenarioId}
              options={scenarios.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Picker
              label="Running Style"
              value={style}
              onChange={(v) => setStyle(v as Style)}
              options={STYLES.map((s) => ({ value: s, label: STYLE_LABEL[s] }))}
            />
          </div>

          <p className="meeting-notes">
            <span className={`dist-badge dist-${meeting.distance}`}>
              {meeting.distance.charAt(0).toUpperCase() + meeting.distance.slice(1)}
            </span>{" "}
            <span className={`surf-badge surf-${meeting.surface}`}>
              {meeting.surface.charAt(0).toUpperCase() + meeting.surface.slice(1)}
            </span>{" "}
            {meeting.notes}
          </p>
          <p className="scenario-notes">{scenario.notes}</p>

          <CardDeck selected={cardIds} onChange={setCardIds} />
          <CustomSkillAdder added={customSkillIds} onChange={setCustomSkillIds} />
          <StatInputs stats={stats} onChange={setStats} />
        </section>

        <section className="results">
          <RatingDisplay rating={rating} />
          <SkillRecommendations
            recommendations={skillRecs}
            ownedSkillIds={skillIds}
            onToggle={toggleSkill}
          />
        </section>

        <UmaRecommendations recommendations={umaRecs} styleRecs={styleRecs} />

        <SimulationPanel uma={uma} build={build} meeting={meeting} />
      </main>

      <footer className="app-footer">
        <p>
          Rating heuristic — calibrated against community-reported numbers.
          Race simulator coming next. Data:{" "}
          <a href="https://gametora.com/umamusume" target="_blank" rel="noreferrer">
            GameTora
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
