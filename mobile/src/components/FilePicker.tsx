import type { AttachmentOut } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { Image } from "expo-image";
import { Camera, FileText, ImageIcon, X } from "lucide-react-native";
import { Alert, Pressable, View } from "react-native";

import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import type { PickedFile } from "@/lib/files";
import { PermissionDenied, pickDocuments, pickPhotos, takePhoto } from "@/lib/pickers";
import { colors } from "@/lib/theme";

const isPdfFile = (type: string, name: string) => type === "application/pdf" || /\.pdf$/i.test(name);

/** Ask the camera for a photo, saying why when it cannot give one. */
export async function photoFromCamera(): Promise<PickedFile | null> {
  try {
    return await takePhoto();
  } catch (error) {
    Alert.alert(
      strings.intake.takePhoto,
      error instanceof PermissionDenied ? strings.native.cameraDenied : strings.native.cameraUnavailable,
    );
    return null;
  }
}

function Thumb({ uri, name, pdf, onRemove }: { uri: string; name: string; pdf: boolean; onRemove(): void }) {
  return (
    <View className="relative">
      {pdf ? (
        <View className="h-16 w-28 flex-row items-center gap-1 rounded-lg border border-border bg-muted px-2">
          <FileText color={colors.primary} size={18} />
          <Text numberOfLines={2} className="flex-shrink text-xs">
            {name}
          </Text>
        </View>
      ) : (
        <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8 }} contentFit="cover" accessibilityLabel={name} />
      )}
      <Pressable
        role="button"
        accessibilityLabel={strings.records.removeAttachment(name)}
        onPress={onRemove}
        className="absolute -right-2 -top-2 h-7 w-7 items-center justify-center rounded-full bg-foreground"
      >
        <X color="#fff" size={14} />
      </Pressable>
    </View>
  );
}

/**
 * The files a record will carry: the ones it has, and new photos (camera or
 * gallery) and, where it fits, PDFs from Files. Nothing uploads until saving.
 */
export function FilePicker({
  files,
  onChange,
  existing = [],
  onRemoveExisting,
  allowPdf,
  multiple = true,
}: {
  files: PickedFile[];
  onChange(files: PickedFile[]): void;
  existing?: AttachmentOut[];
  onRemoveExisting?(id: string): void;
  allowPdf?: boolean;
  multiple?: boolean;
}) {
  const add = (more: PickedFile[]) => onChange(multiple ? [...files, ...more] : more.slice(0, 1));
  return (
    <View className="gap-2">
      {existing.length + files.length > 0 ? (
        <View className="flex-row flex-wrap gap-3 pt-2">
          {existing.map((a) => (
            <Thumb
              key={a.id}
              uri={a.url}
              name={a.name}
              pdf={isPdfFile(a.content_type, a.name)}
              onRemove={() => onRemoveExisting?.(a.id)}
            />
          ))}
          {files.map((f, i) => (
            <Thumb
              key={`${f.uri}-${i}`}
              uri={f.uri}
              name={f.name}
              pdf={isPdfFile(f.type, f.name)}
              onRemove={() => onChange(files.filter((_, j) => j !== i))}
            />
          ))}
        </View>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          label={strings.intake.takePhoto}
          icon={<Camera color={colors.foreground} size={16} />}
          testID="take-photo"
          onPress={async () => {
            const photo = await photoFromCamera();
            if (photo) add([photo]);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          label={multiple ? strings.intake.pickPhotos : strings.animal.pickPhoto}
          icon={<ImageIcon color={colors.foreground} size={16} />}
          testID="pick-photos"
          onPress={async () => add(await pickPhotos({ multiple }))}
        />
        {allowPdf ? (
          <Button
            size="sm"
            variant="outline"
            label={strings.native.attachPdf}
            icon={<FileText color={colors.foreground} size={16} />}
            testID="pick-documents"
            onPress={async () => add(await pickDocuments())}
          />
        ) : null}
      </View>
    </View>
  );
}
