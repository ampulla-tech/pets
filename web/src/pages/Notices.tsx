import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";
import { Bell, Ellipsis } from "lucide-react";
import {
  listNoticesOptions,
  readAllNoticesMutation,
  readNoticeMutation,
} from "@pets/core/api/query";
import { canOfferPush, groupNotices, initialOf, noticeTime } from "@pets/core/domain";
import type { NoticeOut } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";
import { PushBanner, PushSheet, useDevicePush } from "@/components/DevicePush";
import { ErrorState, Loading } from "@/components/Feedback";
import { Page } from "@/components/Page";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const N = strings.notices;
const LISTED = 50;

/**
 * The Avisos tab: the notices the app sent, newest first by day, and the
 * notification of this device. Opening it marks nothing read.
 */
export function Notices() {
  const notices = useQuery(listNoticesOptions());
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const push = useDevicePush();
  const [sheet, setSheet] = useState<"blocked" | "install" | null>(null);
  const refresh = () => queryClient.invalidateQueries();
  const readOne = useMutation({ ...readNoticeMutation(), onSettled: refresh });
  const readAll = useMutation({ ...readAllNoticesMutation(), onSuccess: refresh });

  const unread = notices.data?.some((n) => !n.read) ?? false;
  const offer = canOfferPush(push.state);

  function open(notice: NoticeOut) {
    if (!notice.read) readOne.mutate({ path: { notice_id: notice.id } });
    // The animal's back arrow returns here, where the person came from.
    navigate(notice.url, { state: { back: "/avisos" } });
  }

  function onEnable() {
    if (push.state === "blocked") setSheet("blocked");
    else if (push.state === "ios-install") setSheet("install");
    else void push.enable();
  }

  const menu =
    offer || unread ? (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={N.more}>
            <Ellipsis className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {offer ? (
            <DropdownMenuItem onSelect={onEnable}>
              <Bell />
              {strings.push.enable}
            </DropdownMenuItem>
          ) : null}
          {unread ? (
            <DropdownMenuItem onSelect={() => readAll.mutate({})}>
              {N.markAllRead}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  let body;
  if (notices.isPending) body = <Loading />;
  else if (notices.isError) body = <ErrorState onRetry={() => void notices.refetch()} />;
  else if (notices.data.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-2 px-5 py-16 text-center">
        <span className="mb-1 flex size-16 items-center justify-center rounded-full bg-accent text-primary">
          <Bell className="size-7" aria-hidden />
        </span>
        <p className="text-base font-semibold">{N.empty}</p>
        <p className="text-sm text-muted-foreground">{N.emptyHint}</p>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-3">
        {groupNotices(notices.data).map((day) => (
          <section key={day.key} aria-label={day.label} className="flex flex-col gap-1.5">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {day.label}
            </h2>
            <ul className="overflow-hidden rounded-2xl border bg-card">
              {day.items.map((notice) => (
                <li key={notice.id} className="border-t first:border-t-0">
                  <NoticeRow notice={notice} onOpen={() => open(notice)} />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {notices.data.length >= LISTED ? (
          <p className="pb-2 text-center text-xs text-muted-foreground">
            {N.latest(LISTED)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Page title={N.title} actions={menu} className="gap-3">
      <PushBanner push={push} />
      {body}
      <PushSheet kind={sheet} onClose={() => setSheet(null)} />
    </Page>
  );
}

function NoticeRow({ notice, onOpen }: { notice: NoticeOut; onOpen: () => void }) {
  const read = notice.read;
  return (
    <button
      type="button"
      onClick={onOpen}
      data-read={read || undefined}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/60",
        read && "bg-muted",
      )}
    >
      <span
        aria-label={read ? undefined : N.unread}
        className={cn(
          "size-2 shrink-0 rounded-full",
          read ? "bg-transparent" : "bg-destructive",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "flex size-9.5 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-primary",
          read && "opacity-60",
        )}
      >
        {initialOf(notice.animal_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block leading-snug",
            read ? "font-medium text-muted-foreground" : "font-semibold",
          )}
        >
          {notice.title}
        </span>
        {notice.body ? (
          <span
            className={cn(
              "mt-0.5 block truncate text-[0.8rem] text-muted-foreground",
              read && "opacity-75",
            )}
          >
            {notice.body}
          </span>
        ) : null}
      </span>
      <span
        className={cn(
          "self-start text-xs whitespace-nowrap text-muted-foreground tabular-nums",
          read && "opacity-75",
        )}
      >
        {noticeTime(notice.sent_at)}
      </span>
    </button>
  );
}
