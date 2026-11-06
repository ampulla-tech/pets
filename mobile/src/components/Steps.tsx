import type { Step } from "@pets/core/domain";
import { View } from "react-native";

import { Text } from "@/components/ui/text";

/**
 * Numbered steps, each in its own block, the number in a green circle and the
 * names on the device's screens in bold (the odd pieces of a step).
 */
export function Steps({ steps }: { steps: readonly Step[] }) {
  return (
    <View className="gap-2">
      {steps.map((pieces, index) => (
        <View
          key={index}
          testID={`step-${index + 1}`}
          className="flex-row items-start gap-2.5 rounded-lg bg-muted px-2.5 py-2"
        >
          <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Text className="text-xs font-bold text-primary-foreground">{index + 1}</Text>
          </View>
          <Text className="flex-1 text-sm leading-snug">
            {pieces.map((piece, i) =>
              i % 2 === 1 ? (
                <Text key={i} className="text-sm font-semibold">
                  {piece}
                </Text>
              ) : (
                piece
              ),
            )}
          </Text>
        </View>
      ))}
    </View>
  );
}
