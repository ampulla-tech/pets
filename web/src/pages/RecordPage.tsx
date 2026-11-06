import { useParams, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { getExtractionOptions } from "@pets/core/api/query";
import { RECORD_KIND_LABEL } from "@pets/core/domain";
import { strings } from "@pets/core/strings";
import { ErrorState, Loading } from "@/components/Feedback";
import { Page } from "@/components/Page";
import { RecordForm } from "@/components/records/RecordForm";
import { useAnimal, useRecords } from "@/lib/queries";
import { kindFromSlug } from "@/lib/types";

/** `/animais/:id/registrar/:tipo`: a new record of one kind. */
export function NewRecord() {
  const { id = "", tipo } = useParams();
  const [params] = useSearchParams();
  const kind = kindFromSlug(tipo);
  const animal = useAnimal(id);
  const records = useRecords(id);
  const doseId = params.get("dose");
  // "Preencher à mão" after a failed reading: the reading's photos come along.
  const extractionId = params.get("leitura");
  const extraction = useQuery({
    ...getExtractionOptions({ path: { extraction_id: extractionId ?? "" } }),
    enabled: Boolean(extractionId),
  });
  const back = `/animais/${id}`;
  const title = kind ? strings.records.newTitle(RECORD_KIND_LABEL[kind]) : "";

  if (!kind)
    return (
      <Page title={title} back={back}>
        <ErrorState message={strings.app.notFound} />
      </Page>
    );
  if (
    animal.isPending ||
    (extractionId && extraction.isPending) ||
    (doseId && records.isPending)
  )
    return (
      <Page title={title} back={back}>
        <Loading />
      </Page>
    );
  if (animal.isError)
    return (
      <Page title={title} back={back}>
        <ErrorState message={strings.animal.notFound} />
      </Page>
    );
  return (
    <Page title={title} back={back}>
      <RecordForm
        kind={kind}
        animal={animal.data}
        subject={params.get("assunto")}
        previous={records.data?.find((r) => r.id === doseId && r.kind === kind)}
        attachments={extraction.data?.photos ?? []}
        fromPhoto={Boolean(extraction.data?.photos.length)}
      />
    </Page>
  );
}

/** `/animais/:id/registros/:recordId`: edit (and delete) one record. */
export function EditRecord() {
  const { id = "", recordId } = useParams();
  const animal = useAnimal(id);
  const records = useRecords(id);
  const back = `/animais/${id}`;
  const record = records.data?.find((r) => r.id === recordId);
  const title = record?.kind
    ? strings.records.editTitle(RECORD_KIND_LABEL[record.kind])
    : strings.app.edit;

  if (animal.isPending || records.isPending)
    return (
      <Page title={title} back={back}>
        <Loading />
      </Page>
    );
  if (animal.isError || !record || !record.can_edit || animal.data.status !== "active")
    return (
      <Page title={title} back={back}>
        <ErrorState message={strings.records.notFound} />
      </Page>
    );
  return (
    <Page title={title} back={back}>
      <RecordForm kind={record.kind ?? "note"} animal={animal.data} record={record} />
    </Page>
  );
}
