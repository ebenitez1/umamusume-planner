import type { UmaRecommendation } from "../types";

interface Props {
  recommendations: UmaRecommendation[];
  styleRecs: { style: string; reason: string }[];
}

export function UmaRecommendations({ recommendations, styleRecs }: Props) {
  return (
    <aside className="uma-recs">
      <h3>Recommended for this meeting</h3>
      {styleRecs.length > 0 && (
        <div className="style-recs">
          <h4>Strong running styles</h4>
          <ul>
            {styleRecs.map((s, i) => (
              <li key={i}>
                <strong>{s.style}</strong> — {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <h4>Top umas by baseline rating</h4>
      <ol className="uma-rec-list">
        {recommendations.map((r) => (
          <li
            key={r.uma.id}
            style={{
              borderLeftColor: r.uma.colorMain ?? undefined,
            }}
          >
            {r.uma.thumbImg && (
              <img
                className="uma-rec-thumb"
                src={r.uma.thumbImg}
                alt=""
                loading="lazy"
                width={56}
                height={56}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div className="uma-rec-content">
              <div className="uma-rec-head">
                <span className="uma-rec-name">{r.uma.name}</span>
                <span className="uma-rec-grade">{r.expectedGrade}</span>
              </div>
              <p className="uma-rec-style">Best style: {r.style}</p>
              <ul className="uma-rec-rationale">
                {r.rationale.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
