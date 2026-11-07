import type { NoticeOut } from "@pets/core/api/generated";
import {
  listNoticesOptions,
  readAllNoticesMutation,
  readNoticeMutation,
} from "@pets/core/api/query";
import { canOfferPush, groupNotices, initialOf, noticeTime } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { Bell, CheckCheck, Ellipsis } from "lucide-react-native";
import { useState } from "react";
import { Pressable, RefreshControl, View } from "react-native";

import { BlockedSteps, PushBanner, useDevicePush } from "@/components/DevicePush";
import { ErrorState, Loading, Notice, Screen } from "@/components/ui/screen";
import { MenuItem, Sheet } from "@/components/ui/sheet";
import { Muted, Text } from "@/components/ui/text";
import { colors } from "@/lib/theme";
import { cn } from "@/lib/utils";

const N = strings.notices;
const LISTED = 50;

/**
 * The Avisos tab: the notices the app sent, newest first by day, and the
 * notification of this phone. Opening it marks nothing read.
 */
export default function NoticesScreen() {
  const notices = useQuery(listNoticesOptions());
  const queryClient = useQueryClient();
  const push = useDevicePush();
  const [sheet, setSheet] = useState<"menu" | "blocked" | null>(null);
  const refresh = () => queryClient.invalidateQueries();
  const readOne = useMutation({ ...readNoticeMutation(), onSettled: refresh });
  const readAll = useMutation({ ...readAllNoticesMutation(), onSuccess: refresh });

  const unread = notices.data?.some((n) => !n.read) ?? false;
  const offer = canOfferPush(push.state);

  function open(notice: NoticeOut) {
    if (!notice.read) readOne.mutate({ path: { notice_id: notice.id } });
    // Inside this tab's stack, so the animal's back arrow returns here.
    router.push(notice.url.replace(/^\/animais\//, "/avisos/animal/") as never);
  }

  function onEnable() {
    if (push.state === "blocked") {
      setSheet("blocked");
    } else {
      setSheet(null);
      void push.enable();
    }
  }

  const header = (
    <Stack.Screen
      options={{
        headerRight:
          offer || unread
            ? () => (
                <Pressable
                  role="button"
                  accessibilityLabel={N.more}
                  testID="notices-more"
                  hitSlop={8}
                  onPress={() => setSheet("menu")}
                  className="px-1 active:opacity-60"
                >
                  <Ellipsis color={colors.foreground} size={22} />
                </Pressable>
              )
            : undefined,
      }}
    />
  );

  let body;
  if (notices.isPending) body = <Loading />;
  else if (notices.isError) body = <ErrorState onRetry={() => void notices.refetch()} />;
  else if (notices.data.length === 0) {
    body = (
      <View testID="notices-empty" className="items-center gap-2 px-5 py-16">
        <View className="mb-1 h-16 w-16 items-center justify-center rounded-full bg-accent">
          <Bell color={colors.primary} size={28} />
        </View>
        <Text className="font-semibold">{N.empty}</Text>
        <Muted className="text-center">{N.emptyHint}</Muted>
      </View>
    );
  } else {
    body = (
      <View className="gap-3">
        {groupNotices(notices.data).map((day) => (
          <View key={day.key} testID={`day-${day.label}`} className="gap-1.5">
            <Text
              role="heading"
              className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {day.label}
            </Text>
            <View className="overflow-hidden rounded-2xl border border-border bg-card">
              {day.items.map((notice, i) => (
                <NoticeRow
                  key={notice.id}
                  notice={notice}
                  first={i === 0}
                  onOpen={() => open(notice)}
                />
              ))}
            </View>
          </View>
        ))}
        {notices.data.length >= LISTED ? (
          <Muted className="pb-2 text-center text-xs">{N.latest(LISTED)}</Muted>
        ) : null}
      </View>
    );
  }

  return (
    <>
      {header}
      <Screen
        className="gap-3"
        refreshControl={
          <RefreshControl
            refreshing={notices.isRefetching}
            onRefresh={() => void refresh()}
          />
        }
      >
        <PushBanner push={push} />
        {push.failed ? <Notice tone="late">{strings.push.failed}</Notice> : null}
        {body}
      </Screen>
      <Sheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        testID={sheet ? `sheet-${sheet}` : undefined}
      >
        {sheet === "blocked" ? (
          <BlockedSteps onClose={() => setSheet(null)} />
        ) : (
          <View>
            {offer ? (
              <MenuItem
                label={strings.push.enable}
                icon={<Bell color={colors.foreground} size={18} />}
                testID="menu-enable-push"
                onPress={onEnable}
              />
            ) : null}
            {unread ? (
              <MenuItem
                label={N.markAllRead}
                icon={<CheckCheck color={colors.foreground} size={18} />}
                testID="menu-read-all"
                onPress={() => {
                  setSheet(null);
                  readAll.mutate({});
                }}
              />
            ) : null}
          </View>
        )}
      </Sheet>
    </>
  );
}

function NoticeRow({
  notice,
  first,
  onOpen,
}: {
  notice: NoticeOut;
  first: boolean;
  onOpen: () => void;
}) {
  const read = notice.read;
  return (
    <Pressable
      role="button"
      testID={`notice-${notice.id}`}
      accessibilityState={{ selected: !read }}
      onPress={onOpen}
      className={cn(
        "flex-row items-center gap-2.5 px-3 py-3 active:opacity-70",
        !first && "border-t border-border",
        read && "bg-muted",
      )}
    >
      <View
        testID={read ? undefined : `unread-${notice.id}`}
        accessibilityLabel={read ? undefined : N.unread}
        className={cn("h-2 w-2 rounded-full", read ? "bg-transparent" : "bg-destructive")}
      />
      <View
        className={cn(
          "h-9 w-9 items-center justify-center rounded-full bg-accent",
          read && "opacity-60",
        )}
      >
        <Text className="font-bold text-primary">{initialOf(notice.animal_name)}</Text>
      </View>
      <View className="flex-1">
        <Text
          testID={`notice-title-${notice.id}`}
          className={cn(
            "leading-snug",
            read ? "font-medium text-muted-foreground" : "font-semibold",
          )}
        >
          {notice.title}
        </Text>
        {notice.body ? (
          <Muted
            numberOfLines={1}
            className={cn("mt-0.5 text-[13px]", read && "opacity-75")}
          >
            {notice.body}
          </Muted>
        ) : null}
      </View>
      <Muted className={cn("self-start text-xs", read && "opacity-75")}>
        {noticeTime(notice.sent_at)}
      </Muted>
    </Pressable>
  );
}
