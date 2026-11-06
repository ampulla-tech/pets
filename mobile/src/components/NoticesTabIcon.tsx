import { getUnreadOptions } from "@pets/core/api/query";
import { strings } from "@pets/core/strings";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react-native";
import { useEffect } from "react";
import { AppState, View, type ColorValue } from "react-native";

/**
 * The Avisos tab's icon, with a dot (never a count) while a notice is unread.
 * Asked again whenever the app comes back to the foreground.
 */
export function NoticesTabIcon({
  Icon,
  color,
  size,
}: {
  Icon: LucideIcon;
  color: ColorValue;
  size: number;
}) {
  const unread = useQuery(getUnreadOptions());
  const { refetch } = unread;

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") void refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  return (
    <View>
      <Icon color={color} size={size} />
      {unread.data?.unread ? (
        <View
          testID="unread-dot"
          role="status"
          accessibilityLabel={strings.tabs.unread}
          className="absolute -right-1 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive"
        />
      ) : null}
    </View>
  );
}
