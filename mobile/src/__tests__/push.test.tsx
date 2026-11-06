import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { captureAppState } from "@/test-utils/app-state";
import { animal, ANIMAL_ID, animalRoutes, notice, reminder } from "@/test-utils/fixtures";
import { renderApp, signedIn, signedOut } from "@/test-utils/render";
import { devicePush, notificationTarget, registerPush } from "@/lib/push";
import { strings } from "@pets/core/strings";

const notifications = jest.requireMock("expo-notifications") as Record<string, jest.Mock>;
const device = jest.requireMock("expo-device") as { isDevice: boolean };
const store = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> })
  .__store;

const TOKEN = "pets.expoPushToken";
const NOT_NOW = "pets.push.notNow";

function permission(
  status: "granted" | "denied" | "undetermined",
  canAskAgain = status !== "denied",
) {
  notifications.getPermissionsAsync.mockResolvedValue({
    status,
    canAskAgain,
    granted: status === "granted",
  });
}

beforeEach(() => {
  signedOut();
  signedIn();
  jest.clearAllMocks();
  device.isDevice = true;
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID = "proj-1";
  permission("undetermined");
});

afterAll(() => {
  delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
});

/** The Avisos tab with one notice already read, so the ⋯ menu is only about push. */
function avisos() {
  return fakeApi({
    "GET /notices": { body: [notice({ read: true })] },
    "GET /notices/unread": { body: { unread: false } },
    "POST /push/expo": { status: 204 },
    "POST /push/expo/remove": { status: 204 },
  });
}

describe("push registration", () => {
  it("skips the token without an EAS project id, after the yes", async () => {
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    const api = fakeApi({});
    expect(await registerPush({ ask: true })).toBe("skipped");
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(api.calls).toHaveLength(0);
  });

  it("never asks on its own: without an earlier yes it does nothing", async () => {
    expect(await registerPush({ ask: false })).toBe("denied");
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("re-registers the token at start-up when the person already said yes", async () => {
    permission("granted");
    const api = fakeApi({
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
      "POST /push/expo": { status: 204 },
    });
    await renderApp("/");
    await waitFor(() => expect(api.callsTo("POST /push/expo")).toHaveLength(1));
  });

  it("forgets the token on the server when the permission was taken away", async () => {
    permission("denied");
    store.set(TOKEN, "ExponentPushToken[abc]");
    const api = fakeApi({
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
      "POST /push/expo/remove": { status: 204 },
    });
    await renderApp("/");
    await waitFor(() => expect(api.callsTo("POST /push/expo/remove")).toHaveLength(1));
    expect(api.callsTo("POST /push/expo/remove")[0].body).toEqual({
      token: "ExponentPushToken[abc]",
    });
    expect(store.has(TOKEN)).toBe(false);
    expect(api.callsTo("POST /push/expo")).toHaveLength(0);
  });

  it("also forgets it when the app comes back from the settings without the permission", async () => {
    permission("granted");
    store.set(TOKEN, "ExponentPushToken[test]");
    const appState = captureAppState();
    const api = fakeApi({
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
      "POST /push/expo": { status: 204 },
      "POST /push/expo/remove": { status: 204 },
    });
    await renderApp("/");
    await waitFor(() => expect(api.callsTo("POST /push/expo")).toHaveLength(1));
    permission("denied");
    await act(async () => appState.foreground());
    await waitFor(() => expect(api.callsTo("POST /push/expo/remove")).toHaveLength(1));
    expect(store.has(TOKEN)).toBe(false);
    appState.restore();
  });
});

describe("this phone's notification state", () => {
  it("is active only with a registered token and the permission", async () => {
    permission("granted");
    expect(await devicePush()).toBe("askable");
    store.set(TOKEN, "ExponentPushToken[test]");
    expect(await devicePush()).toBe("active");
  });

  it("can be asked while undetermined, or denied with the system still asking", async () => {
    expect(await devicePush()).toBe("askable");
    permission("denied", true);
    expect(await devicePush()).toBe("askable");
    permission("denied", false);
    expect(await devicePush()).toBe("blocked");
  });

  it("is unsupported without an EAS project id or off a physical phone", async () => {
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    expect(await devicePush()).toBe("unsupported");
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = "proj-1";
    device.isDevice = false;
    expect(await devicePush()).toBe("unsupported");
  });
});

describe("the notification in the Avisos tab", () => {
  it("offers a banner while it can be asked, and asks only on the tap", async () => {
    const api = avisos();
    await renderApp("/avisos");
    const banner = await screen.findByTestId("push-banner");
    expect(within(banner).getByText(strings.push.askTitle)).toBeTruthy();
    expect(within(banner).getByText(strings.push.askBody)).toBeTruthy();
    expect(within(banner).getByText(strings.push.notNow)).toBeTruthy();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    await fireEvent.press(within(banner).getByText(strings.push.enable));
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({
      projectId: "proj-1",
    });
    expect(api.callsTo("POST /push/expo")[0].body).toEqual({
      token: "ExponentPushToken[test]",
    });
    await waitFor(() => expect(screen.queryByTestId("push-banner")).toBeNull());
    expect(store.get(TOKEN)).toBe("ExponentPushToken[test]");
  });

  it("says so when switching on failed", async () => {
    notifications.getExpoPushTokenAsync.mockRejectedValueOnce(new Error("no network"));
    avisos();
    await renderApp("/avisos");
    await fireEvent.press(await screen.findByTestId("enable-push"));
    expect(await screen.findByText(strings.push.failed)).toBeTruthy();
  });

  it("keeps Agora não on this phone, for good", async () => {
    avisos();
    await renderApp("/avisos");
    await fireEvent.press(await screen.findByText(strings.push.notNow));
    expect(screen.queryByTestId("push-banner")).toBeNull();
    expect(store.get(NOT_NOW)).toBe("1");
  });

  it("shows no banner once Agora não was tapped, yet the ⋯ menu still offers it", async () => {
    store.set(NOT_NOW, "1");
    avisos();
    await renderApp("/avisos");
    await fireEvent.press(await screen.findByLabelText(strings.notices.more));
    expect(screen.queryByTestId("push-banner")).toBeNull();
    expect(screen.queryByText(strings.notices.markAllRead)).toBeNull();
    await fireEvent.press(screen.getByText(strings.push.enable));
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByLabelText(strings.notices.more)).toBeNull());
  });

  it("explains how to unblock it when the system will not ask again, with the iPhone's steps", async () => {
    permission("denied", false);
    avisos();
    await renderApp("/avisos");
    await fireEvent.press(await screen.findByLabelText(strings.notices.more));
    expect(screen.queryByTestId("push-banner")).toBeNull();
    await fireEvent.press(screen.getByText(strings.push.enable));
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    const sheet = await screen.findByTestId("push-blocked");
    expect(within(sheet).getByText(strings.push.blockedTitle)).toBeTruthy();
    expect(within(sheet).getByText(strings.push.blockedBody)).toBeTruthy();
    const first = within(sheet).getByTestId("step-1");
    expect(within(first).getByText("1")).toBeTruthy();
    expect(within(first).getByText("Ajustes").props.className).toContain("font-semibold");
    expect(within(sheet).getByTestId("step-3")).toBeTruthy();
    expect(within(sheet).getByText(strings.push.stillHere)).toBeTruthy();
    await fireEvent.press(within(sheet).getByText(strings.push.gotIt));
    expect(screen.queryByTestId("push-blocked")).toBeNull();
  });

  it("shows nothing about it where push is unsupported", async () => {
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    avisos();
    await renderApp("/avisos");
    await screen.findByTestId("notice-n1");
    expect(screen.queryByTestId("push-banner")).toBeNull();
    expect(screen.queryByLabelText(strings.notices.more)).toBeNull();
  });

  it("shows nothing about it once this phone is registered", async () => {
    permission("granted");
    store.set(TOKEN, "ExponentPushToken[test]");
    avisos();
    await renderApp("/avisos");
    await screen.findByTestId("notice-n1");
    expect(screen.queryByTestId("push-banner")).toBeNull();
    expect(screen.queryByLabelText(strings.notices.more)).toBeNull();
  });
});

describe("a tapped notification", () => {
  it("leads to the path of its link, or to the animal without one", () => {
    expect(
      notificationTarget({
        notice_id: "n1",
        animal_id: "a1",
        url: "https://pets.ampulla.tech/animais/a1?assunto=rabies",
      }),
    ).toEqual({ path: "/animais/a1?assunto=rabies", noticeId: "n1" });
    expect(notificationTarget({ notice_id: "n1", animal_id: "a1" })).toEqual({
      path: "/animais/a1",
      noticeId: "n1",
    });
    expect(notificationTarget({})).toBeNull();
  });

  it("opens the animal at the subject and marks the notice read, also when the tap launched the app", async () => {
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    notifications.useLastNotificationResponse.mockReturnValue({
      actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
      notification: {
        request: {
          identifier: "push-1",
          content: {
            data: {
              notice_id: "n1",
              animal_id: ANIMAL_ID,
              url: `https://pets.ampulla.tech/animais/${ANIMAL_ID}?assunto=rabies`,
            },
          },
        },
      },
    });
    const api = fakeApi({
      ...animalRoutes(animal(), [], [reminder()]),
      "POST /notices/n1/read": { status: 204 },
    });
    await renderApp("/");
    expect(await screen.findByTestId("focus")).toBeTruthy();
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalled();
    await waitFor(() => expect(api.callsTo("POST /notices/n1/read")).toHaveLength(1));
    notifications.useLastNotificationResponse.mockReturnValue(null);
  });
});
