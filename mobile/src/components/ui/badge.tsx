import type { BadgeTone } from "@pets/core/domain";
import { View } from "react-native";

import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

const TONE = {
  ok: ["bg-ok-tint", "text-ok"],
  soon: ["bg-soon-tint", "text-soon"],
  late: ["bg-late-tint", "text-late"],
  none: ["bg-muted", "text-muted-foreground"],
} as const;

export function Badge({ text, tone }: { text: string; tone: BadgeTone | "none" }) {
  const [bg, fg] = TONE[tone];
  return (
    <View className={cn("self-start rounded-full px-2.5 py-1", bg)}>
      <Text className={cn("text-xs font-semibold", fg)}>{text}</Text>
    </View>
  );
}
