import type { RatingResult } from "../types";

interface Props {
  rating: RatingResult;
}

function gradeColor(grade: string): string {
  if (grade.startsWith("U")) return "#ff58b6";
  if (grade.startsWith("SS")) return "#ffbe2a";
  if (grade.startsWith("S")) return "#ff9b3a";
  if (grade.startsWith("A")) return "#e84a4a";
  if (grade.startsWith("B")) return "#bd5af5";
  if (grade.startsWith("C")) return "#4ac3ff";
  return "#888";
}

export function RatingDisplay({ rating }: Props) {
  return (
    <div className="rating">
      <div className="rating-grade" style={{ color: gradeColor(rating.grade) }}>
        {rating.grade}
      </div>
      <div className="rating-total">{rating.total.toLocaleString()}</div>
      <div className="rating-breakdown">
        <div>
          <span>Stat score</span>
          <strong>{rating.breakdown.statScore.toLocaleString()}</strong>
        </div>
        <div>
          <span>Skill score</span>
          <strong>{rating.breakdown.skillScore.toLocaleString()}</strong>
        </div>
        <div>
          <span>Unique bonus</span>
          <strong>
            {rating.breakdown.aptitudeBonus > 0 ? "+" : ""}
            {rating.breakdown.aptitudeBonus.toLocaleString()}
          </strong>
        </div>
        <div>
          <span>Scenario</span>
          <strong>+{rating.breakdown.scenarioBonus}%</strong>
        </div>
      </div>
      {rating.notes.length > 0 && (
        <ul className="rating-notes">
          {rating.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
