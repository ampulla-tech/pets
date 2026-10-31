import { formatDate, formatKg } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

import { Muted } from "@/components/ui/text";
import { colors } from "@/lib/theme";

export interface WeightPoint {
  date: string;
  kg: number;
}

const WIDTH = 320;
const HEIGHT = 140;
const PAD = { top: 16, right: 16, bottom: 22, left: 36 };

/** The weights over time, oldest to newest, as a line; a single weight is a dot. */
export function WeightChart({ points }: { points: WeightPoint[] }) {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const times = sorted.map((p) => new Date(`${p.date}T12:00:00`).getTime());
  const kgs = sorted.map((p) => p.kg);
  const [t0, t1] = [Math.min(...times), Math.max(...times)];
  const low = Math.min(...kgs);
  const high = Math.max(...kgs);
  const span = high - low || Math.max(high * 0.1, 0.5);
  const [k0, k1] = [low - span * 0.15, high + span * 0.15];
  const x = (t: number) =>
    t1 === t0 ? WIDTH / 2 : PAD.left + ((t - t0) / (t1 - t0)) * (WIDTH - PAD.left - PAD.right);
  const y = (kg: number) => PAD.top + (1 - (kg - k0) / (k1 - k0)) * (HEIGHT - PAD.top - PAD.bottom);
  const line = sorted.map((p, i) => `${x(times[i])},${y(p.kg)}`).join(" ");
  const summary = sorted.map((p) => `${formatDate(p.date)}: ${formatKg(p.kg)}`).join("; ");

  return (
    <View accessible accessibilityLabel={`${strings.animal.weightChart}. ${summary}`} testID="weight-chart">
      <Muted>{strings.animal.weightChart}</Muted>
      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <Line x1={PAD.left} y1={HEIGHT - PAD.bottom} x2={WIDTH - PAD.right} y2={HEIGHT - PAD.bottom} stroke={colors.border} />
        <SvgText x={4} y={y(high) + 4} fontSize={10} fill={colors["muted-foreground"]}>
          {formatKg(high).replace(" kg", "")}
        </SvgText>
        {low !== high ? (
          <SvgText x={4} y={y(low) + 4} fontSize={10} fill={colors["muted-foreground"]}>
            {formatKg(low).replace(" kg", "")}
          </SvgText>
        ) : null}
        <SvgText x={PAD.left} y={HEIGHT - 6} fontSize={10} fill={colors["muted-foreground"]}>
          {formatDate(sorted[0].date)}
        </SvgText>
        {sorted.length > 1 ? (
          <SvgText x={WIDTH - PAD.right} y={HEIGHT - 6} fontSize={10} textAnchor="end" fill={colors["muted-foreground"]}>
            {formatDate(sorted[sorted.length - 1].date)}
          </SvgText>
        ) : null}
        {sorted.length > 1 ? <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={2.5} /> : null}
        {sorted.map((p, i) => (
          <Circle key={`${p.date}-${i}`} cx={x(times[i])} cy={y(p.kg)} r={4} fill={colors.primary} />
        ))}
      </Svg>
    </View>
  );
}
