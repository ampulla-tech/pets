import { Link } from "react-router";
import { ChevronRight } from "lucide-react";
import { formatDate, reminderText, reminderTone } from "@pets/core/domain";
import type { ReminderOut } from "@pets/core/api/generated";
import { StatusBadge } from "./StatusBadge";

interface Group {
  key: string;
  first: ReminderOut;
  labels: string[];
}

/**
 * The reminders of one dose that fall on one day (a combined vaccine covers
 * several diseases) read as one line.
 */
export function groupReminders(items: ReminderOut[]): Group[] {
  const groups = new Map<string, Group>();
  for (const item of items) {
    const key = `${item.animal_id}|${item.record_id}|${item.due_on}|${item.state}`;
    const group = groups.get(key);
    if (group) group.labels.push(item.subject_label);
    else groups.set(key, { key, first: item, labels: [item.subject_label] });
  }
  return [...groups.values()];
}

/** "Próximos": what is overdue and what falls due within 30 days, by date. */
export function UpcomingList({ items }: { items: ReminderOut[] }) {
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
      {groupReminders(items).map(({ key, first, labels }) => (
        <li key={key}>
          <Link
            to={`/animais/${first.animal_id}?assunto=${encodeURIComponent(first.subject)}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60"
          >
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{first.animal_name}</p>
              <p className="text-sm text-muted-foreground">{labels.join(", ")}</p>
              <p className="text-xs text-muted-foreground">{formatDate(first.due_on)}</p>
            </div>
            <StatusBadge
              tone={reminderTone(first.state) as "ok" | "soon" | "late" | "none"}
            >
              {reminderText(first)}
            </StatusBadge>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );
}
