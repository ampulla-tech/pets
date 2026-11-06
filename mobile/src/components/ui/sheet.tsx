import type { ReactNode } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { strings } from "@pets/core/strings";

/** A sheet from the bottom of the screen, over a dimmed backdrop that closes it. */
export function Sheet({
  visible,
  onClose,
  children,
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable
          role="button"
          accessibilityLabel={strings.app.close}
          onPress={onClose}
          className="absolute inset-0 bg-black/40"
        />
        <View
          testID={testID}
          className="gap-3 rounded-t-2xl bg-background px-5 pt-3"
          style={{ paddingBottom: insets.bottom + 20 }}
        >
          <View className="h-1.5 w-10 self-center rounded-full bg-border" />
          {children}
        </View>
      </View>
    </Modal>
  );
}
