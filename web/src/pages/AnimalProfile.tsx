import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ChevronRight,
  IdCard,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { archiveAnimal, deleteAnimal } from "@pets/core/api/generated";
import { listAnimalRemindersOptions } from "@pets/core/api/query";
import {
  animalLine,
  ARCHIVE_REASON_LABEL,
  formatBirth,
  formatDate,
  formatKg,
  groupReminders,
  groupTitle,
  type ReminderGroup,
  reminderText,
  reminderTone,
  SEX_LABEL,
  todayIso,
} from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { AnimalAvatar } from "@/components/AnimalAvatar";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ChoiceGroup, Field } from "@/components/Field";
import { EmptyText, ErrorState, Loading, Notice } from "@/components/Feedback";
import { Page, Section } from "@/components/Page";
import { RegisterSheet } from "@/components/RegisterSheet";
import { StatusBadge } from "@/components/StatusBadge";
import { WeightChart } from "@/components/WeightChart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { canWrite, isTutor, refreshAll, useAnimal, useRecords } from "@/lib/queries";
import {
  editRecordPath,
  newRecordPath,
  type AnimalOut,
  type RecordKind,
} from "@/lib/types";

const S = strings.animal;
// The action grid's buttons wrap a long label instead of overflowing a phone.
const ACTION =
  "h-auto min-h-12 whitespace-normal rounded-2xl bg-card py-2 text-center font-semibold leading-tight";

export function AnimalProfile() {
  const { id = "" } = useParams();
  const animal = useAnimal(id);
  if (animal.isPending)
    return (
      <Page title="" back="/">
        <Loading />
      </Page>
    );
  if (animal.isError)
    return (
      <Page title="" back="/">
        <ErrorState message={S.notFound} />
      </Page>
    );
  return <Profile animal={animal.data} />;
}

function Profile({ animal }: { animal: AnimalOut }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const records = useRecords(animal.id);
  const reminders = useQuery(
    listAnimalRemindersOptions({ path: { animal_id: animal.id } }),
  );
  const [params] = useSearchParams();
  const location = useLocation();
  const subject = params.get("assunto");
  // The reminder the person tapped; until then, the one a notice pointed at.
  const [picked, setPicked] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const tutor = isTutor(animal);
  const active = canWrite(animal);
  // A screen that opened the animal can say where back leads (Avisos does).
  const from = (location.state as { back?: string } | null)?.back;
  const back = from ?? (active ? "/" : "/arquivados");

  const weights = useMemo(
    () =>
      (records.data ?? []).flatMap((r) =>
        r.kind === "weight" ? [{ date: r.date, kg: Number(r.kg) }] : [],
      ),
    [records.data],
  );

  const shown = groupReminders(
    (reminders.data ?? []).filter((r) => r.state !== "closed"),
  );
  const brandOf = (recordId: string) => {
    const record = records.data?.find((r) => r.id === recordId);
    if (record?.kind === "vaccine") return record.brand;
    if (record?.kind === "antiparasitic") return record.product;
    return null;
  };

  async function onDelete() {
    setBusy(true);
    try {
      await deleteAnimal({ path: { animal_id: animal.id }, throwOnError: true });
      queryClient.clear();
      navigate("/", { replace: true });
    } catch {
      setBusy(false);
    }
  }

  const menu = tutor ? (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={S.more}>
          <MoreVertical className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        {active ? (
          <DropdownMenuItem onSelect={() => navigate(`/animais/${animal.id}/editar`)}>
            <Pencil />
            {strings.app.edit}
          </DropdownMenuItem>
        ) : null}
        {active ? (
          <DropdownMenuItem onSelect={() => setArchiving(true)}>
            <Archive />
            {S.archive}
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem
          onSelect={() => setDeleting(true)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 />
          {S.deleteAnimal}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  return (
    <Page
      title={
        <span className="flex min-w-0 items-center gap-2.5">
          <AnimalAvatar
            name={animal.name}
            species={animal.species}
            photoUrl={animal.photo_url}
            initial
            className="size-9 rounded-xl text-[0.95rem]"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-base leading-tight font-semibold">
              {animal.name}
            </span>
            <span className="truncate text-xs leading-tight font-normal tracking-normal text-muted-foreground">
              {animalLine(animal)}
            </span>
          </span>
        </span>
      }
      back={back}
      actions={menu}
    >
      {!active ? (
        <Notice tone="warn">
          {animal.archived_reason
            ? `${strings.archive.archivedOn(ARCHIVE_REASON_LABEL[animal.archived_reason], formatDate(animal.archived_on))}. `
            : ""}
          {strings.archive.readOnly}
        </Notice>
      ) : !tutor ? (
        <Notice>{S.guestNotice}</Notice>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        {active ? (
          <Button
            size="xl"
            className="col-span-2 h-12 rounded-2xl text-[0.95rem] font-semibold"
            onClick={() => setRegistering(true)}
          >
            <Plus />
            {S.addRecord}
          </Button>
        ) : null}
        <Button asChild size="xl" variant="outline" className={ACTION}>
          <Link to={`/animais/${animal.id}/carteirinha`}>
            <IdCard />
            {S.card}
          </Link>
        </Button>
        <Button asChild size="xl" variant="outline" className={ACTION}>
          <Link to={`/animais/${animal.id}/pessoas`}>
            <Users />
            {tutor ? S.people : S.tutors}
          </Link>
        </Button>
      </div>

      <Section title={S.reminders} id="reminders">
        {reminders.isPending ? null : shown.length === 0 ? (
          <EmptyText>{S.remindersEmpty}</EmptyText>
        ) : (
          <ul className="flex flex-col gap-2">
            {shown.map((group) => (
              <ReminderRow
                key={group.key}
                group={group}
                brand={brandOf(group.first.record_id)}
                highlighted={
                  picked !== null
                    ? group.key === picked
                    : subject !== null && group.subjects.includes(subject)
                }
                scrollTo={
                  picked === null && subject !== null && group.subjects.includes(subject)
                }
                onPick={() => setPicked(picked === group.key ? "" : group.key)}
                writable={active && tutor}
              />
            ))}
          </ul>
        )}
      </Section>

      <Section title={S.lastWeight} id="weight">
        {animal.last_weight ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between rounded-2xl border bg-card px-4 py-3">
              <span className="text-2xl font-semibold">
                {formatKg(animal.last_weight.kg)}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDate(animal.last_weight.date)}
              </span>
            </div>
            <WeightChart points={weights} />
          </div>
        ) : (
          <EmptyText>{S.noWeight}</EmptyText>
        )}
      </Section>

      <Section title={S.profile} id="profile">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border bg-card p-4 text-sm">
          <Fact label={S.sex} value={SEX_LABEL[animal.sex]} />
          <Fact
            label={S.neutered}
            value={
              animal.neutered === true
                ? S.yes
                : animal.neutered === false
                  ? S.no
                  : S.unknown
            }
          />
          <Fact label={S.birth} value={formatBirth(animal.birth)} />
          <Fact label={S.adoptedOn} value={formatDate(animal.adopted_on)} />
          <Fact label={S.coat} value={animal.coat || "—"} />
          <Fact label={S.microchip} value={animal.microchip || "—"} />
        </dl>
      </Section>

      <RegisterSheet
        animal={animal}
        open={registering}
        onClose={() => setRegistering(false)}
      />
      {archiving ? (
        <ArchiveDialog animal={animal} onClose={() => setArchiving(false)} />
      ) : null}
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={S.deleteAnimal}
        description={S.deleteConfirm(animal.name)}
        confirmLabel={strings.app.delete}
        destructive
        busy={busy}
        onConfirm={() => void onDelete()}
      />
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  );
}

/** The reminders one dose opened: one line, and one new dose closes them all. */
function ReminderRow({
  group,
  brand,
  highlighted,
  scrollTo,
  onPick,
  writable,
}: {
  group: ReminderGroup;
  brand: string | null;
  highlighted: boolean;
  /** Bring it into view: a notice pointed at it. */
  scrollTo: boolean;
  /** Tapping a reminder opens its actions, and tapping it again closes them. */
  onPick: () => void;
  writable: boolean;
}) {
  const reminder = group.first;
  const { title, detail } = groupTitle(group, brand);
  const [node, setNode] = useState<HTMLLIElement | null>(null);
  useEffect(() => {
    if (scrollTo && node) node.scrollIntoView?.({ block: "center", behavior: "smooth" });
  }, [scrollTo, node]);
  const tone = reminderTone(reminder.state);
  const doseKind: RecordKind = reminder.record_kind;
  return (
    <li
      ref={setNode}
      id={`assunto-${reminder.subject}`}
      aria-current={highlighted ? "true" : undefined}
      className={`flex flex-col gap-2 rounded-2xl border bg-card px-4 py-3 ${highlighted ? "subject-highlight" : ""}`}
    >
      <button
        type="button"
        onClick={onPick}
        disabled={!writable}
        aria-expanded={writable ? highlighted : undefined}
        className="flex items-center justify-between gap-3 text-left disabled:cursor-default"
      >
        <div className="min-w-0">
          <p className="font-medium">{title}</p>
          {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
          <p className="text-xs text-muted-foreground">
            {reminder.due_on ? formatDate(reminder.due_on) : strings.card.noDate}
          </p>
        </div>
        <StatusBadge tone={tone}>{reminderText(reminder)}</StatusBadge>
      </button>
      {writable && reminder.state === "no_date" ? (
        <Button asChild variant="outline" size="lg" className="self-start">
          <Link to={editRecordPath(reminder.animal_id, reminder.record_id)}>
            {strings.reminders.setDate}
            <ChevronRight />
          </Link>
        </Button>
      ) : null}
      {writable && highlighted ? (
        <Button asChild size="lg" className="self-start">
          <Link
            to={newRecordPath(
              reminder.animal_id,
              doseKind,
              `?dose=${encodeURIComponent(reminder.record_id)}`,
            )}
          >
            <Plus />
            {strings.reminders.registerDose}
          </Link>
        </Button>
      ) : null}
    </li>
  );
}

function ArchiveDialog({ animal, onClose }: { animal: AnimalOut; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<"died" | "rehomed" | "other">("other");
  const [on, setOn] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function onConfirm() {
    if (!on) {
      setFailure(strings.archive.dateRequired);
      return;
    }
    setBusy(true);
    setFailure(null);
    try {
      await archiveAnimal({
        path: { animal_id: animal.id },
        body: { reason, on },
        throwOnError: true,
      });
      await refreshAll(queryClient);
      onClose();
    } catch {
      setFailure(strings.app.genericError);
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => (open ? null : onClose())}>
      <DialogContent closeLabel={strings.app.close}>
        <DialogHeader>
          <DialogTitle>
            {strings.archive.title} {animal.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{strings.archive.intro}</p>
        </DialogHeader>
        <ChoiceGroup
          label={strings.archive.reason}
          name="archive-reason"
          value={reason}
          onChange={setReason}
          options={[
            { value: "died", label: ARCHIVE_REASON_LABEL.died },
            { value: "rehomed", label: ARCHIVE_REASON_LABEL.rehomed },
            { value: "other", label: ARCHIVE_REASON_LABEL.other },
          ]}
        />
        <Field label={strings.archive.on}>
          {(control) => (
            <Input
              {...control}
              type="date"
              value={on}
              onChange={(e) => setOn(e.target.value)}
            />
          )}
        </Field>
        {failure ? <Notice tone="error">{failure}</Notice> : null}
        <DialogFooter>
          <Button variant="outline" size="lg" onClick={onClose}>
            {strings.app.cancel}
          </Button>
          <Button size="lg" onClick={() => void onConfirm()} disabled={busy}>
            {strings.archive.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
