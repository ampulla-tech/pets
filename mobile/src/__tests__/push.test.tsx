import { screen, waitFor } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, animalRoutes, reminder } from "@/test-utils/fixtures";
import { renderApp, signedIn } from "@/test-utils/render";
import { notificationTarget, registerPush } from "@/lib/push";

const notifications = jest.requireMock("expo-notifications") as Record<string, jest.Mock>;

beforeEach(() => {
  signedIn();
  jest.clearAllMocks();
  delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
});

describe("push registration", () => {
  it("skips the token without an EAS project id, after the yes", async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" });
    const api = fakeApi({});
    expect(await registerPush({ ask: true })).toBe("skipped");
    expect(notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
    expect(api.calls).toHaveLength(0);
  });

  it("never asks on its own: without an earlier yes it does nothing", async () => {
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" });
    expect(await registerPush({ ask: false })).toBe("denied");
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  });

  it("re-registers the token at start-up when the person already said yes", async () => {
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = "proj-1";
    notifications.getPermissionsAsync.mockResolvedValue({ status: "granted" });
    const api = fakeApi({
      "GET /animals": { body: [] },
      "GET /reminders/upcoming": { body: [] },
      "POST /push/expo": { status: 204 },
    });
    await renderApp("/");
    await waitFor(() => expect(api.callsTo("POST /push/expo")).toHaveLength(1));
    notifications.getPermissionsAsync.mockReset();
    notifications.getPermissionsAsync.mockResolvedValue({ status: "undetermined" });
  });
});

describe("a tapped notification", () => {
  it("leads to the animal at the reminder's subject", () => {
    expect(notificationTarget({ animal_id: "a1", subject: "rabies", url: "https://x" })).toBe("/animais/a1?assunto=rabies");
    expect(notificationTarget({})).toBeNull();
  });

  it("opens the animal at the subject, also when the tap launched the app", async () => {
    notifications.useLastNotificationResponse.mockReturnValue({
      actionIdentifier: "expo.modules.notifications.actions.DEFAULT",
      notification: {
        request: { identifier: "n1", content: { data: { animal_id: ANIMAL_ID, subject: "rabies", url: "https://x" } } },
      },
    });
    fakeApi(animalRoutes(animal(), [], [reminder()]));
    await renderApp("/");
    expect(await screen.findByTestId("focus")).toBeTruthy();
    expect(notifications.clearLastNotificationResponse).toHaveBeenCalled();
    notifications.useLastNotificationResponse.mockReturnValue(null);
  });
});
