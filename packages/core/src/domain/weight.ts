/**
 * The current weight's card: how much the weight changed since the weighing
 * before, and the curve of every weighing, drawn by hand by each app.
 */

export interface Weighing {
  /** An ISO day. */
  date: string;
  kg: number;
}

const byDate = (a: Weighing, b: Weighing) => a.date.localeCompare(b.date);

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** The time between two ISO days in days, months or years: "12 dias", "3 meses", "1 ano". */
export function timeBetween(from: string, to: string): string {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (months >= 12) return plural(Math.floor(months / 12), "ano", "anos");
  if (months >= 1) return plural(months, "mês", "meses");
  const days = Math.round(
    (Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000,
  );
  return plural(days, "dia", "dias");
}

/**
 * The latest weighing minus the one before, and the time between them:
 * "+0,3 kg em 3 meses", "−0,2 kg em 12 dias". Null with fewer than two.
 */
export function weightChange(weighings: Weighing[]): string | null {
  if (weighings.length < 2) return null;
  const [before, last] = [...weighings].sort(byDate).slice(-2);
  const delta = Math.round((last.kg - before.kg) * 1000) / 1000;
  const size = Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 3 });
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
  return `${sign}${size} kg em ${timeBetween(before.date, last.date)}`;
}

export interface Sparkline {
  /** The curve through the weighings, an SVG path. */
  line: string;
  /** The same curve closed down to the bottom, for the fill under it. */
  area: string;
  /** The latest weighing, the curve's last point. */
  last: { x: number; y: number };
}

/**
 * The curve of the weights in a `width` × `height` box, time to scale, with no
 * axis: a smooth line through every weighing, ending at the latest. Null with
 * fewer than two weighings, which make no curve.
 */
export function sparkline(
  weighings: Weighing[],
  width: number,
  height: number,
  pad = 6,
): Sparkline | null {
  if (weighings.length < 2) return null;
  const sorted = [...weighings].sort(byDate);
  const times = sorted.map((w) => Date.parse(`${w.date}T12:00:00Z`));
  const [t0, t1] = [times[0], times[times.length - 1]];
  const kgs = sorted.map((w) => w.kg);
  const [low, high] = [Math.min(...kgs), Math.max(...kgs)];
  const x = (t: number) =>
    t1 === t0 ? width : pad + ((t - t0) / (t1 - t0)) * (width - 2 * pad);
  const y = (kg: number) =>
    high === low
      ? height / 2
      : pad + (1 - (kg - low) / (high - low)) * (height - 2 * pad);
  const points = sorted.map((w, i) => ({ x: x(times[i]), y: y(w.kg) }));
  const r = (n: number) => Math.round(n * 10) / 10;
  // A Catmull-Rom curve through the points, as cubic Béziers.
  let line = `M${r(points[0].x)},${r(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    line += ` C${r(c1.x)},${r(c1.y)} ${r(c2.x)},${r(c2.y)} ${r(p2.x)},${r(p2.y)}`;
  }
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${r(last.x)},${height} L${r(first.x)},${height} Z`;
  return { line, area, last: { x: r(last.x), y: r(last.y) } };
}
