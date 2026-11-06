import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { captureAppState } from "@/test-utils/app-state";
import { animal, ANIMAL_ID, animalRoutes } from "@/test-utils/fixtures";
import { headerTitles, renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

beforeEach(() => signedIn());

describe("the tab bar", () => {
  it("shows Pets, Avisos and Perfil, and goes from one to another", async () => {
    fakeApi({
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
      "GET /notices": { body: [] },
    });
    const app = await renderApp("/");
    expect(await screen.findByTestId("tab-pets")).toBeTruthy();
    expect(screen.getByText(strings.tabs.pets)).toBeTruthy();
    expect(screen.getByText(strings.tabs.profile)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("tab-notices"));
    expect(app.pathname()).toBe("/avisos");
    await fireEvent.press(screen.getByTestId("tab-profile"));
    expect(app.pathname()).toBe("/perfil");
  });

  it("carries a dot on Avisos while a notice is unread, asked again in the foreground", async () => {
    let unread = false;
    const api = fakeApi({
      "GET /animals": { body: [] },
      "GET /notices/unread": () => ({ body: { unread } }),
    });
    const appState = captureAppState();
    await renderApp("/");
    await waitFor(() => expect(api.callsTo("GET /notices/unread")).toHaveLength(1));
    expect(screen.queryByTestId("unread-dot")).toBeNull();
    unread = true;
    await act(async () => appState.foreground());
    expect((await screen.findAllByLabelText(strings.tabs.unread)).length).toBeGreaterThan(
      0,
    );
    appState.restore();
  });

  it("stays on an animal", async () => {
    fakeApi(animalRoutes(animal()));
    await renderApp(`/animais/${ANIMAL_ID}`);
    expect(await screen.findByTestId("tab-pets")).toBeTruthy();
  });

  it("stays on the archived list, under Perfil", async () => {
    fakeApi({
      "GET /notices/unread": { body: { unread: false } },
      "GET /animals?status=archived": { body: [] },
    });
    await renderApp("/arquivados");
    expect(await screen.findByTestId("tab-profile")).toBeTruthy();
  });

  it("leaves the forms the whole screen", async () => {
    fakeApi(animalRoutes(animal()));
    await renderApp(`/animais/${ANIMAL_ID}/editar`);
    await screen.findByTestId("save-animal");
    expect(headerTitles()).toContain(strings.animal.editTitle);
    expect(screen.queryByTestId("tab-pets")).toBeNull();
  });
});
