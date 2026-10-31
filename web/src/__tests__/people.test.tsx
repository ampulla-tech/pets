import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { access, animal, animalRoutes } from "./fixtures";

const lacan = animal();
const home = {
  "GET /animals": [],
  "GET /reminders/upcoming": [],
  "GET /push/webpush/key": { public_key: "" },
};

describe("people", () => {
  it("lists who has access with their roles", async () => {
    mockApi({
      ...animalRoutes(lacan),
      "GET /animals/a1/accesses": [
        access(),
        access({ id: 2, email: "bia@example.com", is_me: false }),
        access({
          id: 3,
          email: "caio@example.com",
          role: "guest",
          ends_on: "2026-12-20",
          is_me: false,
        }),
      ],
    });
    renderApp("/animais/a1/pessoas");
    const rows = await screen.findAllByRole("listitem");
    expect(rows.map((r) => r.textContent)).toEqual([
      "ana@example.com (você)Tutor",
      "bia@example.comTutorRemover",
      "caio@example.comConvidado · até 20/12/2026Remover",
    ]);
  });

  it("invites a guest until a day and shows the link to copy", async () => {
    const api = mockApi({
      ...animalRoutes(lacan),
      "GET /animals/a1/accesses": [access()],
      "POST /animals/a1/invites": reply(201, {
        token: "tk",
        url: "http://localhost:5180/convite/tk",
        role: "guest",
        access_ends_on: "2030-01-10",
        expires_at: "2030-01-03T00:00:00Z",
      }),
    });
    const { user } = renderApp("/animais/a1/pessoas");
    // After user-event's setup, which puts its own clipboard in place.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    await user.click(await screen.findByRole("button", { name: "Convidar" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Convidado/ }));
    await user.type(within(dialog).getByLabelText(/Acesso até/), "2030-01-10");
    await user.click(within(dialog).getByRole("button", { name: "Gerar link" }));
    expect(
      await within(dialog).findByDisplayValue("http://localhost:5180/convite/tk"),
    ).toBeTruthy();
    expect(api.to("POST /animals/a1/invites")[0].json).toEqual({
      role: "guest",
      access_ends_on: "2030-01-10",
    });
    await user.click(within(dialog).getByRole("button", { name: "Copiar link" }));
    expect(writeText).toHaveBeenCalledWith("http://localhost:5180/convite/tk");
    expect(
      await within(dialog).findByRole("button", { name: "Link copiado" }),
    ).toBeTruthy();
  });

  it("removes someone, as a tutor", async () => {
    const api = mockApi({
      ...animalRoutes(lacan),
      "GET /animals/a1/accesses": [
        access(),
        access({ id: 2, email: "bia@example.com", is_me: false }),
      ],
      "DELETE /animals/a1/accesses/2": reply(204),
    });
    const { user } = renderApp("/animais/a1/pessoas");
    await user.click(await screen.findByRole("button", { name: "Remover" }));
    const confirm = await screen.findByRole("alertdialog");
    expect(confirm.textContent).toContain("Remover bia@example.com deste animal?");
    await user.click(within(confirm).getByRole("button", { name: "Remover" }));
    await waitFor(() => expect(api.to("DELETE /animals/a1/accesses/2")).toHaveLength(1));
  });

  it("stops the last tutor from leaving and offers the two ways out", async () => {
    const api = mockApi({
      ...animalRoutes(lacan),
      ...home,
      "GET /animals/a1/accesses": [access()],
      "DELETE /animals/a1/accesses/1": reply(409, { code: "last_tutor", detail: "x" }),
      "DELETE /animals/a1": reply(204),
      "POST /animals/a1/invites": reply(201, {
        token: "t",
        url: "u",
        role: "tutor",
        access_ends_on: null,
        expires_at: "x",
      }),
    });
    const { user, router } = renderApp("/animais/a1/pessoas");
    await user.click(await screen.findByRole("button", { name: "Sair deste animal" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Sair deste animal",
      }),
    );
    const blocked = await screen.findByRole("dialog", { name: "Você é o último tutor" });
    expect(
      within(blocked).getByRole("button", { name: "Convidar outro tutor" }),
    ).toBeTruthy();
    // Way out 1: invite another tutor, with the role already set.
    await user.click(
      within(blocked).getByRole("button", { name: "Convidar outro tutor" }),
    );
    const invite = await screen.findByRole("dialog", {
      name: "Convidar para este animal",
    });
    expect(
      (within(invite).getByRole("radio", { name: /Tutor/ }) as HTMLInputElement).checked,
    ).toBe(true);
    await user.click(within(invite).getByRole("button", { name: "Cancelar" }));
    // Way out 2: delete the animal, after confirming.
    await user.click(screen.getByRole("button", { name: "Sair deste animal" }));
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Sair deste animal",
      }),
    );
    await user.click(
      within(
        await screen.findByRole("dialog", { name: "Você é o último tutor" }),
      ).getByRole("button", { name: "Apagar o animal" }),
    );
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Apagar",
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(api.to("DELETE /animals/a1")).toHaveLength(1);
  });

  it("lets a guest leave, and shows no invite or remove", async () => {
    const api = mockApi({
      ...animalRoutes(animal({ role: "guest" })),
      ...home,
      "GET /animals/a1/accesses": [
        access({ id: 2, email: "ana@example.com", is_me: false }),
        access({ id: 5, email: "eu@example.com", role: "guest" }),
      ],
      "DELETE /animals/a1/accesses/5": reply(204),
    });
    const { user, router } = renderApp("/animais/a1/pessoas");
    await user.click(await screen.findByRole("button", { name: "Sair deste animal" }));
    expect(screen.queryByRole("button", { name: "Convidar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover" })).toBeNull();
    await user.click(
      within(await screen.findByRole("alertdialog")).getByRole("button", {
        name: "Sair deste animal",
      }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(api.to("DELETE /animals/a1/accesses/5")).toHaveLength(1);
  });
});

const preview = (over = {}) => ({
  state: "valid",
  role: "guest",
  access_ends_on: "2026-12-20",
  invited_by: "ana@example.com",
  animal: { name: "Lacan", species: "cat", photo_url: null },
  already_member: false,
  animal_id: null,
  ...over,
});

describe("invite", () => {
  it("shows a visitor with no account who invited, the animal, the role and the end", async () => {
    mockApi({ "GET /invites/tk": preview() });
    renderApp("/convite/tk", { as: null });
    expect(
      await screen.findByText(
        "ana@example.com convidou você para cuidar de Lacan como convidado.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("O acesso vale até 20/12/2026.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Criar conta" }).getAttribute("href")).toBe(
      "/cadastro?volta=%2Fconvite%2Ftk",
    );
    expect(screen.getByRole("link", { name: "Entrar" }).getAttribute("href")).toBe(
      "/entrar?volta=%2Fconvite%2Ftk",
    );
  });

  it("accepts and opens the animal", async () => {
    const api = mockApi({
      "GET /invites/tk": preview(),
      "POST /invites/tk/accept": {
        animal_id: "a1",
        role: "guest",
        ends_on: "2026-12-20",
      },
      ...animalRoutes(animal({ role: "guest" })),
    });
    const { user, router } = renderApp("/convite/tk");
    await user.click(await screen.findByRole("button", { name: "Aceitar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/animais/a1"));
    expect(api.to("POST /invites/tk/accept")[0].headers.get("X-Session-Token")).toBe(
      "token-1",
    );
  });

  it.each([
    ["expired", "Este convite venceu."],
    ["used", "Este convite já foi usado."],
  ])("says when the invite is %s", async (state, text) => {
    mockApi({ "GET /invites/tk": preview({ state }) });
    renderApp("/convite/tk");
    expect(await screen.findByText(new RegExp(text))).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Aceitar" })).toBeNull();
  });

  it("says when the caller already has access", async () => {
    mockApi({ "GET /invites/tk": preview({ already_member: true, animal_id: "a1" }) });
    renderApp("/convite/tk");
    expect(await screen.findByText("Você já tem acesso a este animal.")).toBeTruthy();
    expect(
      screen.getByRole("link", { name: "Abrir o animal" }).getAttribute("href"),
    ).toBe("/animais/a1");
  });

  it("explains an accept refused because the link was spent meanwhile", async () => {
    mockApi({
      "GET /invites/tk": preview(),
      "POST /invites/tk/accept": reply(409, { code: "invite_used", detail: "x" }),
    });
    const { user } = renderApp("/convite/tk");
    await user.click(await screen.findByRole("button", { name: "Aceitar" }));
    expect(await screen.findByText(/Este convite já foi usado/)).toBeTruthy();
  });
});
