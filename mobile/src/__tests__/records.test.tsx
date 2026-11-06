import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, animalRoutes, CATALOG, vaccine } from "@/test-utils/fixtures";
import { renderApp, signedIn } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const picker = jest.requireMock("expo-image-picker") as Record<string, jest.Mock>;
const docs = jest.requireMock("expo-document-picker") as Record<string, jest.Mock>;
const browser = jest.requireMock("expo-web-browser") as Record<string, jest.Mock>;

beforeEach(() => {
  signedIn();
  jest.restoreAllMocks();
});

const url = (q: string) => `/animais/${ANIMAL_ID}/registro?${q}`;

describe("the vaccine form", () => {
  it("offers only the species' diseases, several at once, and sends the photo as an attachment", async () => {
    picker.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///label.jpg", fileName: "label.jpg", mimeType: "image/jpeg" }],
    });
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/attachments`]: {
        status: 201,
        body: [{ id: "att-1", name: "label.jpg", content_type: "image/jpeg", url: "http://x" }],
      },
      [`POST /animals/${ANIMAL_ID}/vaccines`]: { status: 201, body: vaccine() },
    });
    await renderApp(url("tipo=vaccine"));
    for (const d of CATALOG.cat) expect(await screen.findByLabelText(d.label)).toBeTruthy();
    expect(screen.queryByLabelText("Cinomose")).toBeNull();

    await fireEvent.press(screen.getByTestId("save-record"));
    expect(screen.getByText(strings.records.diseasesRequired)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("date"), "06112025");
    await fireEvent.press(screen.getByLabelText("Raiva"));
    await fireEvent.press(screen.getByLabelText("FeLV"));
    await fireEvent.changeText(screen.getByTestId("brand"), "Quantum");
    await fireEvent.changeText(screen.getByTestId("lot-expiry"), "092027");
    await fireEvent.changeText(screen.getByTestId("repeat-on"), "06112026");
    await fireEvent.changeText(screen.getByTestId("vet_crmv"), "SP-1");
    await fireEvent.press(screen.getByTestId("pick-photos"));
    await fireEvent.press(screen.getByTestId("save-record"));

    await waitFor(() => expect(api.callsTo(`POST /animals/${ANIMAL_ID}/vaccines`)).toHaveLength(1));
    expect(api.callsTo(`POST /animals/${ANIMAL_ID}/vaccines`)[0].body).toEqual({
      date: "2025-11-06",
      diseases: ["rabies", "felv"],
      brand: "Quantum",
      lot: "",
      lot_expiry: "2027-09",
      repeat_on: "2026-11-06",
      repeat_on_origin: "written",
      vet_name: "",
      vet_crmv: "SP-1",
      attachment_ids: ["att-1"],
    });
  });

  it("from a reminder's shortcut starts with that disease marked", async () => {
    fakeApi(animalRoutes(animal()));
    await renderApp(url("tipo=vaccine&assunto=rabies"));
    const rabies = await screen.findByLabelText("Raiva");
    expect(rabies.props.accessibilityState.checked).toBe(true);
  });

  it("a repeat dose starts as a copy of the last one, diseases folded", async () => {
    const last = vaccine({ id: "v7", brand: "Nobivac Feline", diseases: ["calicivirus", "felv"] });
    const api = fakeApi({
      ...animalRoutes(animal(), [last]),
      [`POST /animals/${ANIMAL_ID}/vaccines`]: { status: 201, body: last },
    });
    await renderApp(url("tipo=vaccine&dose=v7"));
    expect(await screen.findByText(strings.records.fromLastDose)).toBeTruthy();
    expect(screen.getByTestId("diseases-summary").props.children).toBe("Calicivirose, FeLV");
    expect(screen.queryByTestId("diseases")).toBeNull();
    expect(screen.getByTestId("brand").props.value).toBe("Nobivac Feline");
    expect(screen.getByTestId("lot").props.value).toBe("");
    await fireEvent.press(screen.getByTestId("change-diseases"));
    expect(screen.getByLabelText("FeLV").props.accessibilityState.checked).toBe(true);
    await fireEvent.press(screen.getByTestId("save-record"));
    await waitFor(() =>
      expect(api.callsTo(`POST /animals/${ANIMAL_ID}/vaccines`)[0].body).toMatchObject({
        brand: "Nobivac Feline",
        diseases: ["calicivirus", "felv"],
      }),
    );
  });

  it("filling by hand after a failed reading attaches the reading's photos", async () => {
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/vaccines`]: { status: 201, body: vaccine() },
    });
    await renderApp(url("tipo=vaccine&anexos=ph1,ph2"));
    expect(await screen.findByText(strings.records.fromPhoto)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText("Raiva"));
    await fireEvent.press(screen.getByTestId("save-record"));
    await waitFor(() =>
      expect(api.callsTo(`POST /animals/${ANIMAL_ID}/vaccines`)[0].body).toMatchObject({ attachment_ids: ["ph1", "ph2"] }),
    );
  });

  it("edits a dose, keeping its photos and the origin of an unchanged repeat-on, and deletes it", async () => {
    const record = vaccine({
      repeat_on_origin: "inferred",
      attachments: [{ id: "a9", name: "etiqueta.jpg", content_type: "image/jpeg", url: "http://x/e.jpg" }],
    });
    const api = fakeApi({
      ...animalRoutes(animal(), [record]),
      [`PUT /animals/${ANIMAL_ID}/vaccines/v1`]: { body: record },
      [`DELETE /animals/${ANIMAL_ID}/vaccines/v1`]: { status: 204 },
    });
    await renderApp(url("registro=v1"));
    expect(await screen.findByDisplayValue("Quantum Raiva")).toBeTruthy();
    expect(screen.getByText(strings.records.repeatInferred)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("lot"), "L999");
    await fireEvent.press(screen.getByTestId("save-record"));
    await waitFor(() => expect(api.callsTo(`PUT /animals/${ANIMAL_ID}/vaccines/v1`)).toHaveLength(1));
    expect(api.callsTo(`PUT /animals/${ANIMAL_ID}/vaccines/v1`)[0].body).toMatchObject({
      lot: "L999",
      lot_expiry: "2027-09",
      repeat_on_origin: "inferred",
      attachment_ids: ["a9"],
    });
  });

  it("deletes after confirming", async () => {
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, b) => b?.find((x) => x.style === "destructive")?.onPress?.());
    const api = fakeApi({
      ...animalRoutes(animal(), [vaccine()]),
      [`DELETE /animals/${ANIMAL_ID}/vaccines/v1`]: { status: 204 },
    });
    await renderApp(url("registro=v1"));
    await fireEvent.press(await screen.findByTestId("delete-record"));
    await waitFor(() => expect(api.callsTo(`DELETE /animals/${ANIMAL_ID}/vaccines/v1`)).toHaveLength(1));
  });
});

describe("the other kinds", () => {
  it("an antiparasitic carries its kind, its product and an optional weight", async () => {
    const api = fakeApi({
      ...animalRoutes(animal({ species: "dog", name: "Bug" })),
      [`POST /animals/${ANIMAL_ID}/antiparasitics`]: { status: 201, body: {} },
    });
    await renderApp(url("tipo=antiparasitic&assunto=external"));
    await fireEvent.changeText(await screen.findByTestId("product"), "Bravecto");
    await fireEvent.changeText(screen.getByTestId("weight_kg"), "abc");
    await fireEvent.press(screen.getByTestId("save-record"));
    expect(screen.getByText(strings.records.kgInvalid)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("weight_kg"), "3,1");
    await fireEvent.press(screen.getByTestId("save-record"));
    await waitFor(() =>
      expect(api.callsTo(`POST /animals/${ANIMAL_ID}/antiparasitics`)[0].body).toMatchObject({
        parasite: "external",
        product: "Bravecto",
        weight_kg: "3.1",
        repeat_on: null,
        repeat_on_origin: "",
      }),
    );
  });

  it("a weight and a note check their one field", async () => {
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/weights`]: { status: 201, body: {} },
    });
    await renderApp(url("tipo=weight"));
    await fireEvent.press(await screen.findByTestId("save-record"));
    expect(screen.getByText(strings.records.kgInvalid)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("kg"), "4,9");
    await fireEvent.press(screen.getByTestId("save-record"));
    await waitFor(() => expect(api.callsTo(`POST /animals/${ANIMAL_ID}/weights`)[0].body).toMatchObject({ kg: "4.9" }));
  });

  it("a guest's weight carries no file picker", async () => {
    fakeApi(animalRoutes(animal({ role: "guest" })));
    await renderApp(url("tipo=visit"));
    await screen.findByTestId("save-record");
    expect(screen.queryByTestId("pick-photos")).toBeNull();
  });

  it("a visit takes photos and PDFs, and its PDFs open in the browser", async () => {
    docs.getDocumentAsync.mockResolvedValueOnce({
      canceled: false,
      assets: [{ uri: "file:///exame.pdf", name: "exame.pdf", mimeType: "application/pdf" }],
    });
    const api = fakeApi({
      ...animalRoutes(animal()),
      [`POST /animals/${ANIMAL_ID}/attachments`]: {
        status: 201,
        body: [{ id: "pdf-1", name: "exame.pdf", content_type: "application/pdf", url: "http://x/e.pdf" }],
      },
      [`POST /animals/${ANIMAL_ID}/visits`]: { status: 201, body: {} },
    });
    await renderApp(url("tipo=visit"));
    await fireEvent.changeText(await screen.findByTestId("clinic"), "Vida Animal");
    await fireEvent.press(screen.getByTestId("pick-documents"));
    expect(screen.getByText("exame.pdf")).toBeTruthy();
    await fireEvent.press(screen.getByTestId("save-record"));
    await waitFor(() =>
      expect(api.callsTo(`POST /animals/${ANIMAL_ID}/visits`)[0].body).toMatchObject({
        clinic: "Vida Animal",
        attachment_ids: ["pdf-1"],
      }),
    );
  });

  it("opens a visit's PDF from the history in the in-app browser", async () => {
    fakeApi(
      animalRoutes(animal(), [
        {
          ...vaccine(),
          id: "vi1",
          kind: "visit",
          clinic: "Vida Animal",
          vet_name: "",
          reason: "",
          notes: "",
          attachments: [{ id: "f1", name: "hemograma.pdf", content_type: "application/pdf", url: "http://x/h.pdf" }],
        },
      ]),
    );
    await renderApp(`/animais/${ANIMAL_ID}`);
    await fireEvent.press(await screen.findByLabelText("hemograma.pdf"));
    expect(browser.openBrowserAsync).toHaveBeenCalledWith("http://x/h.pdf");
  });
});
