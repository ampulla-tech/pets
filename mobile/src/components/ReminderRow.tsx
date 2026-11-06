import {
  formatDate,
  groupTitle,
  reminderText,
  reminderTone,
  type ReminderGroup,
} from "@pets/core/domain";
import { View } from "react-native";

import { Badge } from "@/components/ui/badge";
import { Muted, Text } from "@/components/ui/text";
import { cn } from "@/lib/utils";

/**
 * The reminders one dose opened, as one line: the vaccine (by its brand when
 * known), the diseases it covers and the day it falls due.
 */
export function ReminderRow({
  group,
  brand,
  highlighted,
}: {
  group: ReminderGroup;
  brand?: string | null;
  highlighted?: boolean;
}) {
  const reminder = group.first;
  const tone = reminderTone(reminder.state);
  const { title, detail } = groupTitle(group, brand);
  return (
    <View
      testID={`reminder-${reminder.animal_name}-${reminder.subject}`}
      className={cn(
        "flex-row items-center gap-3 rounded-lg border bg-card p-3",
        highlighted ? "border-primary" : "border-border",
      )}
    >
      <View className="flex-1 gap-0.5">
        <Text className="font-medium">{title}</Text>
        {detail ? <Muted>{detail}</Muted> : null}
        {reminder.due_on ? <Muted>{formatDate(reminder.due_on)}</Muted> : null}
      </View>
      <Badge text={reminderText(reminder)} tone={tone} />
    </View>
  );
}
