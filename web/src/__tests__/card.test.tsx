import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { mockApi, raw } from "./api";
import { renderApp } from "./render";
import type { CardItemOut, CardOut } from "@pets/core/api/generated";
import { animal, animalRoutes, vaccine } from "./fixtures";

function item(over: Partial<CardItemOut> = {}): CardItemOut {
  return {
    record_id: "r1",
    date: "2026-03-10",
    title: "Rabmune",
    detail: "",
    current: false,
    repeat_on: null,
    state: null,
    due_in_days: null,
    can_edit: true,
    ...over,
  };
}

const pacoca = animal({
  id: "g1",
  name: "Paçoca",
  species: "dog",
  breed: "Dachshund",
  sex: "male",
  microchip: "985141000123456",
  age: { years: 3, months: 0, approximate: false },
});
const card: CardOut = {
  animal: pacoca,
  sections: [
    {
      kind: "vaccine",
      items: [
        item({
          record_id: "v2",
          detail: "Partida R88 · Dr. Souza",
          current: true,
          repeat_on: "2027-03-10",
          state: "ok",
          due_in_days: 124,
        }),
        item({
          record_id: "v1",
          title: "Vanguard Plus",
          date: "2025-11-06",
          current: true,
          repeat_on: "2026-11-06",
          state: "due_soon",
          due_in_days: 0,
        }),
        item({ record_id: "v0", date: "2025-03-02" }),
      ],
    },
    {
      kind: "antiparasitic",
      items: [
        item({
          record_id: "p1",
          title: "Revolution",
          detail: "Pulga e carrapato",
          date: "2026-09-20",
          current: true,
          state: "no_date",
        }),
      ],
    },
    {
      kind: "note",
      items: [
        item({
          record_id: "n1",
          title: "Coçando a orelha.",
          detail: "bruno@example.com",
          can_edit: false,
        }),
      ],
    },
  ],
};

describe("card", () => {
  it("lists every dose by section, and only the current one says when to repeat", async () => {
    mockApi({ "GET /animals/g1/card": card });
    renderApp("/animais/g1/carteirinha");
    expect(await screen.findByText("Canino · Dachshund · Macho · 3 anos")).toBeTruthy();
    expect(screen.getByText("Microchip 985141000123456")).toBeTruthy();
    const vaccines = screen.getByRole("region", { name: "Vacinas" });
    const doses = within(vaccines).getAllByRole("listitem");
    expect(doses.map((d) => d.textContent)).toEqual([
      "Rabmune10/03/2026Partida R88 · Dr. SouzaRepetir em 10/03/2027",
      "Vanguard Plus06/11/2025Repetir em 06/11/2026Vence hoje",
      "Rabmune02/03/2025",
    ]);
    const parasites = screen.getByRole("region", { name: "Antiparasitários" });
    expect(within(parasites).getByText("Repetir em: sem data")).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Peso" })).toBeNull();
  });

  it("opens a record from its line, and the record comes back to the card", async () => {
    mockApi({
      "GET /animals/g1/card": card,
      ...animalRoutes(pacoca, [vaccine({ id: "v2", brand: "Rabmune" })]),
    });
    const { user, router } = renderApp("/animais/g1/carteirinha");
    await user.click(await screen.findByRole("link", { name: /Rabmune\s*10\/03\/2026/ }));
    expect(router.state.location.pathname).toBe("/animais/g1/registros/v2");
    await user.click(await screen.findByRole("link", { name: "Voltar" }));
    expect(router.state.location.pathname).toBe("/animais/g1/carteirinha");
    // A line the viewer cannot edit is only read.
    expect(screen.queryByRole("link", { name: /Coçando/ })).toBeNull();
  });

  it("empty, offers Registrar and no PDF", async () => {
    mockApi({
      "GET /animals/g1/card": {
        animal: { ...pacoca, sex: "female", name: "Nina" },
        sections: [],
      },
    });
    const { user } = renderApp("/animais/g1/carteirinha");
    expect(await screen.findByText("A carteirinha está vazia")).toBeTruthy();
    expect(screen.getByText(/os pesos da Nina aparecem aqui/)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Baixar o PDF da carteirinha" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Registrar" }));
    const sheet = await screen.findByRole("dialog");
    expect(
      within(sheet).getByRole("link", { name: /Ler fotos da carteirinha/ }),
    ).toBeTruthy();
  });

  it("downloads the PDF with the session header", async () => {
    const api = mockApi({
      "GET /animals/g1/card": card,
      "GET /animals/g1/card.pdf": raw("%PDF-1.4", {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="carteirinha-pacoca.pdf"',
      }),
    });
    const created = vi.fn(() => "blob:pdf");
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }),
    );
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicks.push(this.download);
    });
    const { user } = renderApp("/animais/g1/carteirinha");
    await user.click(
      await screen.findByRole("button", { name: "Baixar o PDF da carteirinha" }),
    );
    await waitFor(() => expect(clicks).toEqual(["carteirinha-pacoca.pdf"]));
    // The session is the cookie: the call carries it.
    expect(api.to("GET /animals/g1/card.pdf")[0].credentials).toBe("include");
  });
});
