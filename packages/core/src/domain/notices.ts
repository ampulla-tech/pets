import type { NoticeOut } from "../generated/api/types.gen";
import { MONTHS } from "./format";
import { strings } from "../strings";

/** One day of the notice list: "Hoje", "Ontem", "30 de outubro". */
export interface NoticeDay {
  key: string;
  label: string;
  items: NoticeOut[];
}

function localDay(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** The day a notice was sent, said from `now`, in the device's own calendar. */
export function noticeDayLabel(sentAt: string, now: Date = new Date()): string {
  const day = localDay(new Date(sentAt));
  if (day === localDay(now)) return strings.notices.today;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (day === localDay(yesterday)) return strings.notices.yesterday;
  const [year, month, dayOfMonth] = day.split("-").map(Number);
  const label = `${dayOfMonth} de ${MONTHS[month - 1]}`;
  return year === now.getFullYear() ? label : `${label} de ${year}`;
}

/** The hour a notice was sent, "08:00". */
export function noticeTime(sentAt: string): string {
  const date = new Date(sentAt);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** The notices, newest first as the API sends them, grouped by the day they were sent. */
export function groupNotices(items: NoticeOut[], now: Date = new Date()): NoticeDay[] {
  const days: NoticeDay[] = [];
  for (const item of items) {
    const key = localDay(new Date(item.sent_at));
    const last = days[days.length - 1];
    if (last && last.key === key) last.items.push(item);
    else days.push({ key, label: noticeDayLabel(item.sent_at, now), items: [item] });
  }
  return days;
}

/** The first letter of the animal's name, for the circle beside a notice. */
export function initialOf(name: string): string {
  return name.trim().charAt(0).toUpperCase();
}
