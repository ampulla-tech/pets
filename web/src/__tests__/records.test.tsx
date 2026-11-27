import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { animal, animalRoutes, vaccine } from "./fixtures";

const cat = animal();
const dog = animal({ id: "d1", species: "dog", name: "Bug" });

function attachment(id: string, name: string, type: string) {
  return { id, name, content_type: type, url: `https://media.test/${name}?sig=1` };
}

describe("vaccine", () => {
  it("offers only the species' diseases and saves the vaccine with its photo", async () => {
    const api = mockApi({
      ...animalRoutes(cat),
      "POST /animals/a1/attachments": reply(201, [
        attachment("f1", "rotulo.jpg", "image/jpeg"),
      ]),
      "POST /animals/a1/vaccines": reply(201, vaccine()),
    });
    const { user, router } = renderApp("/animais/a1/registrar/vacina");
    const group = await screen.findByRole("group", { name: "Contra o quê" });
    expect(
      within(group)
        .getAllByRole("checkbox")
        .map((c) => c.closest("label")!.textContent),
    ).toEqual([
      "Rinotraqueíte",
      "Calicivirose",
      "Panleucopenia",
      "Clamidiose",
      "FeLV",
      "Raiva",
    ]);
    fireEvent.change(screen.getByLabelText("Data"), { target: { value: "2026-10-20" } });
    await user.click(within(group).getByRole("checkbox", { name: "FeLV" }));
    await user.click(within(group).getByRole("checkbox", { name: "Raiva" }));
    await user.type(screen.getByLabelText(/Marca/), "Nobivac");
    await user.type(screen.getByLabelText(/Partida/), "A12");
    fireEvent.change(screen.getByLabelText(/Vencimento do lote/), {
      target: { value: "2027-09" },
    });
    fireEvent.change(screen.getByLabelText(/Repetir em/), {
      target: { value: "2027-10-20" },
    });
    await user.type(screen.getByLabelText(/Veterinário/), "Dra. Ana");
    await user.type(screen.getByLabelText(/CRMV/), "CRMV-SC 1");
    await user.upload(
      screen.getByLabelText("Anexar foto ou PDF"),
      new File(["x"], "rotulo.jpg", { type: "image/jpeg" }),
    );
    expect(await screen.findByText("rotulo.jpg")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/animais/a1"));
    expect(api.to("POST /animals/a1/vaccines")[0].json).toEqual({
      date: "2026-10-20",
      diseases: ["felv", "rabies"],
      brand: "Nobivac",
      lot: "A12",
      lot_expiry: "2027-09",
      repeat_on: "2027-10-20",
      repeat_on_origin: "written",
      vet_name: "Dra. Ana",
      vet_crmv: "CRMV-SC 1",
      attachment_ids: ["f1"],
    });
  });

  it("needs at least one disease", async () => {
    const api = mockApi(animalRoutes(cat));
    const { user } = renderApp("/animais/a1/registrar/vacina");
    await user.click(await screen.findByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Marque pelo menos uma doença.")).toBeTruthy();
    expect(api.to("POST /animals/a1/vaccines")).toHaveLength(0);
  });

  it("starts a new dose with the reminder's disease ticked", async () => {
    mockApi(animalRoutes(dog));
    renderApp("/animais/d1/registrar/vacina?assunto=rabies");
    const rabies = (await screen.findByRole("checkbox", {
      name: "Raiva",
    })) as HTMLInputElement;
    expect(rabies.checked).toBe(true);
    expect(
      (screen.getByRole("checkbox", { name: "Cinomose" }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it("starts a new dose as a copy of the last one, diseases folded", async () => {
    const last = vaccine({
      id: "v7",
      brand: "Vanguard Plus",
      diseases: ["distemper", "parvovirus"],
    });
    const api = mockApi({
      ...animalRoutes(dog, [last]),
      "POST /animals/d1/vaccines": reply(201, last),
    });
    const { user } = renderApp("/animais/d1/registrar/vacina?dose=v7");
    expect(await screen.findByText(/Copiado da dose anterior/)).toBeTruthy();
    expect((screen.getByLabelText(/Marca/) as HTMLInputElement).value).toBe(
      "Vanguard Plus",
    );
    expect(screen.getByText("Cinomose, Parvovirose")).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: "Cinomose" })).toBeNull();
    // The lot and the vet are of the new bottle and the new visit: left empty.
    expect((screen.getByLabelText(/Partida/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/^Veterinário/) as HTMLInputElement).value).toBe("");

    await user.click(screen.getByRole("button", { name: "Alterar" }));
    expect(
      (screen.getByRole("checkbox", { name: "Cinomose" }) as HTMLInputElement).checked,
    ).toBe(true);
    // And they are asked for before the dose is saved.
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe a partida.")).toBeTruthy();
    expect(api.to("POST /animals/d1/vaccines")).toHaveLength(0);
    await user.type(screen.getByLabelText("Partida"), "B12");
    fireEvent.change(screen.getByLabelText("Vencimento do lote"), {
      target: { value: "2027-11" },
    });
    await user.type(screen.getByLabelText("Veterinário"), "Dra. Ana");
    await user.type(screen.getByLabelText("CRMV"), "CRMV-SC 1");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.to("POST /animals/d1/vaccines")).toHaveLength(1));
    expect(api.to("POST /animals/d1/vaccines")[0].json).toMatchObject({
      brand: "Vanguard Plus",
      diseases: ["distemper", "parvovirus"],
      lot: "B12",
      lot_expiry: "2027-11",
    });
  });

  it("does not save without the label and the stamp, and says what each one lacks", async () => {
    const api = mockApi(animalRoutes(cat));
    const { user } = renderApp("/animais/a1/registrar/vacina?assunto=rabies");
    await screen.findByRole("group", { name: "Contra o quê" });
    await user.type(screen.getByLabelText("Partida"), "   ");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    for (const [label, message] of [
      ["Marca / produto", "Informe a marca."],
      ["Partida", "Informe a partida."],
      ["Vencimento do lote", "Informe o vencimento."],
      ["Veterinário", "Informe o veterinário."],
      ["CRMV", "Informe o CRMV."],
    ]) {
      const control = screen.getByLabelText(label);
      expect(control.getAttribute("aria-invalid")).toBe("true");
      const described = control.getAttribute("aria-describedby")!;
      expect(document.getElementById(described)!.textContent).toBe(message);
    }
    expect(api.to("POST /animals/a1/vaccines")).toHaveLength(0);
  });

  it("asks an old dose saved without them to be completed on edit", async () => {
    const record = vaccine({ brand: "", lot: "", lot_expiry: "", vet_name: "", vet_crmv: "" });
    const api = mockApi({
      ...animalRoutes(cat, [record]),
      "PUT /animals/a1/vaccines/v1": record,
    });
    const { user } = renderApp("/animais/a1/registros/v1");
    await user.click(await screen.findByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe a marca.")).toBeTruthy();
    expect(screen.getByText("Informe o CRMV.")).toBeTruthy();
    expect(api.to("PUT /animals/a1/vaccines/v1")).toHaveLength(0);
  });

  it("edits a vaccine and keeps an inferred repeat date inferred", async () => {
    const record = vaccine({ repeat_on_origin: "inferred" });
    const api = mockApi({
      ...animalRoutes(cat, [record]),
      "PUT /animals/a1/vaccines/v1": record,
    });
    const { user } = renderApp("/animais/a1/registros/v1");
    expect(await screen.findByText("lido da linha de baixo")).toBeTruthy();
    const expiry = screen.getByLabelText(/Vencimento do lote/) as HTMLInputElement;
    expect(expiry.type).toBe("month");
    expect(expiry.value).toBe("2027-09");
    await user.clear(screen.getByLabelText(/Partida/));
    await user.type(screen.getByLabelText(/Partida/), "B7");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.to("PUT /animals/a1/vaccines/v1")).toHaveLength(1));
    const body = api.to("PUT /animals/a1/vaccines/v1")[0].json as Record<string, unknown>;
    expect(body).toMatchObject({
      lot: "B7",
      repeat_on: "2027-06-06",
      repeat_on_origin: "inferred",
      lot_expiry: "2027-09",
    });
  });

  it("edits a vaccine and cannot empty its lot expiry", async () => {
    const record = vaccine();
    const api = mockApi({
      ...animalRoutes(cat, [record]),
      "PUT /animals/a1/vaccines/v1": record,
    });
    const { user } = renderApp("/animais/a1/registros/v1");
    const expiry = (await screen.findByLabelText(/Vencimento do lote/)) as HTMLInputElement;
    fireEvent.change(expiry, { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Informe o vencimento.")).toBeTruthy();
    expect(api.to("PUT /animals/a1/vaccines/v1")).toHaveLength(0);
  });

  it("deletes a vaccine after confirming", async () => {
    const record = vaccine({ repeat_on_origin: "inferred" });
    const api = mockApi({
      ...animalRoutes(cat, [record]),
      "DELETE /animals/a1/vaccines/v1": reply(204),
    });
    const { user } = renderApp("/animais/a1/registros/v1");
    expect(await screen.findByText("lido da linha de baixo")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Apagar" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Apagar",
      }),
    );
    await waitFor(() => expect(api.to("DELETE /animals/a1/vaccines/v1")).toHaveLength(1));
  });
});

describe("antiparasitic, weight, note, visit", () => {
  it("saves an antiparasitic with the weight taken that day", async () => {
    const api = mockApi({
      ...animalRoutes(dog),
      "POST /animals/d1/antiparasitics": reply(201, {}),
    });
    const { user } = renderApp("/animais/d1/registrar/antiparasitario?assunto=external");
    expect(
      (
        (await screen.findByRole("radio", {
          name: "Pulga e carrapato",
        })) as HTMLInputElement
      ).checked,
    ).toBe(true);
    await user.type(screen.getByLabelText(/Remédio/), "Bravecto");
    await user.type(screen.getByLabelText(/Dose/), "1 comprimido");
    fireEvent.change(screen.getByLabelText(/Repetir em/), {
      target: { value: "2027-01-31" },
    });
    await user.type(screen.getByLabelText(/Peso no dia/), "3,25");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() =>
      expect(api.to("POST /animals/d1/antiparasitics")).toHaveLength(1),
    );
    expect(api.to("POST /animals/d1/antiparasitics")[0].json).toMatchObject({
      parasite: "external",
      product: "Bravecto",
      dose: "1 comprimido",
      repeat_on: "2027-01-31",
      repeat_on_origin: "written",
      weight_kg: "3.25",
    });
  });

  it("saves a weight typed with a comma", async () => {
    const api = mockApi({
      ...animalRoutes(cat),
      "POST /animals/a1/weights": reply(201, {}),
    });
    const { user } = renderApp("/animais/a1/registrar/peso");
    await user.type(await screen.findByLabelText("Peso (kg)"), "4,9");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.to("POST /animals/a1/weights")).toHaveLength(1));
    expect(api.to("POST /animals/a1/weights")[0].json).toMatchObject({
      kg: "4.9",
      attachment_ids: [],
    });
  });

  it("lets a guest write a note, without attachments", async () => {
    const api = mockApi({
      ...animalRoutes(animal({ role: "guest" })),
      "POST /animals/a1/notes": reply(201, {}),
    });
    const { user } = renderApp("/animais/a1/registrar/observacao");
    await user.type(await screen.findByLabelText("Anotação"), "Comeu bem.");
    expect(screen.queryByLabelText("Anexar foto ou PDF")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(api.to("POST /animals/a1/notes")).toHaveLength(1));
    expect(api.to("POST /animals/a1/notes")[0].json).toMatchObject({
      text: "Comeu bem.",
    });
  });

  it("saves a visit with a photo and a PDF, and its record opens them", async () => {
    let n = 0;
    const files = [
      attachment("p1", "receita.jpg", "image/jpeg"),
      attachment("p2", "exame.pdf", "application/pdf"),
    ];
    const visit = {
      kind: "visit",
      id: "c1",
      date: "2026-10-30",
      clinic: "Clínica Centro",
      vet_name: "Dr. Leo",
      reason: "Vômito",
      notes: "",
      attachments: files,
      created_by: { id: "u1", email: "ana@example.com" },
      created_at: "2026-10-30T10:00:00Z",
      updated_by: { id: "u1", email: "ana@example.com" },
      updated_at: "2026-10-30T10:00:00Z",
      can_edit: true,
    };
    let saved = false;
    const api = mockApi({
      "GET /catalog": { dog: [], cat: [], parasites: [] },
      "GET /animals/a1": cat,
      "GET /animals/a1/records": () => (saved ? [visit] : []),
      "GET /animals/a1/reminders": [],
      "POST /animals/a1/attachments": () => reply(201, [files[n++]]),
      "POST /animals/a1/visits": () => {
        saved = true;
        return reply(201, visit);
      },
    });
    const { user, router } = renderApp("/animais/a1/registrar/consulta");
    await user.type(await screen.findByLabelText(/Clínica/), "Clínica Centro");
    await user.type(screen.getByLabelText(/Motivo/), "Vômito");
    await user.upload(
      screen.getByLabelText("Anexar foto ou PDF"),
      new File(["x"], "receita.jpg", { type: "image/jpeg" }),
    );
    await screen.findByText("receita.jpg");
    await user.upload(
      screen.getByLabelText("Anexar foto ou PDF"),
      new File(["%PDF"], "exame.pdf", { type: "application/pdf" }),
    );
    await screen.findByText("exame.pdf");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/animais/a1"));
    expect(api.to("POST /animals/a1/visits")[0].json).toMatchObject({
      clinic: "Clínica Centro",
      reason: "Vômito",
      attachment_ids: ["p1", "p2"],
    });
    // The upload goes with the session cookie and the CSRF header.
    const upload = api.to("POST /animals/a1/attachments")[0];
    expect(upload.credentials).toBe("include");
    expect(upload.headers.get("X-CSRFToken")).toBe("csrf-1");
    expect(upload.form?.get("files")).toBeTruthy();
    await router.navigate("/animais/a1/registros/c1");
    await screen.findByDisplayValue("Clínica Centro");
    const links = await screen.findAllByRole("link", { name: /receita.jpg|exame.pdf/ });
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      files[0].url,
      files[1].url,
    ]);
    expect(links[0].getAttribute("target")).toBe("_blank");
  });
});
