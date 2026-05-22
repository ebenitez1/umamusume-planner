import type { Uma } from "../types";

interface Props {
  uma: Uma;
}

// Compact "now selected" header — thumbnail, name, JP name, color band.
// Lives above the config panel so the user always sees who they're planning for.
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
  );
}
