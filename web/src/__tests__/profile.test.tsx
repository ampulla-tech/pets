import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { access, animal, animalRoutes, reminder, vaccine, weight } from "./fixtures";

const lacan = animal({ last_weight: { kg: "4.900", date: "2026-08-02" } });
const records = [
  weight("w2", "2026-08-02", "4.900"),
  vaccine(),
  weight("w1", "2026-05-18", "4.100"),
];

describe("animal profile", () => {
  it("shows the current weight, its change since the weighing before, and its curve", async () => {
    mockApi(animalRoutes(lacan, records));
    renderApp("/animais/a1");
    const weightSection = await screen.findByRole("region", { name: "Peso atual" });
    expect(weightSection.textContent).toContain("4,9kg");
    expect(within(weightSection).getByText("+0,8 kg em 2 meses")).toBeTruthy();
    // No day under the weight: the card's lines carry the days.
    expect(within(weightSection).queryByText("02/08/2026")).toBeNull();
    expect(within(weightSection).getByRole("img").getAttribute("aria-label")).toBe(
      "Peso no tempo: 18/05/2026: 4,1 kg; 02/08/2026: 4,9 kg",
    );
  });

  it("shows one weighing as the number alone, with no change and no curve", async () => {
    mockApi(animalRoutes(lacan, [weight("w2", "2026-08-02", "4.900")]));
    renderApp("/animais/a1");
    const weightSection = await screen.findByRole("region", { name: "Peso atual" });
    expect(weightSection.textContent).toBe("Peso atual4,9kg");
    expect(within(weightSection).queryByRole("img")).toBeNull();
  });

  it("leads a tutor with nothing recorded to read the paper card", async () => {
    mockApi(animalRoutes(animal({ sex: "female", name: "Nina" }), []));
    renderApp("/animais/a1");
    expect(await screen.findByText("Nada registrado ainda")).toBeTruthy();
    expect(screen.getByText(/Tem a carteirinha de papel da Nina\?/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Ler fotos da carteirinha" }).getAttribute("href"),
    ).toBe("/animais/a1/foto");
    expect(screen.queryByRole("region", { name: "Lembretes" })).toBeNull();
    expect(screen.queryByRole("region", { name: "Peso atual" })).toBeNull();
  });

  it("leads a guest with nothing recorded to the weight", async () => {
    mockApi(animalRoutes(animal({ role: "guest" }), []));
    renderApp("/animais/a1");
    expect(await screen.findByText(/Você já pode anotar o peso/)).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Registrar peso" }).getAttribute("href"),
    ).toBe("/animais/a1/registrar/peso");
  });

  it("gives each empty section the button that fills it, to whoever can use it", async () => {
    mockApi(animalRoutes(lacan, [weight("w2", "2026-08-02", "4.900")]));
    renderApp("/animais/a1");
    const reminders = await screen.findByRole("region", { name: "Lembretes" });
    expect(
      (
        await within(reminders).findByRole("link", { name: "Registrar vacina" })
      ).getAttribute("href"),
    ).toBe("/animais/a1/registrar/vacina");
  });

  it("offers a guest the weight's button and not the vaccine's", async () => {
    mockApi(animalRoutes(animal({ role: "guest" }), [vaccine()]));
    renderApp("/animais/a1");
    const weightSection = await screen.findByRole("region", { name: "Peso atual" });
    expect(within(weightSection).getByText("Nenhum peso registrado.")).toBeTruthy();
    expect(
      within(weightSection).getByRole("link", { name: "Registrar peso" }),
    ).toBeTruthy();
    const reminders = screen.getByRole("region", { name: "Lembretes" });
    expect(within(reminders).queryByRole("link")).toBeNull();
  });

  it("names the animal once, in the header, with who it is, and has no history", async () => {
    mockApi(
      animalRoutes(
        animal({
          species: "dog",
          breed: "",
          age: { years: 5, months: 0, approximate: false },
        }),
        records,
      ),
    );
    renderApp("/animais/a1");
    const heading = await screen.findByRole("heading", { name: /Lacan/ });
    expect(heading.textContent).toBe("LLacanCanino · SRD · 5 anos");
    expect(screen.getAllByText("Lacan")).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Histórico" })).toBeNull();
    expect(screen.queryByRole("article")).toBeNull();
    expect(screen.getByRole("link", { name: "Carteirinha" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Pessoas" })).toBeTruthy();
  });

  it("offers the tutor one Registrar: the photos of the card first, then each kind", async () => {
    mockApi(animalRoutes(lacan, records));
    const { user } = renderApp("/animais/a1");
    expect(screen.queryByRole("link", { name: "Adicionar por foto" })).toBeNull();
    await user.click(await screen.findByRole("button", { name: "Registrar" }));
    const sheet = await screen.findByRole("dialog", { name: "Registrar" });
    const links = within(sheet).getAllByRole("link");
    expect(links.map((l) => l.getAttribute("href"))).toEqual([
      "/animais/a1/foto",
      "/animais/a1/registrar/vacina",
      "/animais/a1/registrar/antiparasitario",
      "/animais/a1/registrar/peso",
      "/animais/a1/registrar/observacao",
      "/animais/a1/registrar/consulta",
    ]);
    expect(links[0].textContent).toContain("Várias doses de uma vez.");
    expect(within(sheet).getByText("Ou um registro à mão")).toBeTruthy();
  });

  it("closes the Registrar when its handle is dragged down, not when dragged up", async () => {
    mockApi(animalRoutes(lacan, records));
    const { user } = renderApp("/animais/a1");
    await user.click(await screen.findByRole("button", { name: "Registrar" }));
    const sheet = await screen.findByRole("dialog", { name: "Registrar" });
    const handle = within(sheet).getByTestId("sheet-handle");

    fireEvent.pointerDown(handle, { clientY: 400 });
    fireEvent.pointerMove(handle, { clientY: 340 });
    fireEvent.pointerUp(handle, { clientY: 340 });
    expect(screen.getByRole("dialog", { name: "Registrar" })).toBeTruthy();

    fireEvent.pointerDown(handle, { clientY: 400 });
    fireEvent.pointerMove(handle, { clientY: 600 });
    fireEvent.pointerUp(handle, { clientY: 600 });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Registrar" })).toBeNull(),
    );
  });

  it("opens at the reminder's subject with a shortcut to register a new dose", async () => {
    mockApi(
      animalRoutes(lacan, records, [
        reminder({ subject: "felv", subject_label: "FeLV", record_id: "v2" }),
        reminder({
          subject: "rabies",
          subject_label: "Raiva",
          state: "upcoming",
          days: 5,
        }),
      ]),
    );
    renderApp("/animais/a1?assunto=rabies");
    const marked = await screen.findByText("Raiva", { selector: "p" });
    const item = marked.closest("li")!;
    expect(item.getAttribute("aria-current")).toBe("true");
    expect(
      within(item)
        .getByRole("link", { name: "Registrar dose nova" })
        .getAttribute("href"),
    ).toBe("/animais/a1/registrar/vacina?dose=v1");
    // Only the pointed-at subject gets the shortcut.
    expect(screen.getAllByRole("link", { name: "Registrar dose nova" })).toHaveLength(1);
  });

  it("opens the shortcut of any reminder tapped, one at a time", async () => {
    mockApi(
      animalRoutes(lacan, records, [
        reminder({ subject: "felv", subject_label: "FeLV", record_id: "v2" }),
        reminder({
          subject: "rabies",
          subject_label: "Raiva",
          state: "upcoming",
          days: 5,
        }),
      ]),
    );
    const { user } = renderApp("/animais/a1");
    const felv = (await screen.findByText("FeLV", { selector: "p" })).closest("li")!;
    expect(screen.queryByRole("link", { name: "Registrar dose nova" })).toBeNull();

    await user.click(within(felv).getByRole("button", { expanded: false }));
    expect(
      within(felv)
        .getByRole("link", { name: "Registrar dose nova" })
        .getAttribute("href"),
    ).toBe("/animais/a1/registrar/vacina?dose=v2");

    const rabies = screen.getByText("Raiva", { selector: "p" }).closest("li")!;
    await user.click(within(rabies).getByRole("button", { expanded: false }));
    expect(screen.getAllByRole("link", { name: "Registrar dose nova" })).toHaveLength(1);
    expect(
      within(rabies).getByRole("link", { name: "Registrar dose nova" }),
    ).toBeTruthy();

    await user.click(within(rabies).getByRole("button", { expanded: true }));
    expect(screen.queryByRole("link", { name: "Registrar dose nova" })).toBeNull();
  });

  it("shows the diseases of one dose as one reminder, named by the brand", async () => {
    const combined = vaccine({ id: "v3", brand: "Nobivac Feline 1-HCPCh+FeLV" });
    mockApi(
      animalRoutes(
        lacan,
        [...records, combined],
        [
          reminder({
            subject: "rhinotracheitis",
            subject_label: "Rinotraqueíte",
            record_id: "v3",
          }),
          reminder({
            subject: "calicivirus",
            subject_label: "Calicivirose",
            record_id: "v3",
          }),
          reminder({ subject: "felv", subject_label: "FeLV", record_id: "v3" }),
        ],
      ),
    );
    renderApp("/animais/a1?assunto=calicivirus");
    const section = await screen.findByRole("region", { name: "Lembretes" });
    const items = await within(section).findAllByRole("listitem");
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toContain("Nobivac Feline 1-HCPCh+FeLV");
    expect(items[0].textContent).toContain("Rinotraqueíte, Calicivirose, FeLV");
    expect(items[0].getAttribute("aria-current")).toBe("true");
    expect(
      within(items[0])
        .getByRole("link", { name: "Registrar dose nova" })
        .getAttribute("href"),
    ).toBe("/animais/a1/registrar/vacina?dose=v3");
  });

  it("asks for the date of a reminder with none, through the dose's edit form", async () => {
    mockApi(
      animalRoutes(lacan, records, [
        reminder({ state: "no_date", due_on: null, days: null }),
      ]),
    );
    renderApp("/animais/a1");
    const link = await screen.findByRole("link", { name: "Informar a data" });
    expect(link.getAttribute("href")).toBe("/animais/a1/registros/v1");
    expect(screen.getByText("Sem data: informe quando repetir")).toBeTruthy();
  });

  it("shows a guest Registrar with weight and note only, and Tutores", async () => {
    mockApi(animalRoutes(animal({ role: "guest" }), records));
    const { user } = renderApp("/animais/a1");
    expect(await screen.findByRole("button", { name: "Tutores" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Pessoas" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mais ações" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Registrar" }));
    const sheet = await screen.findByRole("dialog", { name: "Registrar" });
    expect(
      within(sheet)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Peso", "Observação"]);
  });

  it("opens a guest's Tutores sheet: the tutors, the access end, and leaving", async () => {
    const api = mockApi({
      ...animalRoutes(animal({ role: "guest", name: "Paçoca", sex: "female" }), records),
      "GET /animals/a1/accesses": [
        access({ id: 1, email: "ana@example.com", is_me: false }),
        access({ id: 2, email: "carlos@example.com", is_me: false }),
        access({
          id: 3,
          email: "bruno@example.com",
          role: "guest",
          ends_on: "2026-11-30",
        }),
      ],
      "DELETE /animals/a1/accesses/3": reply(204),
      "GET /animals": [],
      "GET /notices/unread": { unread: false },
      "GET /push/webpush/key": { public_key: "" },
    });
    const { user, router } = renderApp("/animais/a1");
    await user.click(await screen.findByRole("button", { name: "Tutores" }));
    const sheet = await screen.findByRole("dialog", { name: "Tutores da Paçoca" });
    expect(
      within(sheet).getByText("Recebem os lembretes e podem mudar tudo."),
    ).toBeTruthy();
    expect(
      within(sheet)
        .getAllByRole("listitem")
        .map((li) => li.textContent),
    ).toEqual(["Aana@example.com", "Ccarlos@example.com"]);
    expect(within(sheet).getByText("Seu acesso vai até 30/11/2026.")).toBeTruthy();
    await user.click(within(sheet).getByRole("button", { name: "Sair deste animal" }));
    const confirm = await screen.findByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Sair deste animal" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(api.to("DELETE /animals/a1/accesses/3")).toHaveLength(1);
  });

  it("archives with a reason and a day", async () => {
    const api = mockApi({
      ...animalRoutes(lacan, records),
      "POST /animals/a1/archive": animal({ status: "archived" }),
    });
    const { user } = renderApp("/animais/a1");
    await user.click(await screen.findByRole("button", { name: "Mais ações" }));
    await user.click(await screen.findByRole("menuitem", { name: "Arquivar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Faleceu" }));
    await user.click(within(dialog).getByRole("button", { name: "Arquivar" }));
    await waitFor(() => expect(api.to("POST /animals/a1/archive")).toHaveLength(1));
    const body = api.to("POST /animals/a1/archive")[0].json as {
      reason: string;
      on: string;
    };
    expect(body.reason).toBe("died");
    expect(body.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reads an archived animal only, and lets the tutor delete it for good", async () => {
    const gone = animal({
      status: "archived",
      archived_reason: "rehomed",
      archived_on: "2026-10-01",
    });
    const api = mockApi({
      ...animalRoutes(gone, records),
      "DELETE /animals/a1": reply(204),
      "GET /animals": [],
      "GET /reminders/upcoming": [],
      "GET /push/webpush/key": { public_key: "" },
    });
    const { user, router } = renderApp("/animais/a1");
    expect(await screen.findByText(/Doado em 01\/10\/2026/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Mais ações" }));
    await user.click(await screen.findByRole("menuitem", { name: "Apagar o animal" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain("Apagar Lacan de vez?");
    await user.click(within(confirm).getByRole("button", { name: "Apagar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(api.to("DELETE /animals/a1")).toHaveLength(1);
  });

  it("lists the archived animals with reason and day", async () => {
    mockApi({
      "GET /animals": (call: { query: URLSearchParams }) =>
        call.query.get("status") === "archived"
          ? [
              animal({
                status: "archived",
                archived_reason: "died",
                archived_on: "2026-10-30",
              }),
            ]
          : [],
    });
    renderApp("/arquivados");
    const card = await screen.findByRole("link", { name: /Lacan/ });
    expect(card.textContent).toContain("Faleceu em 30/10/2026");
  });
});
