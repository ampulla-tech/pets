import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { NoticeOut } from "@pets/core/api/generated";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { animal, animalRoutes } from "./fixtures";

function notice(over: Partial<NoticeOut> = {}): NoticeOut {
  return {
    id: "n1",
    animal_id: "a",
    animal_name: "Paçoca",
    sent_at: new Date().toISOString(),
    title: "Hoje é dia de vacinar a Paçoca.",
    body: "Vanguard Plus",
    url: "/animais/a?assunto=rabies",
    read: false,
    ...over,
  };
}

const yesterday = new Date(Date.now() - 86_400_000).toISOString();

function routes(notices: NoticeOut[], unread = notices.some((n) => !n.read)) {
  return {
    "GET /notices": notices,
    "GET /notices/unread": { unread },
    "GET /push/webpush/key": { public_key: "" },
  };
}

describe("the Avisos tab", () => {
  it("lists the notices by day, the unread ones marked, and opening it reads nothing", async () => {
    const api = mockApi(
      routes([
        notice(),
        notice({
          id: "n2",
          animal_name: "Mel",
          sent_at: yesterday,
          title: "O antipulgas da Mel vence em 7 dias.",
          body: "NexGard",
          read: true,
        }),
      ]),
    );
    renderApp("/avisos");
    const today = await screen.findByRole("region", { name: "Hoje" });
    const first = within(today).getByRole("button");
    expect(first.textContent).toContain("Hoje é dia de vacinar a Paçoca.");
    expect(first.textContent).toContain("Vanguard Plus");
    expect(within(first).getByLabelText("Não lido")).toBeTruthy();
    const older = screen.getByRole("region", { name: "Ontem" });
    expect(within(older).getByRole("button").getAttribute("data-read")).toBe("true");
    expect(api.to("POST /notices/:id/read")).toHaveLength(0);
    expect(api.to("POST /notices/read")).toHaveLength(0);
  });

  it("opens the animal from a notice and marks that one read", async () => {
    const a = animal({ id: "a", name: "Paçoca" });
    const api = mockApi({
      ...routes([notice()]),
      ...animalRoutes(a),
      "POST /notices/:id/read": reply(204),
    });
    const { user, router } = renderApp("/avisos");
    await user.click(
      await screen.findByRole("button", { name: /Hoje é dia de vacinar/ }),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/animais/a"));
    expect(router.state.location.search).toBe("?assunto=rabies");
    await waitFor(() => expect(api.to("POST /notices/:id/read")).toHaveLength(1));
    expect(api.to("POST /notices/:id/read")[0].path).toBe("/notices/n1/read");
  });

  it("marks every notice read from the ⋯ menu, only offered while one is unread", async () => {
    let read = false;
    const api = mockApi({
      "GET /notices": () => [notice({ read })],
      "GET /notices/unread": () => ({ unread: !read }),
      "GET /push/webpush/key": { public_key: "" },
      "POST /notices/read": () => {
        read = true;
        return reply(204);
      },
    });
    const { user } = renderApp("/avisos");
    await screen.findByText("Hoje é dia de vacinar a Paçoca.");
    await user.click(screen.getByRole("button", { name: "Mais opções" }));
    await user.click(
      await screen.findByRole("menuitem", { name: "Marcar todos como lidos" }),
    );
    await waitFor(() => expect(api.to("POST /notices/read")).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "há avisos não lidos" })).toBeNull(),
    );
    // Nothing left to mark, and no notification to offer here: no menu.
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Mais opções" })).toBeNull(),
    );
  });

  it("says what the tab is for when it is empty, with no menu", async () => {
    mockApi(routes([]));
    renderApp("/avisos");
    expect(await screen.findByText("Nenhum aviso ainda")).toBeTruthy();
    expect(screen.getByText(/o aviso aparece aqui/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mais opções" })).toBeNull();
  });

  it("says the list holds the latest 50", async () => {
    mockApi(
      routes(Array.from({ length: 50 }, (_, i) => notice({ id: `n${i}`, read: true }))),
    );
    renderApp("/avisos");
    expect(await screen.findByText("Mostrando os últimos 50 avisos.")).toBeTruthy();
  });

  it("marks read the notice a push was opened from", async () => {
    const a = animal({ id: "a", name: "Paçoca" });
    const api = mockApi({
      ...routes([notice()]),
      ...animalRoutes(a),
      "GET /animals": [],
      "POST /notices/:id/read": reply(204),
    });
    const { router } = renderApp("/animais/a?assunto=rabies&aviso=n1");
    await waitFor(() => expect(api.to("POST /notices/:id/read")).toHaveLength(1));
    expect(api.to("POST /notices/:id/read")[0].path).toBe("/notices/n1/read");
    await waitFor(() => expect(router.state.location.search).toBe("?assunto=rabies"));
  });
});
