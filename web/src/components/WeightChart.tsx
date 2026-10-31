import { formatDate, formatKg } from "@pets/core/domain";
import { strings } from "@pets/core/strings";

export interface WeightPoint {
  date: string;
  kg: number;
}

/**
 * The weight over time, drawn by hand: a line through the weighings in date
 * order, the lowest and highest weights on the left, the first and last days
 * below. Time is to scale, so a long gap looks long.
 */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const width = 320;
  const height = 140;
  const pad = { top: 12, right: 12, bottom: 24, left: 44 };
  const times = sorted.map((p) => new Date(`${p.date}T12:00:00`).getTime());
  const t0 = times[0];
  const t1 = times[times.length - 1];
  const kgs = sorted.map((p) => p.kg);
  let low = Math.min(...kgs);
  let high = Math.max(...kgs);
  if (high - low < 0.2) {
    low -= 0.1;
    high += 0.1;
  }
  const x = (t: number) =>
    pad.left + (t1 === t0 ? 0.5 : (t - t0) / (t1 - t0)) * (width - pad.left - pad.right);
  const y = (kg: number) =>
    pad.top + (1 - (kg - low) / (high - low)) * (height - pad.top - pad.bottom);
  const line = sorted.map((p, i) => `${x(times[i]).toFixed(1)},${y(p.kg).toFixed(1)}`).join(" ");
  const summary = sorted.map((p) => `${formatDate(p.date)}: ${formatKg(p.kg)}`).join("; ");
  return (
    <figure className="rounded-xl border bg-card p-3">
      <figcaption className="mb-1 text-xs font-medium text-muted-foreground">
        {strings.animal.weightChart}
      </figcaption>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${strings.animal.weightChart}: ${summary}`}
        className="h-auto w-full"
      >
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={y(high)}
          y2={y(high)}
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
        <line
          x1={pad.left}
          x2={width - pad.right}
          y1={y(low)}
          y2={y(low)}
          stroke="var(--border)"
          strokeDasharray="3 4"
        />
        <text x={pad.left - 6} y={y(high) + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
          {formatKg(Math.max(...kgs))}
        </text>
        <text x={pad.left - 6} y={y(low) + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
          {formatKg(Math.min(...kgs))}
        </text>
        <polyline
          points={line}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {sorted.map((p, i) => (
          <circle key={`${p.date}-${i}`} cx={x(times[i])} cy={y(p.kg)} r="3.5" fill="var(--card)" stroke="var(--primary)" strokeWidth="2" />
        ))}
        <text x={pad.left} y={height - 6} fontSize="10" fill="var(--muted-foreground)">
          {formatDate(sorted[0].date)}
        </text>
        <text x={width - pad.right} y={height - 6} textAnchor="end" fontSize="10" fill="var(--muted-foreground)">
          {formatDate(sorted[sorted.length - 1].date)}
        </text>
      </svg>
    </figure>
  );
}
