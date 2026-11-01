import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, animalRoutes } from "@/test-utils/fixtures";
import { renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const picker = jest.requireMock("expo-image-picker") as Record<string, jest.Mock>;

const empty = { value: null, read: false };
const PHOTO = { id: "ph1", name: "p1.jpg", content_type: "image/jpeg", url: "http://x/p1.jpg" };

function proposal(over: Record<string, unknown> = {}) {
  return {
    index: 0,
    kind: "vaccine",
    date: { value: "2025-11-06", read: true },
    brand: { value: "Quantum", read: true },
    lot: empty,
    lot_expiry: empty,
    diseases: { value: ["rabies"], read: true },
    repeat_on: { value: "2026-11-06", read: true, origin: "inferred" },
    vet_name: empty,
    vet_crmv: empty,
    dose: empty,
    weight_kg: { value: null, read: false },
    review: "pending",
    record_id: null,
    ...over,
  };
}

function extraction(over: Record<string, unknown> = {}) {
  return { id: "ex1", animal_id: ANIMAL_ID, status: "processing", error: "", photos: [PHOTO], proposals: [], ...over };
}

beforeEach(() => {
  signedIn();
  picker.launchImageLibraryAsync.mockResolvedValue({
    canceled: false,
    assets: [
      { uri: "file:///p1.jpg", fileName: "p1.jpg", mimeType: "image/jpeg" },
      { uri: "file:///p2.jpg", fileName: "p2.jpg", mimeType: "image/jpeg" },
    ],
  });
});

async function sendTwoPhotos() {
  await fireEvent.press(await screen.findByTestId("intake-gallery"));
  expect(screen.getByText(strings.intake.photosPicked(2))).toBeTruthy();
  await fireEvent.press(screen.getByTestId("intake-send"));
}

describe("photo intake", () => {
  it("sends the photos as files, follows the reading and, failed as unconfigured, offers retry or by hand", async () => {
    let reads = 0;
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/extractions`]: { status: 202, body: extraction() },
      "GET /extractions/ex1": () => {
        reads += 1;
        return { body: reads < 2 ? extraction() : extraction({ status: "failed", error: "unconfigured" }) };
      },
      "POST /extractions/ex1/retry": { status: 202, body: extraction() },
    });
    const app = await renderApp(`/animais/${ANIMAL_ID}/foto`);
    await sendTwoPhotos();
    expect(await screen.findByTestId("intake-processing")).toBeTruthy();
    const sent = api.callsTo(`POST /animals/${ANIMAL_ID}/extractions`)[0];
    expect(sent.body).toBeInstanceOf(FormData);
    expect((sent.body as FormData).getAll("files")).toHaveLength(2);

    await act(async () => jest.advanceTimersByTime(2100));
    await act(async () => jest.advanceTimersByTime(2100));
    expect(await screen.findByText(strings.intake.failedUnconfigured)).toBeTruthy();

    await fireEvent.press(screen.getByTestId("intake-retry"));
    await waitFor(() => expect(api.callsTo("POST /extractions/ex1/retry")).toHaveLength(1));
    expect(await screen.findByTestId("intake-processing")).toBeTruthy();
    await act(async () => jest.advanceTimersByTime(2500));
    await fireEvent.press(await screen.findByTestId("intake-by-hand"));
    expect(app.pathname()).toBe(`/animais/${ANIMAL_ID}/registro`);
    expect(app.params()).toMatchObject({ tipo: "vaccine", anexos: "ph1" });
  });

  it("an upload that fails says so and can be tried again", async () => {
    fakeApi({ ...animalRoutes(animal()), [`POST /animals/${ANIMAL_ID}/extractions`]: { status: 500, body: {} } });
    await renderApp(`/animais/${ANIMAL_ID}/foto`);
    await sendTwoPhotos();
    expect(await screen.findByText(strings.intake.uploadFailed)).toBeTruthy();
  });

  it("reviews each line: unread fields empty and marked, an inferred repeat-on said; confirm and discard", async () => {
    const lines = [
      proposal(),
      proposal({ index: 1, kind: "weight", weight_kg: { value: 4.9, read: true }, diseases: { value: [], read: true } }),
    ];
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/extractions`]: { status: 202, body: extraction({ status: "ready", proposals: lines }) },
      "GET /extractions/ex1": { body: extraction({ status: "ready", proposals: lines }) },
      "POST /extractions/ex1/proposals/0/confirm": { status: 201, body: {} },
      "POST /extractions/ex1/proposals/1/discard": {
        body: extraction({ status: "ready", proposals: [lines[0], { ...lines[1], review: "discarded" }] }),
      },
    });
    await renderApp(`/animais/${ANIMAL_ID}/foto`);
    await sendTwoPhotos();
    expect(await screen.findByText(strings.intake.reviewTitle)).toBeTruthy();
    expect(screen.getByTestId("lot-1").props.value).toBe("");
    expect(screen.getAllByText(strings.intake.unread).length).toBeGreaterThan(0);
    expect(screen.getByText(strings.records.repeatInferred)).toBeTruthy();
    expect(api.callsTo("POST /extractions/ex1/proposals/0/confirm")).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId("lot-1"), "L77");
    await fireEvent.press(screen.getByTestId("confirm-1"));
    await waitFor(() => expect(api.callsTo("POST /extractions/ex1/proposals/0/confirm")).toHaveLength(1));
    expect(api.callsTo("POST /extractions/ex1/proposals/0/confirm")[0].body).toEqual({
      record: {
        kind: "vaccine",
        date: "2025-11-06",
        diseases: ["rabies"],
        brand: "Quantum",
        lot: "L77",
        lot_expiry: "",
        repeat_on: "2026-11-06",
        repeat_on_origin: "inferred",
        vet_name: "",
        vet_crmv: "",
      },
    });

    await fireEvent.press(screen.getByTestId("discard-2"));
    expect(await screen.findByText(strings.intake.discarded)).toBeTruthy();
  });
});
