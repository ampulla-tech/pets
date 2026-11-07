import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { animal, animalRoutes } from "./fixtures";

describe("animal", () => {
  it("registers an animal with a month-and-year birth, then sends its photo", async () => {
    const created = animal({ id: "n1", species: "dog", name: "Bug" });
    const api = mockApi({
      "POST /animals": reply(201, created),
      "POST /animals/:id/photo": created,
      ...animalRoutes(created),
    });
    const { user, router } = renderApp("/animais/novo");
    await user.click(screen.getByRole("radio", { name: "Canino" }));
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

  it("writes SRD in the breed from its shortcut", async () => {
    const created = animal({ id: "n2", species: "cat", name: "Nina", breed: "SRD" });
    const api = mockApi({
      "POST /animals": reply(201, created),
      ...animalRoutes(created),
    });
    const { user, router } = renderApp("/animais/novo");
    await user.click(screen.getByRole("radio", { name: "Felino" }));
    await user.type(screen.getByLabelText("Nome"), "Nina");
    await user.click(screen.getByRole("button", { name: "SRD (sem raça definida)" }));
    expect((screen.getByLabelText(/Raça/) as HTMLInputElement).value).toBe("SRD");
    await user.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/animais/n2"));
    expect(api.to("POST /animals")[0].json).toMatchObject({
      species: "cat",
      breed: "SRD",
    });
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

  it("home lists only the animals, each badge saying what is due and when", async () => {
    mockApi({
      "GET /animals": [
        animal({
          id: "b",
          species: "dog",
          name: "Thor",
          age: { years: 0, months: 1, approximate: false },
          badge: { state: "overdue", days: -7, kind: "internal", others: 1 },
        }),
        animal({
          id: "g",
          name: "Mel",
          badge: { state: "due_soon", days: 6, kind: "external", others: 0 },
        }),
        animal({ id: "n", name: "Nina" }),
      ],
      "GET /notices/unread": { unread: false },
    });
    renderApp("/");
    expect(await screen.findByRole("heading", { name: "Meus pets" })).toBeTruthy();
    expect(
      (await screen.findByRole("link", { name: "Adicionar" })).getAttribute("href"),
    ).toBe("/animais/novo");
    const cards = await screen.findAllByRole("link", { name: /Thor|Mel|Nina/ });
    expect(cards[0].textContent).toContain("1 mês");
    expect(cards[0].textContent).toContain("Vermífugo atrasado · +1");
    expect(cards[1].textContent).toContain("Antipulgas vence em 6 dias");
    // An animal in order has no badge at all.
    expect(cards[2].textContent).not.toMatch(/vence|atrasad|Em dia/);
    expect(screen.queryByText("Próximos")).toBeNull();
    expect(screen.queryByText("Notificações")).toBeNull();
  });
});
