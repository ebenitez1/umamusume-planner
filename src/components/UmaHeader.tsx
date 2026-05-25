import { useEffect, useRef, useState } from "react";
import type { AptitudeGrade, Aptitudes, Uma } from "../types";

interface Props {
  uma: Uma;
  aptitudes: Aptitudes;          // merged (uma base + user overrides)
  onAptitudeChange: (
    axis: "surface" | "distance" | "style",
    key: string,
    grade: AptitudeGrade
  ) => void;
  hasOverrides: boolean;
  onResetOverrides: () => void;
}

// Compact "now selected" header — thumbnail, name, JP name, color band,
// and the 10 aptitudes (Track/Distance/Style) shown like the in-game profile.
// Click any aptitude pill to override its grade for this build.
export function UmaHeader({
  uma,
  aptitudes,
  onAptitudeChange,
  hasOverrides,
  onResetOverrides,
}: Props) {
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

      <AptitudeRow
        uma={uma}
        aptitudes={aptitudes}
        onAptitudeChange={onAptitudeChange}
      />
      {hasOverrides && (
        <button className="apt-reset" onClick={onResetOverrides} type="button">
          Reset aptitudes to base
        </button>
      )}
    </div>
  );
}

function AptitudeRow({
  uma,
  aptitudes,
  onAptitudeChange,
}: {
  uma: Uma;
  aptitudes: Aptitudes;
  onAptitudeChange: Props["onAptitudeChange"];
}) {
  const a = aptitudes;
  const base = uma.aptitudes;
  return (
    <div className="apt-rows">
      <AptLine label="Track">
        <AptPill label="Turf" grade={a.surface.turf}
          override={a.surface.turf !== base.surface.turf}
          onChange={(g) => onAptitudeChange("surface", "turf", g)} />
        <AptPill label="Dirt" grade={a.surface.dirt}
          override={a.surface.dirt !== base.surface.dirt}
          onChange={(g) => onAptitudeChange("surface", "dirt", g)} />
      </AptLine>
      <AptLine label="Distance">
        <AptPill label="Sprint" grade={a.distance.sprint}
          override={a.distance.sprint !== base.distance.sprint}
          onChange={(g) => onAptitudeChange("distance", "sprint", g)} />
        <AptPill label="Mile" grade={a.distance.mile}
          override={a.distance.mile !== base.distance.mile}
          onChange={(g) => onAptitudeChange("distance", "mile", g)} />
        <AptPill label="Medium" grade={a.distance.medium}
          override={a.distance.medium !== base.distance.medium}
          onChange={(g) => onAptitudeChange("distance", "medium", g)} />
        <AptPill label="Long" grade={a.distance.long}
          override={a.distance.long !== base.distance.long}
          onChange={(g) => onAptitudeChange("distance", "long", g)} />
      </AptLine>
      <AptLine label="Style">
        <AptPill label="Front" grade={a.style.runner}
          override={a.style.runner !== base.style.runner}
          onChange={(g) => onAptitudeChange("style", "runner", g)} />
        <AptPill label="Pace" grade={a.style.early}
          override={a.style.early !== base.style.early}
          onChange={(g) => onAptitudeChange("style", "early", g)} />
        <AptPill label="Late" grade={a.style.late}
          override={a.style.late !== base.style.late}
          onChange={(g) => onAptitudeChange("style", "late", g)} />
        <AptPill label="End" grade={a.style.end}
          override={a.style.end !== base.style.end}
          onChange={(g) => onAptitudeChange("style", "end", g)} />
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

const ALL_GRADES: AptitudeGrade[] = ["S", "A", "B", "C", "D", "E", "F", "G"];

function AptPill({
  label,
  grade,
  override,
  onChange,
}: {
  label: string;
  grade: AptitudeGrade;
  override: boolean;
  onChange: (g: AptitudeGrade) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="apt-pill-wrap" ref={ref}>
      <button
        type="button"
        className={`apt-pill apt-pill-grade-${grade} ${override ? "apt-pill-override" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={override ? `Overridden (base differs)` : "Click to change"}
      >
        <span className="apt-pill-label">{label}</span>
        <span className="apt-pill-grade">{grade}</span>
      </button>
      {open && (
        <div className="apt-popover" role="menu">
          {ALL_GRADES.map((g) => (
            <button
              key={g}
              type="button"
              className={`apt-popover-grade apt-pill-grade-${g} ${g === grade ? "active" : ""}`}
              onClick={() => { onChange(g); setOpen(false); }}
            >
              {g}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
