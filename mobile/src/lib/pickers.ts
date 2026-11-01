/**
 * Taking and picking files: the camera, the photo library and, for a visit's
 * PDFs, the document picker. Each answers files ready for FormData.
 */

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import type { PickedFile } from "./files";

export class PermissionDenied extends Error {}

function fromAsset(asset: ImagePicker.ImagePickerAsset, index: number): PickedFile {
  const type = asset.mimeType ?? "image/jpeg";
  const extension = type.split("/")[1] ?? "jpg";
  return {
    uri: asset.uri,
    name: asset.fileName ?? `foto-${Date.now()}-${index + 1}.${extension}`,
    type,
  };
}

/** One photo from the camera; null when the person cancels. */
export async function takePhoto(): Promise<PickedFile | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) throw new PermissionDenied("camera");
  const result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.7 });
  if (result.canceled || !result.assets[0]) return null;
  return fromAsset(result.assets[0], 0);
}

/** Photos from the library: one, or up to `limit` with `multiple`. */
export async function pickPhotos({
  multiple = false,
  limit = 6,
}: { multiple?: boolean; limit?: number } = {}): Promise<PickedFile[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.7,
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? limit : 1,
  });
  if (result.canceled) return [];
  return result.assets.map(fromAsset);
}

/** PDFs (and photos) from Files, for a visit or an exam. */
export async function pickDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/pdf", "image/*"],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    type: asset.mimeType ?? "application/pdf",
  }));
}
