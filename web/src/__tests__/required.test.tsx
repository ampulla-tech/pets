import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { mockApi } from "./api";
import { renderApp } from "./render";
import { animal, animalRoutes } from "./fixtures";

const cat = animal();

/** The `*` beside a control's label, hidden from screen readers, if any. */
function markOf(control: HTMLElement) {
  const label = document.querySelector(`label[for="${control.id}"]`);
  return label?.parentElement?.querySelector('[aria-hidden="true"]') ?? null;
}

function expectRequired(control: HTMLElement) {
  expect(control.getAttribute("aria-required")).toBe("true");
  expect(markOf(control)?.textContent).toBe("*");
}

function expectOptional(control: HTMLElement) {
  expect(control.getAttribute("aria-required")).toBeNull();
  expect(markOf(control)).toBeNull();
}

/** A fieldset's legend carries the `*`, outside its accessible name. */
function expectGroupRequired(name: string) {
  const group = screen.getByRole("group", { name });
  const legend = group.querySelector("legend")!;
  expect(legend.querySelector('[aria-hidden="true"]')?.textContent).toBe("*");
}

describe("required fields", () => {
  it("mark the vaccine's required fields with a * and nothing on the optional ones", async () => {
    mockApi(animalRoutes(cat));
    renderApp("/animais/a1/registrar/vacina");
    await screen.findByRole("group", { name: "Contra o quê" });
    expectRequired(screen.getByLabelText("Data"));
    expectGroupRequired("Contra o quê");
    expectOptional(screen.getByLabelText("Repetir em"));
    expect(screen.queryByText(/opcional/)).toBeNull();
  });

  it("mark the animal's species, name and birth, and the birth field while it shows", async () => {
    mockApi({});
    const { user } = renderApp("/animais/novo");
    const species = await screen.findByRole("radiogroup", { name: "Espécie" });
    expect(species.getAttribute("aria-required")).toBe("true");
    expectGroupRequired("Espécie");
    expectGroupRequired("Nascimento");
    expectRequired(screen.getByLabelText("Nome"));
    for (const label of ["Raça", "Pelagem", "Microchip", "Adoção"])
      expectOptional(screen.getByLabelText(label));
    const sex = screen.getByRole("group", { name: "Sexo" });
    expect(within(sex).queryByText("*")).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Só o ano" }));
    expectRequired(
      screen.getByLabelText("Só o ano", { selector: "input:not([type=radio])" }),
    );
    expect(screen.queryByText(/opcional/)).toBeNull();
  });

  it("leave the sign-in and sign-up screens without a *", async () => {
    mockApi({});
    renderApp("/entrar", { as: null });
    await screen.findByLabelText("E-mail");
    expect(screen.queryByText("*")).toBeNull();
    expect(screen.getByLabelText("Senha").getAttribute("aria-required")).toBeNull();
  });
});
