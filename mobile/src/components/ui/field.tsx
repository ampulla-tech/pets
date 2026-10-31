import type { ReactNode } from "react";
import { View } from "react-native";

import { Muted, Text } from "@/components/ui/text";
import { strings } from "@pets/core/strings";

/** A form field: its label, the control, a hint and the error under it. */
export function Field({
  label,
  optional,
  hint,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-medium">
        {label}
        {optional ? <Text className="text-sm text-muted-foreground"> ({strings.app.optional})</Text> : null}
      </Text>
      {children}
      {hint && !error ? <Muted>{hint}</Muted> : null}
      {error ? (
        <Text role="alert" className="text-sm text-late">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
