import { formatDate, formatKg, sparkline, weightChange, type Weighing } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";

import { Text } from "@/components/ui/text";
import { colors } from "@/lib/theme";

const HEIGHT = 56;

/**
 * "Peso atual": the weight in large type, how much it changed since the
 * weighing before (grey: gaining or losing is neither good nor bad in itself)
 * and, beside it, the curve of every weighing, with no axis, ending at the
 * latest. One weighing is the number alone.
 */
export function WeightCard({ kg, weighings }: { kg: string; weighings: Weighing[] }) {
  const [width, setWidth] = useState(0);
  const change = weightChange(weighings);
  const curve = width > 0 ? sparkline(weighings, width, HEIGHT) : null;
  const [value, unit] = formatKg(kg).split(" ");
  const summary = [...weighings]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((w) => `${formatDate(w.date)}: ${formatKg(w.kg)}`)
    .join("; ");
  return (
    <View testID="weight-card" className="flex-row items-center gap-3.5 rounded-2xl border border-border bg-card p-3.5">
      <View>
        <Text testID="current-weight" className="text-3xl font-semibold">
          {value}
          <Text className="text-base font-medium text-muted-foreground">{` ${unit}`}</Text>
        </Text>
        {change ? (
          <View className="mt-2 self-start rounded-full bg-muted px-2 py-0.5">
            <Text className="text-xs font-semibold">{change}</Text>
          </View>
        ) : null}
      </View>
      {weighings.length > 1 ? (
        <View
          className="flex-1"
          style={{ height: HEIGHT }}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessible
          accessibilityLabel={`${strings.animal.weightChart}: ${summary}`}
          testID="weight-curve"
        >
          {curve ? (
            <Svg width={width} height={HEIGHT} style={{ overflow: "visible" }}>
              <Defs>
                <LinearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors.primary} stopOpacity={0.2} />
                  <Stop offset="1" stopColor={colors.primary} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              <Path d={curve.area} fill="url(#weight-fill)" />
              <Path d={curve.line} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeLinecap="round" />
              <Circle cx={curve.last.x} cy={curve.last.y} r={4.5} fill={colors.primary} stroke={colors.card} strokeWidth={2} />
            </Svg>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
