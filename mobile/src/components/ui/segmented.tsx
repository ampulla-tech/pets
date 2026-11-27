import { Pressable, View } from "react-native";

import { useRequiredHint } from "@/components/ui/field";
import { Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** One choice among a few, all visible (species, sex, a yes / no / unknown). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
  testID,
}: {
  options: { value: NoInfer<T>; label: string }[];
  value: T;
  onChange(value: NoInfer<T>): void;
  disabled?: boolean;
  testID?: string;
}) {
  const required = useRequiredHint();
  return (
    <View testID={testID} role="radiogroup" className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            role="radio"
            {...required}
            accessibilityState={{ selected, checked: selected, disabled }}
            aria-checked={selected}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            className={cn(
              "min-h-10 justify-center rounded-lg border px-3",
              selected ? "border-primary bg-accent" : "border-input bg-card",
              disabled && "opacity-50",
            )}
          >
            <Text className={cn("text-sm", selected ? "font-semibold text-accent-foreground" : "")}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Several choices at once (the diseases a vaccine covers). */
export function MultiSelect({
  options,
  value,
  onChange,
  testID,
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange(value: string[]): void;
  testID?: string;
}) {
  const required = useRequiredHint();
  return (
    <View testID={testID} className="flex-row flex-wrap gap-2">
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <Pressable
            key={option.value}
            role="checkbox"
            {...required}
            aria-checked={checked}
            accessibilityState={{ checked }}
            accessibilityLabel={option.label}
            onPress={() =>
              onChange(checked ? value.filter((v) => v !== option.value) : [...value, option.value])
            }
            className={cn(
              "min-h-10 justify-center rounded-full border px-3",
              checked ? "border-primary bg-primary" : "border-input bg-card",
            )}
          >
            <Text className={cn("text-sm", checked ? "font-medium text-primary-foreground" : "")}>
              {checked ? "✓ " : ""}
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
