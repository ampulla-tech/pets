import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { animal, animalRoutes, reminder, vaccine, weight } from "./fixtures";

const lacan = animal({ last_weight: { kg: "4.900", date: "2026-08-02" } });
const records = [weight("w2", "2026-08-02", "4.900"), vaccine(), weight("w1", "2026-05-18", "4.100")];

describe("animal profile", () => {
  it("shows the last weight with its day and the weight over time", async () => {
    mockApi(animalRoutes(lacan, records));
    renderApp("/animais/a1");
    const weightSection = await screen.findByRole("region", { name: "Último peso" });
    expect(within(weightSection).getByText("4,9 kg")).toBeTruthy();
    expect(within(weightSection).getByText("02/08/2026")).toBeTruthy();
    expect((await within(weightSection).findByRole("img")).getAttribute("aria-label")).toBe(
      "Peso no tempo: 18/05/2026: 4,1 kg; 02/08/2026: 4,9 kg",
    );
  });

  it("lists the history with what each record says", async () => {
    mockApi(animalRoutes(lacan, records));
    renderApp("/animais/a1");
    const history = await screen.findByRole("region", { name: "Histórico" });
    const items = await within(history).findAllByRole("article");
    expect(items.map((i) => i.getAttribute("aria-label"))).toEqual([
      "Peso · 4,9 kg 02/08/2026",
      "Vacina · Bioraiva Pet 06/06/2026",
      "Peso · 4,1 kg 18/05/2026",
    ]);
    expect(items[1].textContent).toContain("Contra Raiva");
    expect(items[1].textContent).toContain("Repetir em 06/06/2027");
  });

  it("opens at the reminder's subject with a shortcut to register a new dose", async () => {
    mockApi(
      animalRoutes(lacan, records, [
        reminder({ subject: "felv", subject_label: "FeLV", record_id: "v2" }),
        reminder({ subject: "rabies", subject_label: "Raiva", state: "upcoming", days: 5 }),
      ]),
    );
    renderApp("/animais/a1?assunto=rabies");
    const marked = await screen.findByText("Raiva", { selector: "p" });
    const item = marked.closest("li")!;
    expect(item.getAttribute("aria-current")).toBe("true");
    expect(within(item).getByRole("link", { name: "Registrar dose nova" }).getAttribute("href")).toBe(
      "/animais/a1/registrar/vacina?assunto=rabies",
    );
    // Only the pointed-at subject gets the shortcut.
    expect(screen.getAllByRole("link", { name: "Registrar dose nova" })).toHaveLength(1);
  });

  it("asks for the date of a reminder with none, through the dose's edit form", async () => {
    mockApi(animalRoutes(lacan, records, [reminder({ state: "no_date", due_on: null, days: null })]));
    renderApp("/animais/a1");
    const link = await screen.findByRole("link", { name: "Informar a data" });
    expect(link.getAttribute("href")).toBe("/animais/a1/registros/v1");
    expect(screen.getByText("Sem data: informe quando repetir")).toBeTruthy();
  });

  it("shows a guest only weight and note, and no edit of others' records", async () => {
    const guestView = animal({ role: "guest" });
    mockApi(animalRoutes(guestView, [vaccine({ can_edit: false }), { ...weight("w1", "2026-05-18", "4.1"), can_edit: true }]));
    renderApp("/animais/a1");
    expect(await screen.findByRole("link", { name: "Registrar peso" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Registrar observação" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Registrar" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Adicionar por foto" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Mais ações" })).toBeNull();
    await screen.findAllByRole("article");
    expect(screen.queryByRole("link", { name: /Editar: Vacina/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Editar: Peso/ })).toBeTruthy();
  });

  it("archives with a reason and a day", async () => {
    const api = mockApi({ ...animalRoutes(lacan, records), "POST /animals/a1/archive": animal({ status: "archived" }) });
    const { user } = renderApp("/animais/a1");
    await user.click(await screen.findByRole("button", { name: "Mais ações" }));
    await user.click(await screen.findByRole("menuitem", { name: "Arquivar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: "Faleceu" }));
    await user.click(within(dialog).getByRole("button", { name: "Arquivar" }));
    await waitFor(() => expect(api.to("POST /animals/a1/archive")).toHaveLength(1));
    const body = api.to("POST /animals/a1/archive")[0].json as { reason: string; on: string };
    expect(body.reason).toBe("died");
    expect(body.on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reads an archived animal only, and lets the tutor delete it for good", async () => {
    const gone = animal({ status: "archived", archived_reason: "rehomed", archived_on: "2026-10-01" });
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
    await screen.findAllByRole("article");
    expect(screen.queryByRole("link", { name: /Editar:/ })).toBeNull();
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
          ? [animal({ status: "archived", archived_reason: "died", archived_on: "2026-10-30" })]
          : [],
    });
    renderApp("/arquivados");
    const card = await screen.findByRole("link", { name: /Lacan/ });
    expect(card.textContent).toContain("Faleceu em 30/10/2026");
  });
});
