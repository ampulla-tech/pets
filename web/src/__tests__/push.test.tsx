import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";

const home = { "GET /animals": [], "GET /reminders/upcoming": [] };
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1";

function browserWithPush(subscribe: ReturnType<typeof vi.fn>) {
  const requestPermission = vi.fn().mockResolvedValue("granted");
  vi.stubGlobal("Notification", Object.assign(function Notification() {}, { permission: "default", requestPermission }));
  vi.stubGlobal("PushManager", function PushManager() {});
  const registration = { pushManager: { getSubscription: vi.fn().mockResolvedValue(null), subscribe } };
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve(registration), getRegistration: vi.fn().mockResolvedValue(registration), register: vi.fn() },
  });
  return { requestPermission };
}

describe("notifications", () => {
  it("asks the permission on the tap, subscribes with the API's key and registers the browser", async () => {
    const subscription = {
      endpoint: "https://push.test/abc",
      toJSON: () => ({ endpoint: "https://push.test/abc", keys: { p256dh: "P", auth: "A" } }),
    };
    const subscribe = vi.fn().mockResolvedValue(subscription);
    const { requestPermission } = browserWithPush(subscribe);
    const api = mockApi({ ...home, "GET /push/webpush/key": { public_key: "AQID" }, "POST /push/webpush": reply(204) });
    const { user } = renderApp("/");
    const button = await screen.findByRole("button", { name: "Ativar notificações" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    expect(requestPermission).not.toHaveBeenCalled();
    await user.click(button);
    expect(await screen.findByText("Notificações ativadas neste aparelho.")).toBeTruthy();
    expect(requestPermission).toHaveBeenCalledOnce();
    const options = subscribe.mock.calls[0][0];
    expect(options.userVisibleOnly).toBe(true);
    expect(Array.from(options.applicationServerKey)).toEqual([1, 2, 3]);
    expect(api.to("POST /push/webpush")[0].json).toEqual({ endpoint: "https://push.test/abc", keys: { p256dh: "P", auth: "A" } });
  });

  it("says push is off when the server has no key, without asking", async () => {
    const { requestPermission } = browserWithPush(vi.fn());
    mockApi({ ...home, "GET /push/webpush/key": { public_key: "" } });
    const { user } = renderApp("/");
    const button = await screen.findByRole("button", { name: "Ativar notificações" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    await user.click(button);
    expect(await screen.findByText(/desligadas neste servidor/)).toBeTruthy();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("on an iPhone outside the Home Screen, explains how to install instead", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue(IPHONE);
    mockApi({ ...home });
    renderApp("/");
    expect(await screen.findByText(/Adicionar à Tela de Início/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ativar notificações" })).toBeNull();
  });
});
