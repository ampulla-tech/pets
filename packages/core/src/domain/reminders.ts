import type { ReminderOut } from "../generated/api/types.gen";
import { formatDate, RECORD_KIND_LABEL } from "./format";

/**
 * The reminders one dose opened for one day, read as one line.
 *
 * The server keeps a reminder per disease (a combined vaccine covers several),
 * because a disease is what stays the same across brands. The person thinks in
 * doses: the vaccine the vet gave. So every surface groups the reminders of one
 * record that share a day and a state, and a new dose closes them together.
 */
export interface ReminderGroup {
  key: string;
  /** The group's first reminder: its animal, record, day and state. */
  first: ReminderOut;
  subjects: string[];
  labels: string[];
}

export function groupReminders(items: ReminderOut[]): ReminderGroup[] {
  const groups = new Map<string, ReminderGroup>();
  for (const item of items) {
    const key = `${item.animal_id}|${item.record_id}|${item.due_on}|${item.state}`;
    const group = groups.get(key);
    if (group) {
      group.subjects.push(item.subject);
      group.labels.push(item.subject_label);
    } else {
      groups.set(key, {
        key,
        first: item,
        subjects: [item.subject],
        labels: [item.subject_label],
      });
    }
  }
  return [...groups.values()];
}

/**
 * What a group is called: the brand the vet used when it is known, else the
 * one disease, else the dose by its day ("Vacina de 06/11/2025"). `detail` is
 * the diseases, when the name is not already them.
 */
export function groupTitle(
  group: ReminderGroup,
  brand?: string | null,
): { title: string; detail: string | null } {
  const diseases = group.labels.join(", ");
  const name = brand?.trim();
  if (name) return { title: name, detail: diseases };
  if (group.labels.length === 1) return { title: diseases, detail: null };
  const kind = RECORD_KIND_LABEL[group.first.record_kind];
  return { title: `${kind} de ${formatDate(group.first.dose_date)}`, detail: diseases };
}
