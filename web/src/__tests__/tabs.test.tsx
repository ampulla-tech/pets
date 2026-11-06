import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { mockApi } from "./api";
import { renderApp } from "./render";
import { animal, animalRoutes } from "./fixtures";

const home = {
  "GET /animals": [animal({ id: "a", name: "Paçoca" })],
  "GET /notices/unread": { unread: false },
  "GET /notices": [],
};

function tabBar() {
  return screen.getByRole("navigation", { name: "Navegação" });
}

describe("the tab bar", () => {
  it("has Pets, Avisos and Perfil, with the current one marked", async () => {
    mockApi(home);
    const { user } = renderApp("/");
    await screen.findByText("Paçoca");
    const tabs = within(tabBar()).getAllByRole("link");
    expect(tabs.map((t) => [t.textContent, t.getAttribute("href")])).toEqual([
      ["Pets", "/"],
      ["Avisos", "/avisos"],
      ["Perfil", "/perfil"],
    ]);
    expect(tabs[0].getAttribute("aria-current")).toBe("page");
    await user.click(tabs[1]);
    expect(await screen.findByText("Nenhum aviso ainda")).toBeTruthy();
    expect(
      within(tabBar()).getByRole("link", { name: "Avisos" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("has no logo, menu or footer on the home", async () => {
    mockApi(home);
    renderApp("/");
    await screen.findByText("Paçoca");
    expect(screen.queryByRole("button", { name: "Menu" })).toBeNull();
    expect(screen.queryByText(/Conectado como/)).toBeNull();
  });

  it("carries a dot on Avisos while a notice is unread", async () => {
    mockApi({ ...home, "GET /notices/unread": { unread: true } });
    renderApp("/");
    expect(
      await within(tabBar()).findByRole("status", { name: "há avisos não lidos" }),
    ).toBeTruthy();
  });

  it("stays on an animal and leaves the forms the whole screen", async () => {
    const a = animal({ id: "a", name: "Paçoca" });
    mockApi({ ...home, ...animalRoutes(a) });
    renderApp("/animais/a");
    await screen.findAllByText("Paçoca");
    expect(tabBar()).toBeTruthy();
    expect(
      within(tabBar()).getByRole("link", { name: "Pets" }).getAttribute("aria-current"),
    ).toBe("page");
  });

  it("is not on a form", async () => {
    mockApi({ ...home, "GET /catalog": {} });
    renderApp("/animais/novo");
    await screen.findByText("Novo animal");
    expect(screen.queryByRole("navigation", { name: "Navegação" })).toBeNull();
  });
});

describe("the Perfil tab", () => {
  it("shows the account's e-mail and opens Arquivados", async () => {
    mockApi({ ...home, "GET /animals": [] });
    const { user, router } = renderApp("/perfil");
    expect(await screen.findByText("ana@example.com")).toBeTruthy();
    expect(screen.getByText("Sua conta no Pets")).toBeTruthy();
    await user.click(screen.getByRole("link", { name: "Arquivados" }));
    expect(router.state.location.pathname).toBe("/arquivados");
    expect(await screen.findByText("Nenhum animal arquivado.")).toBeTruthy();
  });

  it("keeps the old links working", async () => {
    mockApi({ ...home, "GET /animals": [] });
    renderApp("/arquivados");
    expect(await screen.findByText("Nenhum animal arquivado.")).toBeTruthy();
  });
});
