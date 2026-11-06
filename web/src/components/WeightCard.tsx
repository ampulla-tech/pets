import {
  formatDate,
  formatKg,
  sparkline,
  weightChange,
  type Weighing,
} from "@pets/core/domain";
import { strings } from "@pets/core/strings";

const W = 160;
const H = 56;

/**
 * "Peso atual": the weight in large type, how much it changed since the
 * weighing before (grey: gaining or losing is neither good nor bad in itself)
 * and, beside it, the curve of every weighing, with no axis, ending at the
 * latest. One weighing is the number alone.
 */
export function WeightCard({ kg, weighings }: { kg: string; weighings: Weighing[] }) {
  const change = weightChange(weighings);
  const curve = sparkline(weighings, W, H);
  const [value, unit] = formatKg(kg).split(" ");
  const summary = [...weighings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => `${formatDate(w.date)}: ${formatKg(w.kg)}`)
    .join("; ");
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border bg-card p-3.5">
      <div className="shrink-0">
        <p className="text-[1.75rem] leading-none font-semibold tracking-tight">
          {value}
          <span className="ml-0.5 text-[0.95rem] font-medium text-muted-foreground">
            {unit}
          </span>
        </p>
        {change ? (
          <span className="mt-2 inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
            {change}
          </span>
        ) : null}
      </div>
      {curve ? (
        <div
          className="relative h-14 min-w-0 flex-1"
          role="img"
          aria-label={`${strings.animal.weightChart}: ${summary}`}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            preserveAspectRatio="none"
            className="block size-full overflow-visible"
            aria-hidden
          >
            <defs>
              <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="var(--primary)" stopOpacity="0.2" />
                <stop offset="1" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={curve.area} fill="url(#weight-fill)" />
            <path
              d={curve.line}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {/* The latest weighing, outside the stretched SVG so it stays round. */}
          <span
            aria-hidden
            className="absolute size-[11px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary"
            style={{
              left: `${(curve.last.x / W) * 100}%`,
              top: `${(curve.last.y / H) * 100}%`,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
