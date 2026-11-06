import type { AttachmentOut } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { Image } from "expo-image";
import { X } from "lucide-react-native";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** A stored photo, full screen in the app, through the signed link the API gave. */
export function PhotoViewer({ attachment, onClose }: { attachment: AttachmentOut | null; onClose(): void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={!!attachment} animationType="fade" onRequestClose={onClose} transparent>
      <View className="flex-1 bg-black" testID="photo-viewer">
        {attachment ? (
          <Image source={{ uri: attachment.url }} style={{ flex: 1 }} contentFit="contain" accessibilityLabel={attachment.name} />
        ) : null}
        <Pressable
          role="button"
          accessibilityLabel={strings.app.close}
          onPress={onClose}
          style={{ position: "absolute", top: insets.top + 8, right: 16 }}
          className="h-11 w-11 items-center justify-center rounded-full bg-black/60"
        >
          <X color="#fff" size={22} />
        </Pressable>
      </View>
    </Modal>
  );
}
