import { formatDate, groupTitle, reminderText, reminderTone, type ReminderGroup } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { Pressable, View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Muted, Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * The reminders one dose opened, as one line: the vaccine (by its brand when
 * known) and the diseases it covers, or the animal and the diseases on the home.
 */
export function ReminderRow({
  group,
  brand,
  showAnimal,
  onPress,
  highlighted,
}: {
  group: ReminderGroup;
  brand?: string | null;
  showAnimal?: boolean;
  onPress?: () => void;
  highlighted?: boolean;
}) {
  const reminder = group.first;
  const tone = reminderTone(reminder.state);
  const named = groupTitle(group, brand);
  const title = showAnimal ? `${reminder.animal_name} · ${group.labels.join(", ")}` : named.title;
  const detail = showAnimal ? null : named.detail;
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
        {detail ? <Muted>{detail}</Muted> : null}
        {reminder.due_on ? <Muted>{strings.reminders.upcomingAt(formatDate(reminder.due_on))}</Muted> : null}
      </View>
      <Badge text={reminderText(reminder)} tone={tone} />
    </Pressable>
  );
}
