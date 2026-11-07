import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, animalRoutes, vaccine } from "@/test-utils/fixtures";
import { renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const fs = jest.requireMock("expo-file-system") as { File: { downloadFileAsync: jest.Mock } };
const sharing = jest.requireMock("expo-sharing") as Record<string, jest.Mock>;

beforeEach(() => signedIn());

function item(over: Record<string, unknown> = {}) {
  return {
    record_id: "v1",
    date: "2025-11-06",
    title: "Vanguard Plus",
    detail: "",
    current: false,
    repeat_on: null,
    state: null,
    due_in_days: null,
    can_edit: true,
    ...over,
  };
}

const PACOCA = animal({ name: "Paçoca", species: "dog", breed: "", sex: "male" });
const CARD = {
  animal: PACOCA,
  sections: [
    {
      kind: "vaccine",
      items: [
        item({ current: true, repeat_on: "2026-11-06", state: "due_soon", due_in_days: 0, detail: "Partida 123A · Dra. Lima" }),
        item({ record_id: "v0", date: "2024-11-06" }),
      ],
    },
    {
      kind: "antiparasitic",
      items: [item({ record_id: "p1", title: "Drontal Plus", date: "2026-08-01", current: true, repeat_on: "2026-11-01", state: "overdue", due_in_days: -5 })],
    },
    { kind: "note", items: [item({ record_id: "n1", title: "Coçando.", detail: "bruno@example.com", can_edit: false })] },
  ],
};

describe("the card", () => {
  it("lists every dose by section, and only the current one says when to repeat", async () => {
    fakeApi({ ...animalRoutes(PACOCA), [`GET /animals/${ANIMAL_ID}/card`]: { body: CARD } });
    await renderApp(`/animais/${ANIMAL_ID}/carteirinha`);
    expect(await screen.findByText(/^Canino · SRD · Macho/)).toBeTruthy();
    expect(screen.getByText("Vacinas")).toBeTruthy();
    expect(screen.getByText("Repetir em 06/11/2026")).toBeTruthy();
    expect(screen.getByText("Vence hoje")).toBeTruthy();
    expect(screen.getByText("Atrasado")).toBeTruthy();
    expect(screen.getAllByText(/Repetir em/)).toHaveLength(2);
    expect(screen.queryByText("Peso")).toBeNull();
  });

  it("opens a record from its line, above the card", async () => {
    fakeApi({ ...animalRoutes(PACOCA, [vaccine()]), [`GET /animals/${ANIMAL_ID}/card`]: { body: CARD } });
    const app = await renderApp(`/animais/${ANIMAL_ID}/carteirinha`);
    // A line the viewer cannot edit is only read.
    expect((await screen.findByTestId("card-item-n1")).props.accessibilityState?.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId("card-item-v1"));
    expect(app.pathname()).toBe(`/animais/${ANIMAL_ID}/registro`);
    expect(app.params()).toMatchObject({ tipo: "vaccine", registro: "v1" });
  });

  it("empty, offers Registrar and no PDF", async () => {
    fakeApi({
      ...animalRoutes(PACOCA),
      [`GET /animals/${ANIMAL_ID}/card`]: { body: { animal: { ...PACOCA, sex: "female", name: "Nina" }, sections: [] } },
    });
    await renderApp(`/animais/${ANIMAL_ID}/carteirinha`);
    expect(await screen.findByText(strings.card.empty)).toBeTruthy();
    expect(screen.queryByTestId("share-pdf")).toBeNull();
    await fireEvent.press(screen.getByTestId("card-register"));
    expect(screen.getByTestId("register-photos")).toBeTruthy();
  });

  it("downloads the PDF with the session into the cache and opens the share sheet on it", async () => {
    fakeApi({
      ...animalRoutes(animal({ name: "GATA" })),
      [`GET /animals/${ANIMAL_ID}/card`]: { body: { ...CARD, animal: animal({ name: "GATA" }) } },
    });
    await renderApp(`/animais/${ANIMAL_ID}/carteirinha`);
    await fireEvent.press(await screen.findByTestId("share-pdf"));
    await waitFor(() => expect(sharing.shareAsync).toHaveBeenCalled());
    const [url, destination, options] = fs.File.downloadFileAsync.mock.calls[0];
    expect(url).toBe(`http://localhost:8300/animals/${ANIMAL_ID}/card.pdf`);
    expect(destination.uri).toContain("carteirinha-gata.pdf");
    expect(options.headers).toEqual({ "X-Session-Token": "token-1" });
    expect(sharing.shareAsync.mock.calls[0][1]).toMatchObject({ mimeType: "application/pdf" });
  });
});

describe("archiving", () => {
  it("archives with a reason and a day, and the archived list shows it", async () => {
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/archive`]: { body: animal({ status: "archived" }) },
      "GET /animals?status=archived": {
        body: [animal({ status: "archived", archived_reason: "rehomed", archived_on: "2026-10-31" })],
      },
    });
    await renderApp(`/animais/${ANIMAL_ID}/arquivar`);
    await fireEvent.press(await screen.findByText("Faleceu"));
    await fireEvent.changeText(screen.getByTestId("archived-on"), "");
    await fireEvent.press(screen.getByTestId("confirm-archive"));
    expect(screen.getByText(strings.archive.dateRequired)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("archived-on"), "30102026");
    await fireEvent.press(screen.getByTestId("confirm-archive"));
    await waitFor(() =>
      expect(api.callsTo(`POST /animals/${ANIMAL_ID}/archive`)[0]?.body).toEqual({ reason: "died", on: "2026-10-30" }),
    );
  });

  it("lists the archived animals with their reason and day", async () => {
    fakeApi({
      "GET /animals?status=archived": {
        body: [animal({ status: "archived", archived_reason: "rehomed", archived_on: "2026-10-31" })],
      },
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
    });
    await renderApp("/arquivados");
    expect(await screen.findByText("Doado em 31/10/2026")).toBeTruthy();
  });
});
