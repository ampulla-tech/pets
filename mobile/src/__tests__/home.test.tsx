import { fireEvent, screen } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, reminder } from "@/test-utils/fixtures";
import { renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const notifications = jest.requireMock("expo-notifications") as Record<string, jest.Mock>;

beforeEach(() => signedIn());

describe("the home", () => {
  it("lists what falls due and the animals, each with its badge", async () => {
    fakeApi({
      "GET /animals": {
        body: [
          animal({ name: "Bug", id: "b1", species: "dog", badge: { state: "overdue", days: null } }),
          animal({ badge: { state: "due_soon", days: 6 } }),
        ],
      },
      "GET /reminders/upcoming": { body: [reminder()] },
    });
    await renderApp("/");
    expect(await screen.findByText(strings.home.upcomingTitle)).toBeTruthy();
    expect(screen.getByText("Lacan · Raiva")).toBeTruthy();
    expect(screen.getByText("Atrasado")).toBeTruthy();
    expect(screen.getAllByText("Vence em 6 dias").length).toBe(2);
    expect(screen.getByText("Gato · SRD · cerca de 5 anos")).toBeTruthy();
  });

  it("opens the animal at the reminder's subject from Próximos", async () => {
    fakeApi({
      "GET /animals": { body: [animal()] },
      "GET /reminders/upcoming": { body: [reminder()] },
    });
    const app = await renderApp("/");
    await fireEvent.press(await screen.findByTestId("reminder-Lacan-rabies"));
    expect(app.pathname()).toBe(`/animais/${ANIMAL_ID}`);
    expect(app.params()).toMatchObject({ assunto: "rabies" });
  });

  it("says so when there is no animal yet", async () => {
    fakeApi({ "GET /animals": { body: [] }, "GET /reminders/upcoming": { body: [] } });
    await renderApp("/");
    expect(await screen.findByText(strings.home.empty)).toBeTruthy();
    expect(screen.getByText(strings.home.emptyHint)).toBeTruthy();
  });

  it("asks for notifications only on a tap, and registers the Expo token when the build has a project id", async () => {
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID = "proj-1";
    const api = fakeApi({
      "GET /animals": { body: [animal()] },
      "GET /reminders/upcoming": { body: [] },
      "POST /push/expo": { status: 204 },
    });
    await renderApp("/");
    await screen.findByTestId("push-card");
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    notifications.getPermissionsAsync.mockResolvedValueOnce({ status: "undetermined" });
    await fireEvent.press(screen.getByTestId("enable-push"));
    expect(notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({ projectId: "proj-1" });
    expect(api.callsTo("POST /push/expo")[0].body).toEqual({ token: "ExponentPushToken[test]" });
    expect(screen.queryByTestId("push-card")).toBeNull();
    delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  });
});
