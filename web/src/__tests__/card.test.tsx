import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { mockApi, raw } from "./api";
import { renderApp } from "./render";
import { animal } from "./fixtures";

const label = { id: "l1", name: "etiqueta.jpg", content_type: "image/jpeg", url: "https://media.test/etiqueta.jpg" };
const card = {
  animal: animal({ id: "g1", name: "GATA", sex: "female", coat: "Bege" }),
  rows: [
    { subject: "felv", label: "FeLV", last_date: "2026-10-27", last_product: "Felocell FeLV", last_vet: "Dra. Exemplo", next_on: "2027-10-27", state: "scheduled", record_kind: "vaccine", record_id: "v1", photos: [label] },
    { subject: "internal", label: "Verme interno", last_date: "2026-09-01", last_product: "Drontal", last_vet: "", next_on: null, state: "no_date", record_kind: "antiparasitic", record_id: "p1", photos: [] },
  ],
};

describe("card", () => {
  it("shows the last and next dose per subject, the label photo a tap away", async () => {
    mockApi({ "GET /animals/g1/card": card });
    const { user } = renderApp("/animais/g1/carteirinha");
    const rows = await screen.findAllByRole("listitem");
    expect(rows[0].textContent).toContain("27/10/2026");
    expect(rows[0].textContent).toContain("Felocell FeLV");
    expect(rows[0].textContent).toContain("27/10/2027");
    expect(rows[1].textContent).toContain("sem data");
    await user.click(within(rows[0]).getByRole("button", { name: "Foto da etiqueta" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("img").getAttribute("src")).toBe(label.url);
  });

  it("downloads the PDF with the session header", async () => {
    const api = mockApi({
      "GET /animals/g1/card": card,
      "GET /animals/g1/card.pdf": raw("%PDF-1.4", {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="carteirinha-gata.pdf"',
      }),
    });
    const created = vi.fn(() => "blob:pdf");
    vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }));
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    const { user } = renderApp("/animais/g1/carteirinha");
    await user.click(await screen.findByRole("button", { name: "Baixar PDF" }));
    await waitFor(() => expect(clicks).toEqual(["carteirinha-gata.pdf"]));
    expect(api.to("GET /animals/g1/card.pdf")[0].headers.get("X-Session-Token")).toBe("token-1");
  });
});
