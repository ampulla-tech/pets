import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { animal, animalRoutes } from "./fixtures";

const photo = {
  id: "ph1",
  name: "pagina.jpg",
  content_type: "image/jpeg",
  url: "https://media.test/pagina.jpg",
};
const empty = { value: null, read: false };
const text = (value: string) => ({ value, read: true });

function extraction(over = {}) {
  return {
    id: "x1",
    animal_id: "a1",
    status: "processing",
    error: "",
    photos: [photo],
    proposals: [] as Array<Record<string, unknown>>,
    ...over,
  };
}

function proposal(over = {}) {
  return {
    index: 0,
    kind: "vaccine",
    date: text("2026-06-06"),
    brand: text("Felocell CVR-C"),
    lot: empty,
    lot_expiry: text("2027-02"),
    diseases: { value: ["rhinotracheitis", "calicivirus", "panleukopenia"], read: true },
    repeat_on: { value: "2027-06-06", read: true, origin: "inferred" },
    vet_name: empty,
    vet_crmv: text("CRMV-SC 00001"),
    dose: empty,
    weight_kg: { value: null, read: false },
    review: "pending",
    record_id: null,
    ...over,
  };
}

describe("photo intake", () => {
  it(
    "uploads the photos, follows the reading and shows a failure with its two ways out",
    { timeout: 10_000 },
    async () => {
      let reads = 0;
      const api = mockApi({
        ...animalRoutes(animal()),
        "POST /animals/a1/extractions": reply(202, extraction()),
        "GET /extractions/x1": () =>
          reads++ === 0
            ? extraction()
            : extraction({ status: "failed", error: "unconfigured" }),
        "POST /extractions/x1/retry": reply(202, extraction()),
      });
      const { user, router } = renderApp("/animais/a1/foto");
      await user.upload(await screen.findByLabelText("Escolher fotos"), [
        new File(["a"], "1.jpg", { type: "image/jpeg" }),
        new File(["b"], "2.jpg", { type: "image/jpeg" }),
      ]);
      expect(screen.getByText("2 fotos escolhidas")).toBeTruthy();
      await user.click(screen.getByRole("button", { name: "Ler as fotos" }));
      await waitFor(() => expect(router.state.location.search).toBe("?leitura=x1"));
      expect(
        api.to("POST /animals/a1/extractions")[0].form?.getAll("files"),
      ).toHaveLength(2);
      expect(await screen.findByText("Lendo a carteirinha…")).toBeTruthy();
      // It polls while processing.
      expect(
        await screen.findByText(
          /ainda não está ligada neste servidor/,
          {},
          { timeout: 4000 },
        ),
      ).toBeTruthy();
      expect(
        screen.getByRole("link", { name: "Preencher à mão" }).getAttribute("href"),
      ).toBe("/animais/a1/registrar/vacina?leitura=x1");
      await user.click(screen.getByRole("button", { name: "Tentar de novo" }));
      await waitFor(() => expect(api.to("POST /extractions/x1/retry")).toHaveLength(1));
    },
  );

  it("fills by hand with the reading's photos attached", async () => {
    mockApi({
      ...animalRoutes(animal()),
      "GET /extractions/x1": extraction({ status: "failed", error: "provider" }),
    });
    renderApp("/animais/a1/registrar/vacina?leitura=x1");
    expect(await screen.findByText("Fotos da leitura anexadas.")).toBeTruthy();
    expect(screen.getByText("pagina.jpg")).toBeTruthy();
  });

  it("reviews each line: unread fields empty and marked, the inferred date marked, confirm and discard", async () => {
    let current = extraction({
      status: "ready",
      proposals: [
        proposal(),
        proposal({
          index: 1,
          kind: "weight",
          diseases: { value: [], read: false },
          weight_kg: { value: 4.2, read: true },
          repeat_on: { value: null, read: false, origin: null },
        }),
      ],
    });
    const api = mockApi({
      ...animalRoutes(animal()),
      "GET /extractions/x1": () => current,
      "POST /extractions/x1/proposals/0/confirm": () => {
        current = {
          ...current,
          proposals: [
            { ...current.proposals[0], review: "confirmed" },
            current.proposals[1],
          ],
        };
        return reply(201, {});
      },
      "POST /extractions/x1/proposals/1/discard": () => {
        current = {
          ...current,
          proposals: [
            current.proposals[0],
            { ...current.proposals[1], review: "discarded" },
          ],
        };
        return current;
      },
    });
    const { user } = renderApp("/animais/a1/foto?leitura=x1");
    const line = await screen.findByRole("region", { name: "Linha 1: Vacina" });
    expect((within(line).getByLabelText("Partida") as HTMLInputElement).value).toBe("");
    const expiry = within(line).getByLabelText("Vencimento do lote") as HTMLInputElement;
    expect(expiry.type).toBe("month");
    expect(expiry.value).toBe("2027-02");
    expect(within(line).getAllByText("não lido: confira no papel")).toHaveLength(2); // lot, vet
    expect(within(line).getByText("lido da linha de baixo")).toBeTruthy();
    expect(
      (
        (await within(line).findByRole("checkbox", {
          name: "Calicivirose",
        })) as HTMLInputElement
      ).checked,
    ).toBe(true);
    // What was not read and is required stops the line until it is typed.
    await user.click(within(line).getByRole("button", { name: "Confirmar" }));
    expect(await within(line).findByText("Informe a partida.")).toBeTruthy();
    expect(within(line).getByText("Informe o veterinário.")).toBeTruthy();
    expect(api.to("POST /extractions/x1/proposals/0/confirm")).toHaveLength(0);
    await user.type(within(line).getByLabelText("Partida"), "011/25");
    await user.type(within(line).getByLabelText("Veterinário"), "Dra. Exemplo");
    await user.click(within(line).getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(api.to("POST /extractions/x1/proposals/0/confirm")).toHaveLength(1),
    );
    expect(api.to("POST /extractions/x1/proposals/0/confirm")[0].json).toEqual({
      record: {
        kind: "vaccine",
        date: "2026-06-06",
        brand: "Felocell CVR-C",
        lot: "011/25",
        lot_expiry: "2027-02",
        diseases: ["rhinotracheitis", "calicivirus", "panleukopenia"],
        vet_name: "Dra. Exemplo",
        vet_crmv: "CRMV-SC 00001",
        repeat_on: "2027-06-06",
        repeat_on_origin: "inferred",
      },
    });
    expect(await screen.findByText("Gravado")).toBeTruthy();
    const weightLine = screen.getByRole("region", { name: "Linha 2: Peso" });
    expect(
      (within(weightLine).getByLabelText("Peso (kg)") as HTMLInputElement).value,
    ).toBe("4,2");
    await user.click(within(weightLine).getByRole("button", { name: "Descartar" }));
    expect(await screen.findByText("Descartado")).toBeTruthy();
    expect(screen.getByText("Todas as linhas foram revistas.")).toBeTruthy();
  });

  it("confirms an unread lot expiry, picked by the tutor", async () => {
    const api = mockApi({
      ...animalRoutes(animal()),
      "GET /extractions/x1": extraction({
        status: "ready",
        proposals: [
          proposal({ lot: text("011/25"), lot_expiry: empty, vet_name: text("Dra. Ana") }),
        ],
      }),
      "POST /extractions/x1/proposals/0/confirm": reply(201, {}),
    });
    const { user } = renderApp("/animais/a1/foto?leitura=x1");
    const line = await screen.findByRole("region", { name: "Linha 1: Vacina" });
    await user.click(within(line).getByRole("button", { name: "Confirmar" }));
    expect(await within(line).findByText("Informe o vencimento.")).toBeTruthy();
    expect(api.to("POST /extractions/x1/proposals/0/confirm")).toHaveLength(0);
    fireEvent.change(within(line).getByLabelText("Vencimento do lote"), {
      target: { value: "2027-05" },
    });
    await user.click(within(line).getByRole("button", { name: "Confirmar" }));
    await waitFor(() =>
      expect(api.to("POST /extractions/x1/proposals/0/confirm")).toHaveLength(1),
    );
    expect(api.to("POST /extractions/x1/proposals/0/confirm")[0].json).toMatchObject({
      record: { lot_expiry: "2027-05" },
    });
  });

  it("marks the five of a vaccine line as required, and not those of an antiparasitic", async () => {
    mockApi({
      ...animalRoutes(animal()),
      "GET /extractions/x1": extraction({
        status: "ready",
        proposals: [proposal(), proposal({ index: 1, kind: "antiparasitic" })],
      }),
    });
    renderApp("/animais/a1/foto?leitura=x1");
    const line = await screen.findByRole("region", { name: "Linha 1: Vacina" });
    for (const label of ["Marca / produto", "Partida", "Vencimento do lote", "Veterinário", "CRMV"])
      expect(within(line).getByLabelText(label).getAttribute("aria-required")).toBe("true");
    const other = screen.getByRole("region", { name: "Linha 2: Antiparasitário" });
    for (const label of ["Remédio", "Dose", "Veterinário"])
      expect(within(other).getByLabelText(label).getAttribute("aria-required")).toBeNull();
  });
});
