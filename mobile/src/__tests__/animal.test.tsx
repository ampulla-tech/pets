import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, animalRoutes, antiparasitic, reminder, vaccine, weight } from "@/test-utils/fixtures";
import { renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const picker = jest.requireMock("expo-image-picker") as Record<string, jest.Mock>;

/** Answer an Alert by pressing its destructive button. */
function confirmAlerts() {
  return jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });
}

beforeEach(() => {
  signedIn();
  jest.restoreAllMocks();
});

describe("the animal's profile", () => {
  it("shows the last weight with its day and the weight chart", async () => {
    fakeApi(
      animalRoutes(animal(), [weight("w2", "2026-10-12", "4.900"), weight("w1", "2026-06-01", "4.500")]),
    );
    await renderApp(`/animais/${ANIMAL_ID}`);
    expect(await screen.findByText("4,9 kg em 12/10/2026")).toBeTruthy();
    expect(screen.getByTestId("weight-chart").props.accessibilityLabel).toContain("01/06/2026: 4,5 kg");
  });

  it("opened at a subject, offers to register a new dose of it", async () => {
    fakeApi(animalRoutes(animal(), [vaccine()], [reminder()]));
    const app = await renderApp(`/animais/${ANIMAL_ID}?assunto=rabies`);
    expect(await screen.findByTestId("focus")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("register-dose"));
    expect(app.pathname()).toBe(`/animais/${ANIMAL_ID}/registro`);
    expect(app.params()).toMatchObject({ tipo: "vaccine", assunto: "rabies" });
  });

  it("asks for the date of a dose with none, opening that record at its repeat-on", async () => {
    fakeApi(animalRoutes(animal(), [vaccine({ repeat_on: null })], [reminder({ state: "no_date", due_on: null, days: null })]));
    const app = await renderApp(`/animais/${ANIMAL_ID}`);
    expect(await screen.findByText("Sem data: informe quando repetir")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("set-date-rabies"));
    expect(app.params()).toMatchObject({ registro: "v1", campo: "repeat_on" });
  });

  it("filters the history by kind", async () => {
    fakeApi(animalRoutes(animal(), [antiparasitic(), vaccine()]));
    await renderApp(`/animais/${ANIMAL_ID}`);
    expect(await screen.findByText("Verme interno · Drontal")).toBeTruthy();
    expect(screen.getByText("Vacina · Quantum Raiva")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("filter-antiparasitic"));
    expect(screen.queryByText("Vacina · Quantum Raiva")).toBeNull();
    expect(screen.getByText("Verme interno · Drontal")).toBeTruthy();
  });

  it("hides from a guest everything but weight and note", async () => {
    fakeApi(animalRoutes(animal({ role: "guest" }), [vaccine({ can_edit: false })]));
    await renderApp(`/animais/${ANIMAL_ID}`);
    expect(await screen.findByText(strings.animal.guestNotice)).toBeTruthy();
    expect(screen.getByTestId("add-weight")).toBeTruthy();
    expect(screen.getByTestId("add-note")).toBeTruthy();
    for (const id of ["add-vaccine", "add-antiparasitic", "add-visit", "add-by-photo", "edit-animal", "archive-animal", "delete-animal", "edit-v1"]) {
      expect(screen.queryByTestId(id)).toBeNull();
    }
  });

  it("an archived animal is read-only, and a tutor can still delete it for good", async () => {
    const api = fakeApi({
      ...animalRoutes(animal({ status: "archived", archived_reason: "died", archived_on: "2026-10-30" }), [vaccine()]),
      [`DELETE /animals/${ANIMAL_ID}`]: { status: 204 },
      "GET /animals": { body: [] },
      "GET /reminders/upcoming": { body: [] },
    });
    const alert = confirmAlerts();
    const app = await renderApp(`/animais/${ANIMAL_ID}`);
    expect(await screen.findByText(strings.archive.readOnly)).toBeTruthy();
    expect(screen.queryByTestId("add-vaccine")).toBeNull();
    expect(screen.queryByTestId("edit-v1")).toBeNull();
    await fireEvent.press(screen.getByTestId("delete-animal"));
    expect(alert.mock.calls[0][1]).toBe(strings.animal.deleteConfirm("Lacan"));
    await waitFor(() => expect(api.callsTo(`DELETE /animals/${ANIMAL_ID}`)).toHaveLength(1));
    await waitFor(() => expect(app.pathname()).toBe("/"));
  });
});

describe("registering an animal", () => {
  it("creates it, then sends the photo picked from the gallery", async () => {
    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///bug.jpg", fileName: "bug.jpg", mimeType: "image/jpeg" }],
    });
    const api = fakeApi({
      "POST /animals": { status: 201, body: animal({ id: "new", name: "Bug", species: "dog" }) },
      "POST /animals/new/photo": { body: animal({ id: "new", name: "Bug", species: "dog", photo_url: "http://x/p.jpg" }) },
      ...animalRoutes(animal({ id: "new", name: "Bug", species: "dog" })),
    });
    const app = await renderApp("/animais/novo");
    await fireEvent.press(await screen.findByTestId("save-animal"));
    expect(screen.getByText(strings.animal.nameRequired)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("animal-name"), "Bug");
    await fireEvent.press(screen.getByTestId("pick-photos"));
    await fireEvent.press(screen.getByText(strings.animal.birthMonth));
    await fireEvent.changeText(screen.getByTestId("birth"), "092026");
    await fireEvent.press(screen.getByText(strings.animal.no));
    await fireEvent.press(screen.getByTestId("save-animal"));

    await waitFor(() => expect(app.pathname()).toBe("/animais/new"));
    expect(api.callsTo("POST /animals")[0].body).toMatchObject({
      species: "dog",
      name: "Bug",
      neutered: false,
      birth: { precision: "month", value: "2026-09" },
      adopted_on: null,
    });
    const photo = api.callsTo("POST /animals/new/photo")[0];
    expect(photo.headers["x-session-token"]).toBe("token-1");
    expect(photo.body).toBeInstanceOf(FormData);
  });

  it("checks a birth year has four digits", async () => {
    fakeApi({});
    await renderApp("/animais/novo");
    await fireEvent.changeText(await screen.findByTestId("animal-name"), "Bug");
    await fireEvent.press(screen.getByText(strings.animal.birthYear));
    await fireEvent.changeText(screen.getByTestId("birth"), "21");
    await fireEvent.press(screen.getByTestId("save-animal"));
    expect(screen.getByText(strings.animal.birthYearInvalid)).toBeTruthy();
  });
});
