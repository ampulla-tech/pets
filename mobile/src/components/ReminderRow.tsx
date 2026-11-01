import type { ReminderOut } from "@pets/core/api/generated";
import { formatDate, reminderText, reminderTone } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { Pressable, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Muted, Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/** A reminder: its subject (and animal, on the home), its state, its day. */
export function ReminderRow({
  reminder,
  showAnimal,
  onPress,
  highlighted,
}: {
  reminder: ReminderOut;
  showAnimal?: boolean;
  onPress?: () => void;
  highlighted?: boolean;
}) {
  const tone = reminderTone(reminder.state);
  const title = showAnimal ? `${reminder.animal_name} · ${reminder.subject_label}` : reminder.subject_label;
  return (
    <Pressable
      role={onPress ? "button" : undefined}
      disabled={!onPress}
      onPress={onPress}
      testID={`reminder-${reminder.animal_name}-${reminder.subject}`}
      className={cn(
        "flex-row items-center gap-3 rounded-lg border bg-card p-3",
        highlighted ? "border-primary" : "border-border",
      )}
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        {reminder.due_on ? <Muted>{strings.reminders.upcomingAt(formatDate(reminder.due_on))}</Muted> : null}
      </View>
      <Badge text={reminderText(reminder)} tone={tone} />
    </Pressable>
  );
}
