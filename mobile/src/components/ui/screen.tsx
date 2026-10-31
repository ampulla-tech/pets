import type { ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/button";
import { Muted, Text } from "@/components/ui/text";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { strings } from "@pets/core/strings";

/** A scrolling screen body, clear of the home indicator, that the keyboard does not cover. */
export function Screen({
  children,
  className,
  refreshControl,
  testID,
}: {
  children: ReactNode;
  className?: string;
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      <ScrollView
        testID={testID}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        <View className={cn("gap-4 p-4", className)}>{children}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function Loading() {
  return (
    <View className="flex-1 items-center justify-center bg-background p-8" accessibilityLabel={strings.app.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View className="flex-1 items-center justify-center gap-3 bg-background p-8">
      <Text className="text-center">{message ?? strings.app.genericError}</Text>
      {onRetry ? <Button variant="outline" label={strings.app.retry} onPress={onRetry} /> : null}
    </View>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <View className="gap-2">
      <View className="flex-row items-center justify-between">
        <Text role="heading" className="text-lg font-semibold">
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Notice({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "late" | "soon" }) {
  return (
    <View
      className={cn(
        "rounded-lg p-3",
        tone === "late" ? "bg-late-tint" : tone === "soon" ? "bg-soon-tint" : "bg-muted",
      )}
    >
      {typeof children === "string" ? <Muted className={tone === "late" ? "text-late" : ""}>{children}</Muted> : children}
    </View>
  );
}
