import { createContext, useContext, type ReactNode } from "react";
import { View } from "react-native";

import { Muted, Text } from "@/components/ui/text";
import { strings } from "@pets/core/strings";

const RequiredContext = createContext(false);

/**
 * What a control inside a required Field puts on itself so a screen reader
 * announces it as required: React Native has no required state, so the
 * control carries it as its hint. Empty outside a required Field.
 */
export function useRequiredHint(): { accessibilityHint?: string } {
  return useContext(RequiredContext) ? { accessibilityHint: strings.app.required } : {};
}

/**
 * A form field: its label, the control, a hint and the error under it. A
 * required field shows a `*` after its label, hidden from screen readers; an
 * optional one shows nothing.
 */
export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <View className="gap-1.5">
      {/* The mark is a sibling of the label, not inside it, so the label's text stays the label alone. */}
      <View className="flex-row gap-1">
        <Text className="text-sm font-medium">{label}</Text>
        {required ? (
          <Text
            testID={`required-${label}`}
            className="text-sm font-medium text-destructive"
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            *
          </Text>
        ) : null}
      </View>
      <RequiredContext.Provider value={!!required}>{children}</RequiredContext.Provider>
      {hint && !error ? <Muted>{hint}</Muted> : null}
      {error ? (
        <Text role="alert" className="text-sm text-late">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
