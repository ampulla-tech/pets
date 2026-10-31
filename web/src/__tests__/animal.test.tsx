import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { animal, animalRoutes, reminder } from "./fixtures";

describe("animal", () => {
  it("registers an animal with a month-and-year birth, then sends its photo", async () => {
    const created = animal({ id: "n1", species: "dog", name: "Bug" });
    const api = mockApi({
      "POST /animals": reply(201, created),
      "POST /animals/:id/photo": created,
      ...animalRoutes(created),
    });
    const { user, router } = renderApp("/animais/novo");
    await user.click(screen.getByRole("radio", { name: "Cão" }));
    await user.type(screen.getByLabelText("Nome"), "Bug");
    await user.type(screen.getByLabelText(/Raça/), "Dachshund");
    await user.click(screen.getByRole("radio", { name: "Macho" }));
    await user.click(screen.getByRole("radio", { name: "Sim" }));
    await user.click(screen.getByRole("radio", { name: "Mês e ano" }));
    fireEvent.change(
      screen.getByLabelText("Mês e ano", { selector: "input:not([type=radio])" }),
      {
        target: { value: "2025-03" },
      },
    );
    const photo = new File(["x"], "bug.jpg", { type: "image/jpeg" });
    await user.upload(screen.getByLabelText("Foto"), photo);
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/animais/n1"));
    expect(api.to("POST /animals")[0].json).toEqual({
      species: "dog",
      name: "Bug",
      breed: "Dachshund",
      sex: "male",
      neutered: true,
      coat: "",
      microchip: "",
      birth: { precision: "month", value: "2025-03" },
      adopted_on: null,
    });
    const upload = api.to("POST /animals/:id/photo")[0];
    expect((upload.form?.get("file") as File).name).toBe("bug.jpg");
  });

  it("asks for the year when the birth is year only", async () => {
    const api = mockApi({});
    const { user } = renderApp("/animais/novo");
    await user.type(screen.getByLabelText("Nome"), "Bug");
    await user.click(screen.getByRole("radio", { name: "Só o ano" }));
    await user.type(
      screen.getByLabelText("Só o ano", { selector: "input:not([type=radio])" }),
      "25",
    );
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    expect(await screen.findByText("Digite o ano com 4 dígitos.")).toBeTruthy();
    expect(api.to("POST /animals")).toHaveLength(0);
  });

  it("edits an animal, keeping what it had", async () => {
    const lacan = animal({
      birth: { precision: "exact", value: "2020-05-02" },
      microchip: "123",
    });
    const api = mockApi({ ...animalRoutes(lacan), "PUT /animals/a1": lacan });
    const { user, router } = renderApp("/animais/a1/editar");
    const name = (await screen.findByLabelText("Nome")) as HTMLInputElement;
    expect(name.value).toBe("Lacan");
    await user.clear(name);
    await user.type(name, "Lacan II");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/animais/a1"));
    const body = api.to("PUT /animals/a1")[0].json as Record<string, unknown>;
    expect(body.name).toBe("Lacan II");
    expect(body.birth).toEqual({ precision: "exact", value: "2020-05-02" });
    expect(body.microchip).toBe("123");
  });

  it("home lists the animals with age and badge, and Próximos on top", async () => {
    mockApi({
      "GET /animals": [
        animal({
          id: "b",
          species: "dog",
          name: "Bug",
          age: { years: 0, months: 1, approximate: false },
          badge: { state: "overdue", days: null },
        }),
        animal({ id: "g", name: "GATA", badge: { state: "due_soon", days: 6 } }),
      ],
      "GET /reminders/upcoming": [
        reminder({
          animal_id: "b",
          animal_name: "Bug",
          subject: "internal",
          subject_label: "Verme interno",
          state: "overdue",
          days: -8,
          due_on: "2026-10-23",
          record_kind: "antiparasitic",
          record_id: "p1",
        }),
        reminder({
          animal_id: "b",
          animal_name: "Bug",
          subject: "distemper",
          subject_label: "Cinomose",
          state: "upcoming",
          days: 6,
          due_on: "2026-11-06",
          record_id: "v9",
        }),
        reminder({
          animal_id: "b",
          animal_name: "Bug",
          subject: "parvovirus",
          subject_label: "Parvovirose",
          state: "upcoming",
          days: 6,
          due_on: "2026-11-06",
          record_id: "v9",
        }),
      ],
      "GET /push/webpush/key": { public_key: "" },
    });
    renderApp("/");
    const upcoming = await screen.findByRole("region", { name: "Próximos" });
    const links = await within(upcoming).findAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0].textContent).toContain("Atrasado há 8 dias");
    // One dose covering two diseases reads as one line.
    expect(links[1].textContent).toContain("Cinomose, Parvovirose");
    expect(links[1].getAttribute("href")).toBe("/animais/b?assunto=distemper");
    const cards = within(
      screen.getByRole("region", { name: "Seus animais" }),
    ).getAllByRole("link", { name: /Bug|GATA/ });
    expect(cards[0].textContent).toContain("1 mês");
    expect(cards[0].textContent).toContain("Atrasado");
    expect(cards[1].textContent).toContain("Vence em 6 dias");
  });
});
