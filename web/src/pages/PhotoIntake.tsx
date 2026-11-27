import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ImagePlus, Loader2, RotateCcw, X } from "lucide-react";
import {
  confirmProposal,
  createExtraction,
  discardProposal,
  retryExtraction,
  type ConfirmIn,
  type ExtractionOut,
  type ProposalOut,
  type VaccineIn,
} from "@pets/core/api/generated";
import { getExtractionOptions, getExtractionQueryKey } from "@pets/core/api/query";
import {
  parseKg,
  PARASITE_LABEL,
  RECORD_KIND_LABEL,
} from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { ChoiceGroup, Field, Legend } from "@/components/Field";
import { ErrorState, Loading, Notice } from "@/components/Feedback";
import { Page } from "@/components/Page";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { monthValue } from "@/lib/dates";
import { refreshAll, useAnimal, useCatalog } from "@/lib/queries";
import { newRecordPath, type AnimalOut } from "@/lib/types";

const I = strings.intake;
const R = strings.records;
const MAX_PHOTOS = 6;

/**
 * `/animais/:id/foto`: photos of a card page → the reading → one line per
 * proposed record, each confirmed or discarded by the tutor. The model only
 * proposes; nothing is written without a tap (ADR-0005). The reading's id
 * rides in the address (`?leitura=`), so a reload picks it up again.
 */
export function PhotoIntake() {
  const { id = "" } = useParams();
  const animal = useAnimal(id);
  const [params] = useSearchParams();
  const extractionId = params.get("leitura");
  const back = `/animais/${id}`;
  return (
    <Page title={I.title} back={back}>
      {animal.isPending ? (
        <Loading />
      ) : animal.isError ? (
        <ErrorState message={strings.animal.notFound} />
      ) : extractionId ? (
        <Reading animal={animal.data} extractionId={extractionId} />
      ) : (
        <Picker animal={animal.data} />
      )}
    </Page>
  );
}

function Picker({ animal }: { animal: AnimalOut }) {
  const [, setParams] = useSearchParams();
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((url) => URL.revokeObjectURL(url)), [previews]);

  function add(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const next = [...files, ...picked];
    setFailure(next.length > MAX_PHOTOS ? I.tooMany : null);
    setFiles(next.slice(0, MAX_PHOTOS));
  }

  async function send() {
    setBusy(true);
    setFailure(null);
    try {
      const { data } = await createExtraction({
        path: { animal_id: animal.id },
        body: { files },
        throwOnError: true,
      });
      setParams({ leitura: data.id }, { replace: true });
    } catch {
      setFailure(I.uploadFailed);
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-muted-foreground">{I.intro}</p>
      <div className="grid grid-cols-2 gap-2">
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label={I.takePhoto}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={gallery}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          aria-label={I.pickPhotos}
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="xl"
          onClick={() => camera.current?.click()}
        >
          <Camera />
          {I.takePhoto}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="xl"
          onClick={() => gallery.current?.click()}
        >
          <ImagePlus />
          {I.pickPhotos}
        </Button>
      </div>
      {files.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{I.photosPicked(files.length)}</p>
          <ul className="grid grid-cols-3 gap-2">
            {files.map((file, index) => (
              <li key={`${file.name}-${index}`} className="relative">
                <img
                  src={previews[index]}
                  alt=""
                  className="aspect-square w-full rounded-xl border object-cover"
                />
                <button
                  type="button"
                  aria-label={I.removePhoto(index + 1)}
                  onClick={() => setFiles(files.filter((_, i) => i !== index))}
                  className="absolute top-1 right-1 flex size-7 items-center justify-center rounded-full bg-background/90 shadow"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {failure ? <Notice tone="error">{failure}</Notice> : null}
      <Button size="xl" disabled={!files.length || busy} onClick={() => void send()}>
        {busy ? <Loader2 className="animate-spin" /> : null}
        {busy ? I.uploading : I.send}
      </Button>
    </div>
  );
}

function Reading({ animal, extractionId }: { animal: AnimalOut; extractionId: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const options = getExtractionOptions({ path: { extraction_id: extractionId } });
  const extraction = useQuery({
    ...options,
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 2000 : false,
  });
  const [retrying, setRetrying] = useState(false);

  if (extraction.isPending) return <Loading label={I.processing} />;
  if (extraction.isError) return <ErrorState onRetry={() => void extraction.refetch()} />;
  const data = extraction.data;

  if (data.status === "processing") {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Loader2 className="size-8 animate-spin text-primary" aria-hidden />
        <p role="status" className="text-lg">
          {I.processing}
        </p>
        <Photos extraction={data} />
      </div>
    );
  }

  if (data.status === "failed") {
    const reason =
      data.error === "unconfigured"
        ? I.failedUnconfigured
        : data.error === "nothing_read"
          ? I.failedNothing
          : I.failedProvider;
    async function retry() {
      setRetrying(true);
      try {
        const { data: next } = await retryExtraction({
          path: { extraction_id: extractionId },
          throwOnError: true,
        });
        queryClient.setQueryData(
          getExtractionQueryKey({ path: { extraction_id: extractionId } }),
          next,
        );
      } finally {
        setRetrying(false);
      }
    }
    return (
      <div className="flex flex-col gap-5">
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-2xl border border-late/30 bg-late-tint p-4 text-late"
        >
          <p className="font-semibold">{I.failedTitle}</p>
          <p className="text-sm">{reason}</p>
        </div>
        <Photos extraction={data} />
        <div className="flex flex-col gap-2">
          <Button
            size="xl"
            variant="outline"
            onClick={() => void retry()}
            disabled={retrying}
          >
            <RotateCcw />
            {strings.app.retry}
          </Button>
          <Button asChild size="xl">
            <Link to={newRecordPath(animal.id, "vaccine", `?leitura=${extractionId}`)}>
              {I.fillByHand}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const pending = data.proposals.filter((p) => p.review === "pending").length;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">{I.reviewTitle}</h2>
        <p className="text-sm text-muted-foreground">{I.reviewIntro}</p>
      </div>
      <Photos extraction={data} />
      {data.proposals.length === 0 ? <Notice>{I.noLines}</Notice> : null}
      <ol className="flex flex-col gap-4">
        {data.proposals.map((proposal) => (
          <li key={proposal.index}>
            <ProposalCard
              animal={animal}
              extractionId={extractionId}
              proposal={proposal}
              onDone={async (next) => {
                if (next) queryClient.setQueryData(options.queryKey, next);
                else await extraction.refetch();
                await refreshAll(queryClient);
              }}
            />
          </li>
        ))}
      </ol>
      {data.proposals.length > 0 && pending === 0 ? (
        <div className="flex flex-col gap-3">
          <Notice tone="ok">{I.allReviewed}</Notice>
          <Button size="xl" onClick={() => navigate(`/animais/${animal.id}`)}>
            {I.done}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Photos({ extraction }: { extraction: ExtractionOut }) {
  if (!extraction.photos.length) return null;
  return (
    <ul className="flex gap-2 overflow-x-auto">
      {extraction.photos.map((photo) => (
        <li key={photo.id} className="shrink-0">
          <a href={photo.url} target="_blank" rel="noreferrer">
            <img
              src={photo.url}
              alt={photo.name}
              className="size-20 rounded-xl border object-cover"
            />
          </a>
        </li>
      ))}
    </ul>
  );
}

function Unread() {
  return (
    <StatusBadge tone="soon" className="self-start">
      {I.unread}
    </StatusBadge>
  );
}

interface Draft {
  date: string;
  brand: string;
  lot: string;
  lotExpiry: string;
  diseases: string[];
  repeatOn: string;
  vetName: string;
  vetCrmv: string;
  dose: string;
  kg: string;
  parasite: "internal" | "external" | "";
}

function draftOf(p: ProposalOut): Draft {
  const parasite = p.diseases.value[0];
  return {
    date: p.date.value ?? "",
    brand: p.brand.value ?? "",
    lot: p.lot.value ?? "",
    // The month picker's own value, "2027-09": the reading gives no other form.
    lotExpiry: p.lot_expiry.value ?? "",
    diseases: p.kind === "vaccine" ? p.diseases.value : [],
    repeatOn: p.repeat_on.value ?? "",
    vetName: p.vet_name.value ?? "",
    vetCrmv: p.vet_crmv.value ?? "",
    dose: p.dose.value ?? "",
    kg: p.weight_kg.value ? String(p.weight_kg.value).replace(".", ",") : "",
    parasite: parasite === "internal" || parasite === "external" ? parasite : "",
  };
}

/** One proposed line: every field editable, the unread ones empty and marked. */
function ProposalCard({
  animal,
  extractionId,
  proposal,
  onDone,
}: {
  animal: AnimalOut;
  extractionId: string;
  proposal: ProposalOut;
  onDone: (next?: ExtractionOut) => Promise<void>;
}) {
  const catalog = useCatalog();
  const [draft, setDraft] = useState<Draft>(() => draftOf(proposal));
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(false);
  const kindLabel = RECORD_KIND_LABEL[proposal.kind];
  const title = I.lineTitle(proposal.index + 1, kindLabel);

  if (proposal.review !== "pending") {
    return (
      <div className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3">
        <span className="font-medium">{title}</span>
        <StatusBadge tone={proposal.review === "confirmed" ? "ok" : "none"}>
          {proposal.review === "confirmed" ? I.confirmed : I.discarded}
        </StatusBadge>
      </div>
    );
  }

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));
  const repeatChanged = draft.repeatOn !== (proposal.repeat_on.value ?? "");
  const inferred = proposal.repeat_on.origin === "inferred" && !repeatChanged;

  function validate(): ConfirmIn["record"] | null {
    const next: typeof errors = {};
    if (!draft.date) next.date = R.dateRequired;
    if (proposal.kind === "vaccine" && !draft.diseases.length)
      next.diseases = R.diseasesRequired;
    if (
      proposal.kind === "vaccine" &&
      draft.lotExpiry.trim() &&
      !monthValue(draft.lotExpiry)
    )
      next.lotExpiry = R.monthInvalid;
    if (proposal.kind === "antiparasitic" && !draft.parasite)
      next.parasite = strings.app.required;
    if (proposal.kind === "weight" && !parseKg(draft.kg)) next.kg = R.kgInvalid;
    setErrors(next);
    if (Object.keys(next).length) return null;
    const repeat = {
      repeat_on: draft.repeatOn || null,
      repeat_on_origin: draft.repeatOn
        ? inferred
          ? ("inferred" as const)
          : ("written" as const)
        : ("" as const),
    };
    if (proposal.kind === "vaccine")
      return {
        kind: "vaccine",
        date: draft.date,
        brand: draft.brand.trim(),
        lot: draft.lot.trim(),
        lot_expiry: draft.lotExpiry.trim() ? (monthValue(draft.lotExpiry) ?? "") : "",
        diseases: draft.diseases as VaccineIn["diseases"],
        vet_name: draft.vetName.trim(),
        vet_crmv: draft.vetCrmv.trim(),
        ...repeat,
      };
    if (proposal.kind === "antiparasitic")
      return {
        kind: "antiparasitic",
        date: draft.date,
        parasite: draft.parasite as "internal" | "external",
        product: draft.brand.trim(),
        dose: draft.dose.trim(),
        vet_name: draft.vetName.trim(),
        ...repeat,
      };
    return { kind: "weight", date: draft.date, kg: parseKg(draft.kg) ?? "" };
  }

  async function confirm() {
    const record = validate();
    if (!record) return;
    setBusy(true);
    setFailure(false);
    try {
      await confirmProposal({
        path: { extraction_id: extractionId, index: proposal.index },
        body: { record },
        throwOnError: true,
      });
      await onDone();
    } catch {
      setFailure(true);
    } finally {
      setBusy(false);
    }
  }

  async function discard() {
    setBusy(true);
    setFailure(false);
    try {
      const { data } = await discardProposal({
        path: { extraction_id: extractionId, index: proposal.index },
        throwOnError: true,
      });
      await onDone(data);
    } catch {
      setFailure(true);
    } finally {
      setBusy(false);
    }
  }

  const unread = (field: { read: boolean }) => (!field.read ? <Unread /> : null);
  const text = (
    key: "brand" | "lot" | "vetName" | "vetCrmv" | "dose",
    label: string,
    field: { read: boolean },
  ) => (
    <Field label={label} error={errors[key]}>
      {(control) => (
        <>
          <Input
            {...control}
            value={draft[key]}
            onChange={(e) => set(key, e.target.value)}
          />
          {unread(field)}
        </>
      )}
    </Field>
  );

  return (
    <section
      aria-label={title}
      className="flex flex-col gap-4 rounded-2xl border bg-card p-4"
    >
      <h3 className="font-semibold">{title}</h3>
      <Field label={R.date} required error={errors.date}>
        {(control) => (
          <>
            <Input
              {...control}
              type="date"
              value={draft.date}
              onChange={(e) => set("date", e.target.value)}
            />
            {unread(proposal.date)}
          </>
        )}
      </Field>

      {proposal.kind === "vaccine" ? (
        <>
          <fieldset className="flex flex-col gap-2">
            <Legend required>{R.diseases}</Legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(catalog.data?.[animal.species] ?? []).map((disease) => (
                <label
                  key={disease.code}
                  className="flex items-center gap-3 rounded-lg border border-input px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-accent"
                >
                  <input
                    type="checkbox"
                    className="size-4"
                    checked={draft.diseases.includes(disease.code)}
                    onChange={(e) =>
                      set(
                        "diseases",
                        e.target.checked
                          ? [...draft.diseases, disease.code]
                          : draft.diseases.filter((c) => c !== disease.code),
                      )
                    }
                  />
                  {disease.label}
                </label>
              ))}
            </div>
            {unread(proposal.diseases)}
            {errors.diseases ? (
              <p className="text-sm text-destructive">{errors.diseases}</p>
            ) : null}
          </fieldset>
          {text("brand", R.brand, proposal.brand)}
          <div className="grid grid-cols-2 gap-3">
            {text("lot", R.lot, proposal.lot)}
            <Field label={R.lotExpiry} error={errors.lotExpiry}>
              {(control) => (
                <>
                  {/* A picker on phones; plain text, typed "09/2027", where the
                      browser has none (Safari and Firefox on a computer). */}
                  <Input
                    {...control}
                    type="month"
                    value={draft.lotExpiry}
                    placeholder={R.monthPlaceholder}
                    onChange={(e) => set("lotExpiry", e.target.value)}
                  />
                  {unread(proposal.lot_expiry)}
                </>
              )}
            </Field>
          </div>
        </>
      ) : null}

      {proposal.kind === "antiparasitic" ? (
        <>
          <ChoiceGroup
            label={R.parasite}
            required
            name={`parasite-${proposal.index}`}
            value={draft.parasite || undefined}
            onChange={(v) => set("parasite", v)}
            error={errors.parasite}
            options={[
              { value: "internal", label: PARASITE_LABEL.internal },
              { value: "external", label: PARASITE_LABEL.external },
            ]}
          />
          {text("brand", R.product, proposal.brand)}
          {text("dose", R.dose, proposal.dose)}
        </>
      ) : null}

      {proposal.kind === "weight" ? (
        <Field label={R.weightKg} required error={errors.kg}>
          {(control) => (
            <>
              <Input
                {...control}
                inputMode="decimal"
                value={draft.kg}
                onChange={(e) => set("kg", e.target.value)}
              />
              {unread(proposal.weight_kg)}
            </>
          )}
        </Field>
      ) : null}

      {proposal.kind !== "weight" ? (
        <>
          <Field label={R.repeatOn}>
            {(control) => (
              <>
                <Input
                  {...control}
                  type="date"
                  value={draft.repeatOn}
                  onChange={(e) => set("repeatOn", e.target.value)}
                />
                {inferred && draft.repeatOn ? (
                  <StatusBadge tone="soon" className="self-start">
                    {R.repeatInferred}
                  </StatusBadge>
                ) : null}
                {unread(proposal.repeat_on)}
              </>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            {text("vetName", R.vet, proposal.vet_name)}
            {proposal.kind === "vaccine"
              ? text("vetCrmv", R.crmv, proposal.vet_crmv)
              : null}
          </div>
        </>
      ) : null}

      {failure ? <Notice tone="error">{strings.app.genericError}</Notice> : null}
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="xl"
          disabled={busy}
          onClick={() => void discard()}
        >
          <X />
          {I.discardLine}
        </Button>
        <Button size="xl" disabled={busy} onClick={() => void confirm()}>
          <Check />
          {I.confirmLine}
        </Button>
      </div>
    </section>
  );
}
