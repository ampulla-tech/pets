import { fireEvent, screen } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { animal } from "@/test-utils/fixtures";
import { headerTitles, renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

beforeEach(() => signedIn());

const unread = (value: boolean) => ({
  "GET /notices/unread": { body: { unread: value } },
});

describe("the Pets tab", () => {
  it("lists only the animals, a badge only on the ones with something due", async () => {
    fakeApi({
      ...unread(false),
      "GET /animals": {
        body: [
          animal({
            name: "Bug",
            id: "b1",
            species: "dog",
            badge: { state: "overdue", days: -3, kind: "internal", others: 1 },
          }),
          animal({
            name: "Mel",
            id: "m1",
            badge: { state: "due_soon", days: 6, kind: "external", others: 0 },
          }),
          animal(),
        ],
      },
    });
    await renderApp("/");
    expect(await screen.findByText("Vermífugo atrasado · +1")).toBeTruthy();
    expect(screen.getByText("Antipulgas vence em 6 dias")).toBeTruthy();
    expect(screen.queryByText("Em dia")).toBeNull();
    expect(screen.getAllByText("Gato · cerca de 5 anos").length).toBe(2);
    // Nothing else on the home: no "next up", no notification card, no footer.
    expect(screen.queryByTestId("push-banner")).toBeNull();
    expect(screen.queryByTestId("sign-out")).toBeNull();
  });

  it("has Meus pets and Adicionar in the header", async () => {
    fakeApi({ ...unread(false), "GET /animals": { body: [animal()] } });
    const app = await renderApp("/");
    expect(await screen.findByText(strings.home.addShort)).toBeTruthy();
    expect(headerTitles()).toContain(strings.home.title);
    await fireEvent.press(screen.getByTestId("add-animal"));
    expect(app.pathname()).toBe("/animais/novo");
  });

  it("says so when there is no animal yet", async () => {
    fakeApi({ ...unread(false), "GET /animals": { body: [] } });
    await renderApp("/");
    expect(await screen.findByText(strings.home.empty)).toBeTruthy();
    expect(screen.getByText(strings.home.emptyHint)).toBeTruthy();
  });
});
