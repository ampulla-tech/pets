import { fireEvent, screen } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { animal, ANIMAL_ID, animalRoutes } from "@/test-utils/fixtures";
import { renderApp, signedIn, signedOut } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

/** The labels followed by a `*`, in screen order; the mark is hidden from screen readers. */
function requiredLabels() {
  return screen
    .queryAllByTestId(/^required-/, { includeHiddenElements: true })
    .map((mark) => String(mark.props.testID).slice("required-".length));
}

const S = strings.animal;
const R = strings.records;

describe("required fields", () => {
  beforeEach(() => signedIn());

  it("mark the vaccine's required fields with a * and announce the control as required", async () => {
    fakeApi(animalRoutes(animal()));
    await renderApp(`/animais/${ANIMAL_ID}/registro?tipo=vaccine`);
    await screen.findByTestId("date");
    expect(requiredLabels()).toEqual([R.date, R.diseases]);
    expect(screen.getByTestId("date").props.accessibilityHint).toBe(strings.app.required);
    expect(screen.getByTestId("repeat-on").props.accessibilityHint).toBeUndefined();
    expect(screen.queryByText(/opcional/)).toBeNull();
    // Hidden from screen readers: the default queries do not see it.
    expect(screen.queryByTestId(`required-${R.date}`)).toBeNull();
  });

  it("mark the animal's species, name and birth only", async () => {
    fakeApi({});
    await renderApp("/animais/novo");
    await screen.findByTestId("animal-name");
    expect(requiredLabels()).toEqual([S.species, S.name, S.birth]);
    await fireEvent.press(screen.getByText(S.birthYear));
    expect(screen.getByTestId("birth").props.accessibilityHint).toBe(strings.app.required);
    expect(screen.getByTestId("breed").props.accessibilityHint).toBeUndefined();
    expect(screen.queryByText(/opcional/)).toBeNull();
  });

  it("mark the note's date and text", async () => {
    fakeApi(animalRoutes(animal()));
    await renderApp(`/animais/${ANIMAL_ID}/registro?tipo=note`);
    await screen.findByTestId("text");
    expect(requiredLabels()).toEqual([R.date, R.text]);
  });
});

describe("the sign-in screen", () => {
  beforeEach(() => signedOut());

  it("marks nothing", async () => {
    fakeApi({});
    await renderApp("/entrar");
    await screen.findByTestId("email");
    expect(requiredLabels()).toEqual([]);
  });
});
