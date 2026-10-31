import { Input } from "@/components/ui/input";
import { maskDay, maskMonth } from "@/lib/dates";

type Props = {
  value: string;
  onChange(text: string): void;
  testID?: string;
  invalid?: boolean;
};

/** A day typed as DD/MM/AAAA. */
export function DateInput({ value, onChange, testID, invalid }: Props) {
  return (
    <Input
      testID={testID}
      value={value}
      onChangeText={(text) => onChange(maskDay(text))}
      placeholder="DD/MM/AAAA"
      keyboardType="number-pad"
      maxLength={10}
      invalid={invalid}
    />
  );
}

/** A month typed as MM/AAAA. */
export function MonthInput({ value, onChange, testID, invalid }: Props) {
  return (
    <Input
      testID={testID}
      value={value}
      onChangeText={(text) => onChange(maskMonth(text))}
      placeholder="MM/AAAA"
      keyboardType="number-pad"
      maxLength={7}
      invalid={invalid}
    />
  );
}
