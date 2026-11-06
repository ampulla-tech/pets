import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, animalRoutes, notice } from "@/test-utils/fixtures";
import { renderApp, signedIn, signedOut } from "@/test-utils/render";
import type { NoticeOut } from "@pets/core/api/generated";
import { strings } from "@pets/core/strings";

const notifications = jest.requireMock("expo-notifications") as Record<string, jest.Mock>;

beforeEach(() => {
  signedOut();
  signedIn();
  jest.clearAllMocks();
  // No EAS project id: push is unsupported here, so only the notices matter.
  delete process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  notifications.getPermissionsAsync.mockResolvedValue({
    status: "undetermined",
    canAskAgain: true,
  });
});

const yesterday = () => new Date(Date.now() - 86_400_000).toISOString();

function routes(notices: NoticeOut[]) {
  return {
    "GET /notices": { body: notices },
    "GET /notices/unread": { body: { unread: notices.some((n) => !n.read) } },
  };
}

describe("the Avisos tab", () => {
  it("lists the notices by day, the unread ones marked, and opening it reads nothing", async () => {
    const api = fakeApi(
      routes([
        notice(),
        notice({
          id: "n2",
          animal_name: "Mel",
          sent_at: yesterday(),
          title: "O antipulgas da Mel vence em 7 dias.",
          body: "NexGard",
          read: true,
        }),
      ]),
    );
    await renderApp("/avisos");
    const today = await screen.findByTestId(`day-${strings.notices.today}`);
    expect(within(today).getByText(strings.notices.today)).toBeTruthy();
    expect(within(today).getByText("Hoje é dia de vacinar o Lacan.")).toBeTruthy();
    expect(within(today).getByText("Quantum Raiva")).toBeTruthy();
    expect(within(today).getByText("L")).toBeTruthy();
    expect(within(today).getByLabelText(strings.notices.unread)).toBeTruthy();
    expect(screen.getByTestId("notice-title-n1").props.className).toContain(
      "font-semibold",
    );

    const older = screen.getByTestId(`day-${strings.notices.yesterday}`);
    expect(within(older).getByText("O antipulgas da Mel vence em 7 dias.")).toBeTruthy();
    expect(within(older).queryByLabelText(strings.notices.unread)).toBeNull();
    expect(screen.getByTestId("notice-n2").props.className).toContain("bg-muted");
    expect(screen.getByTestId("notice-title-n2").props.className).toContain(
      "text-muted-foreground",
    );

    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(0);
    expect(screen.queryByText(strings.notices.latest(50))).toBeNull();
  });

  it("opens the animal from a notice and marks that one read", async () => {
    const api = fakeApi({
      ...animalRoutes(animal()),
      ...routes([notice()]),
      "POST /notices/n1/read": { status: 204 },
    });
    const app = await renderApp("/avisos");
    await fireEvent.press(await screen.findByTestId("notice-n1"));
    await waitFor(() => expect(app.pathname()).toBe(`/animais/${ANIMAL_ID}`));
    expect(app.params()).toMatchObject({ assunto: "rabies" });
    await waitFor(() => expect(api.callsTo("POST /notices/n1/read")).toHaveLength(1));
  });

  it("does not mark again a notice already read", async () => {
    const api = fakeApi({
      ...animalRoutes(animal()),
      ...routes([notice({ read: true })]),
    });
    const app = await renderApp("/avisos");
    await fireEvent.press(await screen.findByTestId("notice-n1"));
    await waitFor(() => expect(app.pathname()).toBe(`/animais/${ANIMAL_ID}`));
    expect(api.calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("marks every notice read from the ⋯ menu, only offered while one is unread", async () => {
    let read = false;
    const api = fakeApi({
      "GET /notices": () => ({ body: [notice({ read })] }),
      "GET /notices/unread": () => ({ body: { unread: !read } }),
      "POST /notices/read": () => {
        read = true;
        return { status: 204 };
      },
    });
    await renderApp("/avisos");
    await fireEvent.press(await screen.findByLabelText(strings.notices.more));
    // Push is unsupported here: the menu has only the one item.
    expect(screen.queryByText(strings.push.enable)).toBeNull();
    await fireEvent.press(screen.getByText(strings.notices.markAllRead));
    await waitFor(() => expect(api.callsTo("POST /notices/read")).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByLabelText(strings.notices.unread)).toBeNull(),
    );
    expect(screen.queryByLabelText(strings.notices.more)).toBeNull();
  });

  it("says so when there is no notice yet, with no ⋯", async () => {
    fakeApi(routes([]));
    await renderApp("/avisos");
    expect(await screen.findByText(strings.notices.empty)).toBeTruthy();
    expect(screen.getByText(strings.notices.emptyHint)).toBeTruthy();
    expect(screen.queryByLabelText(strings.notices.more)).toBeNull();
  });

  it("says only the latest 50 are listed when the list is full", async () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      notice({ id: `n${i}`, read: true }),
    );
    fakeApi(routes(many));
    await renderApp("/avisos");
    expect(await screen.findByText(strings.notices.latest(50))).toBeTruthy();
  });
});
