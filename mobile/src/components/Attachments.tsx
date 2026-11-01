import type { AttachmentOut } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { Image } from "expo-image";
import { FileText, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/ui/text";
import { isPdf, openInBrowser } from "@/lib/sharing";
import { colors } from "@/lib/theme";

/**
 * A record's attachments: a photo opens full screen in the app, a PDF in the
 * in-app browser, both through the signed link the API gave.
 */
export function AttachmentList({ attachments }: { attachments: AttachmentOut[] }) {
  const [open, setOpen] = useState<AttachmentOut | null>(null);
  if (attachments.length === 0) return null;
  return (
    <View className="flex-row flex-wrap gap-2">
      {attachments.map((attachment) =>
        isPdf(attachment) ? (
          <Pressable
            key={attachment.id}
            role="link"
            accessibilityLabel={attachment.name}
            onPress={() => void openInBrowser(attachment.url)}
            className="h-16 max-w-48 flex-row items-center gap-2 rounded-lg border border-border bg-muted px-3"
          >
            <FileText color={colors.primary} size={20} />
            <Text numberOfLines={2} className="flex-shrink text-sm">
              {attachment.name}
            </Text>
          </Pressable>
        ) : (
          <Pressable
            key={attachment.id}
            role="button"
            accessibilityLabel={attachment.name}
            onPress={() => setOpen(attachment)}
          >
            <Image source={{ uri: attachment.url }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" />
          </Pressable>
        ),
      )}
      <PhotoViewer attachment={open} onClose={() => setOpen(null)} />
    </View>
  );
}

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
