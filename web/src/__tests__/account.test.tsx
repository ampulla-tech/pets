import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { mockApi, reply } from "./api";
import { renderApp } from "./render";
import { animal } from "./fixtures";

const ALLAUTH = "/_allauth/app/v1";
const signedIn = (email: string) => ({
  status: 200,
  data: { user: { email } },
  meta: { session_token: "tok-new", is_authenticated: true },
});

function emptyHome() {
  return {
    "GET /animals": [],
    "GET /reminders/upcoming": [],
    "GET /push/webpush/key": { public_key: "" },
  };
}

describe("account", () => {
  it("signs up and lands on the empty home", async () => {
    const api = mockApi({
      ...emptyHome(),
      [`POST ${ALLAUTH}/auth/signup`]: signedIn("bia@example.com"),
    });
    const { user, router } = renderApp("/cadastro", { as: null });
    await user.type(screen.getByLabelText("E-mail"), "bia@example.com");
    await user.type(screen.getByLabelText("Senha"), "uma-senha-boa");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(await screen.findByText("Nenhum animal ainda.")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");
    expect(api.to(`POST ${ALLAUTH}/auth/signup`)[0].json).toEqual({
      email: "bia@example.com",
      password: "uma-senha-boa",
    });
    // The API is called with the new session token.
    expect(api.to("GET /animals")[0].headers.get("X-Session-Token")).toBe("tok-new");
  });

  it("refuses a short password before calling the server", async () => {
    const api = mockApi({});
    const { user } = renderApp("/cadastro", { as: null });
    await user.type(screen.getByLabelText("E-mail"), "bia@example.com");
    await user.type(screen.getByLabelText("Senha"), "curta");
    await user.click(screen.getByRole("button", { name: "Criar conta" }));
    expect(
      await screen.findByText("A senha precisa de pelo menos 8 caracteres."),
    ).toBeTruthy();
    expect(api.calls).toHaveLength(0);
  });

  it("says when the e-mail and password do not match", async () => {
    mockApi({
      [`POST ${ALLAUTH}/auth/login`]: reply(400, {
        status: 400,
        errors: [{ code: "email_password_mismatch", message: "x" }],
      }),
    });
    const { user } = renderApp("/entrar", { as: null });
    await user.type(screen.getByLabelText("E-mail"), "bia@example.com");
    await user.type(screen.getByLabelText("Senha"), "errada-demais");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    expect(await screen.findByText("E-mail ou senha não conferem.")).toBeTruthy();
  });

  it("sends a signed-out visitor to /entrar and back where they were going", async () => {
    mockApi({
      [`POST ${ALLAUTH}/auth/login`]: signedIn("bia@example.com"),
      "GET /catalog": { dog: [], cat: [], parasites: [] },
      "GET /animals/a1": animal(),
      "GET /animals/a1/records": [],
      "GET /animals/a1/reminders": [],
    });
    const { user, router } = renderApp("/animais/a1", { as: null });
    await screen.findByRole("heading", { name: "Entrar" });
    expect(router.state.location.pathname).toBe("/entrar");
    expect(router.state.location.search).toBe("?volta=%2Fanimais%2Fa1");
    await user.type(screen.getByLabelText("E-mail"), "bia@example.com");
    await user.type(screen.getByLabelText("Senha"), "uma-senha-boa");
    await user.click(screen.getByRole("button", { name: "Entrar" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/animais/a1"));
  });

  it("resets the password with the e-mailed code and signs in", async () => {
    const api = mockApi({
      ...emptyHome(),
      [`POST ${ALLAUTH}/auth/password/request`]: reply(401, {
        status: 401,
        meta: { session_token: "flow-1" },
      }),
      [`POST ${ALLAUTH}/auth/password/reset`]: signedIn("bia@example.com"),
    });
    const { user, router } = renderApp("/recuperar", { as: null });
    await user.type(screen.getByLabelText("E-mail"), "bia@example.com");
    await user.click(screen.getByRole("button", { name: "Mandar o código" }));
    expect(await screen.findByText(/Se bia@example.com tem conta/)).toBeTruthy();
    const code = screen.getByLabelText("Código") as HTMLInputElement;
    await user.type(code, "ab12cd34");
    expect(code.value).toBe("AB12-CD34");
    await user.type(screen.getByLabelText("Senha nova"), "outra-senha-boa");
    await user.click(screen.getByRole("button", { name: "Salvar a senha nova" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    const reset = api.to(`POST ${ALLAUTH}/auth/password/reset`)[0];
    expect(reset.json).toEqual({ key: "AB12-CD34", password: "outra-senha-boa" });
    expect(reset.headers.get("X-Session-Token")).toBe("flow-1");
  });

  it("asks for the code in its format", async () => {
    mockApi({
      [`POST ${ALLAUTH}/auth/password/request`]: reply(401, {
        status: 401,
        meta: { session_token: "f" },
      }),
    });
    const { user } = renderApp("/recuperar", { as: null });
    await user.type(screen.getByLabelText("E-mail"), "bia@example.com");
    await user.click(screen.getByRole("button", { name: "Mandar o código" }));
    await user.type(await screen.findByLabelText("Código"), "AB1");
    await user.type(screen.getByLabelText("Senha nova"), "outra-senha-boa");
    await user.click(screen.getByRole("button", { name: "Salvar a senha nova" }));
    expect(await screen.findByText("Digite o código no formato XXXX-XXXX.")).toBeTruthy();
  });

  it("signs out: ends the session on the server and goes to /entrar", async () => {
    const api = mockApi({
      ...emptyHome(),
      [`DELETE ${ALLAUTH}/auth/session`]: reply(401, { status: 401 }),
    });
    const { user, router } = renderApp("/");
    await screen.findByText("Nenhum animal ainda.");
    await user.click(screen.getByRole("button", { name: "Menu" }));
    await user.click(await screen.findByRole("menuitem", { name: "Sair da conta" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/entrar"));
    expect(
      api.to(`DELETE ${ALLAUTH}/auth/session`)[0].headers.get("X-Session-Token"),
    ).toBe("token-1");
    expect(localStorage.getItem("pets.session")).toBeNull();
  });
});
