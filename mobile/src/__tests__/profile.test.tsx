import { fireEvent, screen } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const store = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> })
  .__store;

beforeEach(() => signedIn());

describe("the Perfil tab", () => {
  it("shows the account's e-mail and opens the archived list", async () => {
    fakeApi({
      "GET /notices/unread": { body: { unread: false } },
      "GET /animals?status=archived": { body: [] },
    });
    const app = await renderApp("/perfil");
    expect(await screen.findByText("ana@example.com")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText(strings.profile.account)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("archived"));
    expect(app.pathname()).toBe("/arquivados");
    expect(await screen.findByText(strings.archive.empty)).toBeTruthy();
  });

  it("signs out with Sair, forgetting this phone's push token", async () => {
    store.set("pets.expoPushToken", "ExponentPushToken[abc]");
    const api = fakeApi({
      "GET /notices/unread": { body: { unread: false } },
      "POST /push/expo/remove": { status: 204 },
      "DELETE /_allauth/app/v1/auth/session": { status: 401, body: { status: 401 } },
    });
    await renderApp("/perfil");
    await fireEvent.press(await screen.findByText(strings.profile.signOut));
    expect(await screen.findByTestId("sign-in")).toBeTruthy();
    expect(api.callsTo("POST /push/expo/remove")[0].body).toEqual({
      token: "ExponentPushToken[abc]",
    });
    expect(store.has("pets.session")).toBe(false);
  });
});
