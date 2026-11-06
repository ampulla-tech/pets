import { fireEvent, screen, waitFor } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, animalRoutes } from "@/test-utils/fixtures";
import { renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const fs = jest.requireMock("expo-file-system") as { File: { downloadFileAsync: jest.Mock } };
const sharing = jest.requireMock("expo-sharing") as Record<string, jest.Mock>;

beforeEach(() => signedIn());

const ROW = {
  subject: "rabies",
  label: "Raiva",
  last_date: "2025-11-06",
  last_product: "Quantum",
  last_vet: "Dra. Paula",
  next_on: "2026-11-06",
  state: "scheduled",
  record_kind: "vaccine",
  record_id: "v1",
  photos: [{ id: "f1", name: "etiqueta.jpg", content_type: "image/jpeg", url: "http://x/e.jpg" }],
};

describe("the card", () => {
  it("shows one row per subject with the last dose and the next, the label photo a tap away", async () => {
    fakeApi({
      ...animalRoutes(animal({ name: "GATA" })),
      [`GET /animals/${ANIMAL_ID}/card`]: {
        body: { animal: animal({ name: "GATA" }), rows: [ROW, { ...ROW, subject: "felv", label: "FeLV", next_on: null, state: "no_date", photos: [] }] },
      },
    });
    await renderApp(`/animais/${ANIMAL_ID}/carteirinha`);
    expect(await screen.findByText("Raiva")).toBeTruthy();
    expect(screen.getAllByText("Última dose: 06/11/2025 · Quantum")).toHaveLength(2);
    expect(screen.getByText("Próxima: sem data")).toBeTruthy();
    expect(screen.queryByTestId("label-photo-felv")).toBeNull();
    await fireEvent.press(screen.getByTestId("label-photo-rabies"));
    expect(screen.getByTestId("photo-viewer")).toBeTruthy();
  });

  it("downloads the PDF with the session into the cache and opens the share sheet on it", async () => {
    fakeApi({
      ...animalRoutes(animal({ name: "GATA" })),
      [`GET /animals/${ANIMAL_ID}/card`]: { body: { animal: animal({ name: "GATA" }), rows: [] } },
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
