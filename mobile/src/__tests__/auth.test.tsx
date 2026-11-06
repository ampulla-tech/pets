import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";

import { fakeApi } from "@/test-utils/api";
import { renderApp, signedIn, signedOut } from "@/test-utils/render";
import { strings } from "@pets/core/strings";

const store = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;

beforeEach(() => {
  signedOut();
});

describe("signing in", () => {
  it("sends a signed-out person to the sign-in screen, and in on the right password", async () => {
    const api = fakeApi({
      "POST /_allauth/app/v1/auth/login": {
        status: 200,
        body: { status: 200, data: { user: { email: "ana@example.com" } }, meta: { session_token: "tok-9" } },
      },
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
    });
    await renderApp("/");
    expect(await screen.findByRole("heading", { name: strings.auth.signInTitle })).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("email"), "ana@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "senha-boa-123");
    await fireEvent.press(screen.getByTestId("sign-in"));

    expect(await screen.findByText(strings.home.empty)).toBeTruthy();
    expect(api.callsTo("POST /_allauth/app/v1/auth/login")[0].body).toEqual({
      email: "ana@example.com",
      password: "senha-boa-123",
    });
    expect(JSON.parse(store.get("pets.session")!)).toEqual({ token: "tok-9", email: "ana@example.com" });
    expect(api.callsTo("GET /animals")[0].headers["x-session-token"]).toBe("tok-9");
  });

  it("says when the e-mail and the password do not match", async () => {
    fakeApi({
      "POST /_allauth/app/v1/auth/login": {
        status: 400,
        body: { status: 400, errors: [{ code: "email_password_mismatch", message: "x" }] },
      },
    });
    await renderApp("/entrar");
    await fireEvent.changeText(await screen.findByTestId("email"), "ana@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "errada");
    await fireEvent.press(screen.getByTestId("sign-in"));
    expect(await screen.findByText("E-mail ou senha não conferem.")).toBeTruthy();
  });
});

describe("signing up", () => {
  it("checks the e-mail and the password before calling, then creates the account", async () => {
    const api = fakeApi({
      "POST /_allauth/app/v1/auth/signup": {
        status: 401,
        body: {
          status: 401,
          data: { flows: [{ id: "signup" }, { id: "verify_email", is_pending: true }] },
          meta: { is_authenticated: false, session_token: "flow-2" },
        },
      },
      "POST /_allauth/app/v1/auth/email/verify/resend": { body: { status: 200 } },
      "POST /_allauth/app/v1/auth/email/verify": {
        body: { status: 200, data: { user: { email: "bia@example.com" } }, meta: { session_token: "tok-2" } },
      },
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
    });
    await renderApp("/cadastro");
    await fireEvent.changeText(await screen.findByTestId("email"), "bia");
    await fireEvent.changeText(screen.getByTestId("password"), "123");
    await fireEvent.press(screen.getByTestId("sign-up"));
    expect(await screen.findByText(strings.auth.invalidEmail)).toBeTruthy();
    expect(screen.getByText(strings.auth.shortPassword)).toBeTruthy();
    expect(api.calls).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId("email"), "bia@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "uma-senha-longa");
    await fireEvent.press(screen.getByTestId("sign-up"));

    // The account is usable only once the e-mailed code is typed.
    expect(await screen.findByText(strings.auth.verifyIntro("bia@example.com"))).toBeTruthy();
    expect(store.has("pets.session")).toBe(false);
    await fireEvent.changeText(screen.getByTestId("verify-code"), "abc");
    await fireEvent.press(screen.getByTestId("verify"));
    expect(await screen.findByText(strings.auth.codeInvalid)).toBeTruthy();
    await fireEvent.press(screen.getByTestId("resend-code"));
    expect(await screen.findByText(strings.auth.codeResent)).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("verify-code"), "ab12cd34");
    await fireEvent.press(screen.getByTestId("verify"));
    expect(await screen.findByText(strings.home.empty)).toBeTruthy();

    const verify = api.callsTo("POST /_allauth/app/v1/auth/email/verify")[0];
    expect(verify.body).toEqual({ key: "AB12-CD34" });
    expect(verify.headers["x-session-token"]).toBe("flow-2");
    expect(api.callsTo("POST /_allauth/app/v1/auth/email/verify/resend")[0].headers["x-session-token"]).toBe("flow-2");
    expect(JSON.parse(store.get("pets.session")!)).toEqual({ token: "tok-2", email: "bia@example.com" });
    expect(api.callsTo("GET /animals")[0].headers["x-session-token"]).toBe("tok-2");
  });

  it("an account not yet confirmed gets the code screen at sign-in", async () => {
    fakeApi({
      "POST /_allauth/app/v1/auth/login": {
        status: 401,
        body: {
          status: 401,
          data: { flows: [{ id: "verify_email", is_pending: true }] },
          meta: { is_authenticated: false, session_token: "flow-3" },
        },
      },
    });
    await renderApp("/entrar");
    await fireEvent.changeText(await screen.findByTestId("email"), "bia@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "uma-senha-longa");
    await fireEvent.press(screen.getByTestId("sign-in"));
    expect(await screen.findByTestId("verify-code")).toBeTruthy();
  });

  it("tells a taken e-mail apart", async () => {
    fakeApi({
      "POST /_allauth/app/v1/auth/signup": {
        status: 400,
        body: { status: 400, errors: [{ code: "email_taken", param: "email", message: "x" }] },
      },
    });
    await renderApp("/cadastro");
    await fireEvent.changeText(await screen.findByTestId("email"), "bia@example.com");
    await fireEvent.changeText(screen.getByTestId("password"), "uma-senha-longa");
    await fireEvent.press(screen.getByTestId("sign-up"));
    expect(await screen.findByText("Já existe uma conta com este e-mail.")).toBeTruthy();
  });
});

describe("password reset by code", () => {
  it("asks the e-mail, then the code and the new password, and signs in", async () => {
    const api = fakeApi({
      "POST /_allauth/app/v1/auth/password/request": {
        status: 401,
        body: { status: 401, meta: { session_token: "flow-1" } },
      },
      "POST /_allauth/app/v1/auth/password/reset": {
        body: { status: 200, data: { user: { email: "ana@example.com" } }, meta: { session_token: "tok-3" } },
      },
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
    });
    await renderApp("/recuperar");
    await fireEvent.changeText(await screen.findByTestId("reset-email"), "ana@example.com");
    await fireEvent.press(screen.getByTestId("send-code"));

    expect(await screen.findByText(strings.auth.codeSent("ana@example.com"))).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId("reset-code"), "abc");
    await fireEvent.changeText(screen.getByTestId("reset-password"), "nova-senha-boa");
    await fireEvent.press(screen.getByTestId("set-password"));
    expect(await screen.findByText(strings.auth.codeInvalid)).toBeTruthy();

    await fireEvent.changeText(screen.getByTestId("reset-code"), "abcd1234");
    await fireEvent.press(screen.getByTestId("set-password"));
    expect(await screen.findByText(strings.home.empty)).toBeTruthy();
    const reset = api.callsTo("POST /_allauth/app/v1/auth/password/reset")[0];
    expect(reset.body).toEqual({ key: "ABCD-1234", password: "nova-senha-boa" });
    expect(reset.headers["x-session-token"]).toBe("flow-1");
  });
});

describe("signing out", () => {
  it("forgets this phone's push token and the session", async () => {
    signedIn();
    store.set("pets.expoPushToken", "ExponentPushToken[abc]");
    const api = fakeApi({
      "GET /animals": { body: [] },
      "GET /notices/unread": { body: { unread: false } },
      "POST /push/expo/remove": { status: 204 },
      "DELETE /_allauth/app/v1/auth/session": { status: 401, body: { status: 401 } },
    });
    await renderApp("/perfil");
    await fireEvent.press(await screen.findByTestId("sign-out"));
    expect(await screen.findByTestId("sign-in")).toBeTruthy();
    expect(api.callsTo("POST /push/expo/remove")[0].body).toEqual({ token: "ExponentPushToken[abc]" });
    expect(api.callsTo("DELETE /_allauth/app/v1/auth/session")).toHaveLength(1);
    expect(store.has("pets.session")).toBe(false);
    expect(store.has("pets.expoPushToken")).toBe(false);
    await act(async () => undefined);
  });
});

it("a 401 on a kept session signs out", async () => {
  signedIn();
  fakeApi({
    "GET /animals": { status: 401, body: { detail: "Unauthorized" } },
    "GET /notices/unread": { status: 401, body: { detail: "Unauthorized" } },
  });
  await renderApp("/");
  await waitFor(() => expect(screen.getByTestId("sign-in")).toBeTruthy());
});
