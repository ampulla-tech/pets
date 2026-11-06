import type { ReactNode } from "react";
import { useState } from "react";
import { View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import { Muted } from "@/components/ui/text";
import { colors } from "@/lib/theme";

/**
 * An empty section that leads to what fills it: its text, and the button
 * centred below. The dashed border is drawn in SVG, because React Native's
 * `dashed` border cannot set the length of its dashes: 9 on, 7 off, 1.5 px,
 * radius 16.
 */
export function DashedBox({ children, action, testID }: { children: string; action?: ReactNode; testID?: string }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      testID={testID}
      className="items-center gap-2 rounded-2xl bg-card p-3"
      onLayout={(e) => setSize(e.nativeEvent.layout)}
    >
      {size.width > 0 ? (
        <Svg width={size.width} height={size.height} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
          <Rect
            x={0.75}
            y={0.75}
            width={size.width - 1.5}
            height={size.height - 1.5}
            rx={16}
            ry={16}
            fill="none"
            stroke={colors.input}
            strokeWidth={1.5}
            strokeDasharray="9 7"
            strokeLinecap="round"
          />
        </Svg>
      ) : null}
      <Muted className="text-center">{children}</Muted>
      {action}
    </View>
  );
}
