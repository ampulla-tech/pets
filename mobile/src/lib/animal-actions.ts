import { deleteAnimal } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { Alert } from "react-native";

/** Ask before deleting the animal for good, then go home. */
export function confirmDeleteAnimal(id: string, name: string, after: () => void) {
  Alert.alert(strings.animal.deleteAnimal, strings.animal.deleteConfirm(name), [
    { text: strings.app.cancel, style: "cancel" },
    {
      text: strings.app.delete,
      style: "destructive",
      onPress: async () => {
        try {
          await deleteAnimal({ path: { animal_id: id }, throwOnError: true });
          after();
        } catch {
          Alert.alert(strings.animal.deleteAnimal, strings.app.genericError);
        }
      },
    },
  ]);
}
