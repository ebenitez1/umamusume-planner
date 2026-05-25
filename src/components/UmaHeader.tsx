import type { AptitudeGrade, Uma } from "../types";

interface Props {
  uma: Uma;
}

// Compact "now selected" header — thumbnail, name, JP name, color band,
// and the 10 aptitudes (Track/Distance/Style) shown like the in-game profile.
export function UmaHeader({ uma }: Props) {
  return (
    <div
      className="uma-header"
      style={{
        background: uma.colorMain
          ? `linear-gradient(90deg, ${uma.colorMain}33, transparent 60%)`
          : undefined,
        borderLeft: uma.colorMain ? `4px solid ${uma.colorMain}` : undefined,
      }}
    >
      <div className="uma-header-top">
        {uma.thumbImg && (
          <img
            className="uma-header-thumb"
            src={uma.thumbImg}
            alt=""
            width={72}
            height={72}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <div className="uma-header-text">
          <div className="uma-header-name">{uma.name}</div>
          {uma.nameJp && <div className="uma-header-name-jp">{uma.nameJp}</div>}
          <div className="uma-header-meta">
            {"★".repeat(uma.rarity)} · preferred style:{" "}
            <strong>{uma.preferredStyle}</strong>
          </div>
        </div>
      </div>

      <AptitudeRow uma={uma} />
    </div>
  );
}

function AptitudeRow({ uma }: { uma: Uma }) {
  const a = uma.aptitudes;
  return (
    <div className="apt-rows">
      <AptLine label="Track">
        <AptPill label="Turf" grade={a.surface.turf} />
        <AptPill label="Dirt" grade={a.surface.dirt} />
      </AptLine>
      <AptLine label="Distance">
        <AptPill label="Sprint" grade={a.distance.sprint} />
        <AptPill label="Mile" grade={a.distance.mile} />
        <AptPill label="Medium" grade={a.distance.medium} />
        <AptPill label="Long" grade={a.distance.long} />
      </AptLine>
      <AptLine label="Style">
        <AptPill label="Front" grade={a.style.runner} />
        <AptPill label="Pace" grade={a.style.early} />
        <AptPill label="Late" grade={a.style.late} />
        <AptPill label="End" grade={a.style.end} />
      </AptLine>
    </div>
  );
}

function AptLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="apt-line">
      <span className="apt-line-label">{label}</span>
      <div className="apt-line-cells">{children}</div>
    </div>
  );
}

function AptPill({ label, grade }: { label: string; grade: AptitudeGrade }) {
  return (
    <span className={`apt-pill apt-pill-grade-${grade}`}>
      <span className="apt-pill-label">{label}</span>
      <span className="apt-pill-grade">{grade}</span>
    </span>
  );
}
