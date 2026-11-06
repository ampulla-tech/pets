import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";

const tab = {
  "GET /notices": [],
  "GET /notices/unread": { unread: false },
  "GET /push/webpush/key": { public_key: "AQID" },
};
const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";
const CHROME =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36";

function browser({
  permission = "default",
  subscription = null as unknown,
  subscribe = vi.fn(),
} = {}) {
  const requestPermission = vi.fn().mockResolvedValue("granted");
  vi.stubGlobal(
    "Notification",
    Object.assign(function Notification() {}, { permission, requestPermission }),
  );
  vi.stubGlobal("PushManager", function PushManager() {});
  const registration = {
    pushManager: { getSubscription: vi.fn().mockResolvedValue(subscription), subscribe },
  };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      ready: Promise.resolve(registration),
      getRegistration: vi.fn().mockResolvedValue(registration),
      register: vi.fn(),
    },
  });
  return { requestPermission };
}

async function openMenu(user: ReturnType<typeof renderApp>["user"]) {
  await user.click(await screen.findByRole("button", { name: "Mais opções" }));
  return screen.findByRole("menu");
}

describe("the notification on this browser, in the Avisos tab", () => {
  it("invites to switch on, asks the permission only on the tap, and registers the browser", async () => {
    const subscription = {
      endpoint: "https://push.test/abc",
      toJSON: () => ({
        endpoint: "https://push.test/abc",
        keys: { p256dh: "P", auth: "A" },
      }),
    };
    const subscribe = vi.fn().mockResolvedValue(subscription);
    const { requestPermission } = browser({ subscribe });
    const api = mockApi({ ...tab, "POST /push/webpush": reply(204) });
    const { user } = renderApp("/avisos");
    expect(
      await screen.findByText("Receba os avisos também como notificação."),
    ).toBeTruthy();
    expect(requestPermission).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Ativar notificações" }));
    await waitFor(() =>
      expect(screen.queryByText("Receba os avisos também como notificação.")).toBeNull(),
    );
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(Array.from(subscribe.mock.calls[0][0].applicationServerKey)).toEqual([
      1, 2, 3,
    ]);
    expect(api.to("POST /push/webpush")[0].json).toEqual({
      endpoint: "https://push.test/abc",
      keys: { p256dh: "P", auth: "A" },
    });
    // Active: nothing to offer, nothing to mark, so no menu.
    expect(screen.queryByRole("button", { name: "Mais opções" })).toBeNull();
  });

  it("hides the banner for good on Agora não, and still offers it in the menu", async () => {
    browser();
    mockApi(tab);
    const { user } = renderApp("/avisos");
    await user.click(await screen.findByRole("button", { name: "Agora não" }));
    expect(screen.queryByText("Receba os avisos também como notificação.")).toBeNull();
    expect(localStorage.getItem("pets.push.notNow")).toBe("1");
    const menu = await openMenu(user);
    expect(
      within(menu).getByRole("menuitem", { name: "Ativar notificações" }),
    ).toBeTruthy();
  });

  it("does not count a permission without a subscription as switched on", async () => {
    browser({ permission: "granted" });
    mockApi(tab);
    renderApp("/avisos");
    expect(
      await screen.findByText("Receba os avisos também como notificação."),
    ).toBeTruthy();
  });

  it("is silent when blocked, and the menu shows how to unblock in this browser", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(CHROME);
    const { requestPermission } = browser({ permission: "denied" });
    mockApi(tab);
    const { user } = renderApp("/avisos");
    const menu = await openMenu(user);
    expect(screen.queryByText("Receba os avisos também como notificação.")).toBeNull();
    await user.click(within(menu).getByRole("menuitem", { name: "Ativar notificações" }));
    const sheet = await screen.findByRole("dialog", {
      name: "As notificações estão bloqueadas neste aparelho",
    });
    const steps = within(sheet).getAllByRole("listitem");
    expect(steps.map((s) => s.textContent)).toEqual([
      "1Clique em Visualizar informações do site, à esquerda do endereço.",
      "2Ative a opção Notificações.",
      "3Recarregue a página.",
    ]);
    expect(within(sheet).getByText("Visualizar informações do site").tagName).toBe("B");
    expect(requestPermission).not.toHaveBeenCalled();
    await user.click(within(sheet).getByRole("button", { name: "Entendi" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("on an iPhone in Safari, shows the install steps, and the menu opens them again", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    mockApi(tab);
    const { user } = renderApp("/avisos");
    expect(
      await screen.findByText("Para receber notificações no iPhone, instale o Pets."),
    ).toBeTruthy();
    expect(screen.getByText("Adicionar à Tela de Início")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Agora não" }));
    const menu = await openMenu(user);
    await user.click(within(menu).getByRole("menuitem", { name: "Ativar notificações" }));
    const sheet = await screen.findByRole("dialog", {
      name: "Para receber notificações no iPhone, instale o Pets",
    });
    expect(within(sheet).getAllByRole("listitem")).toHaveLength(3);
  });

  it("says nothing about notifications when the server has no key", async () => {
    browser();
    mockApi({ ...tab, "GET /push/webpush/key": { public_key: "" } });
    renderApp("/avisos");
    await screen.findByText("Nenhum aviso ainda");
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText("Receba os avisos também como notificação.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Mais opções" })).toBeNull();
  });

  it("forgets this browser on the server when the permission was taken away", async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    browser({
      permission: "default",
      subscription: { endpoint: "https://push.test/old", unsubscribe },
    });
    const api = mockApi({
      ...tab,
      "GET /animals": [],
      "POST /push/webpush/remove": reply(204),
    });
    renderApp("/");
    await waitFor(() => expect(api.to("POST /push/webpush/remove")).toHaveLength(1));
    expect(api.to("POST /push/webpush/remove")[0].json).toEqual({
      endpoint: "https://push.test/old",
    });
    expect(unsubscribe).toHaveBeenCalled();
  });

  it("leaves the home without anything about notifications", async () => {
    browser();
    mockApi({ ...tab, "GET /animals": [] });
    renderApp("/");
    await screen.findByText("Nenhum animal ainda.");
    expect(screen.queryByText("Ativar notificações")).toBeNull();
  });
});
