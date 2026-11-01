import { describe, expect, it } from "vitest";

import { createIdentity, IdentityFailure, identityMessage } from "./client";

type Call = { url: string; init: RequestInit };

function fakeFetch(answers: [number, unknown][]) {
  const calls: Call[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const [status, body] = answers.shift() ?? [500, {}];
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof globalThis.fetch;
  return { calls, fetch };
}

const headersOf = (call: Call) => call.init.headers as Record<string, string>;

const verifying = (token?: string) => ({
  status: 401,
  data: { flows: [{ id: "login" }, { id: "verify_email", is_pending: true }] },
  meta: { is_authenticated: false, ...(token ? { session_token: token } : {}) },
});

describe("the identity client, app transport (native)", () => {
  it("signs up, then confirms the e-mail with the code under the flow's token", async () => {
    const { calls, fetch } = fakeFetch([
      [401, verifying("flow")],
      [
        200,
        {
          status: 200,
          data: { user: { email: "ana@example.com" } },
          meta: { session_token: "t1", is_authenticated: true },
        },
      ],
    ]);
    const identity = createIdentity({ baseUrl: "http://api", fetch });
    const result = await identity.signUp("ana@example.com", "uma-senha-boa");
    expect(result).toEqual({
      status: "verifyEmail",
      pending: { email: "ana@example.com", flowToken: "flow" },
    });
    expect(calls[0].url).toBe("http://api/_allauth/app/v1/auth/signup");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      email: "ana@example.com",
      password: "uma-senha-boa",
    });
    if (result.status !== "verifyEmail") throw new Error("unreachable");
    const session = await identity.verifyEmail(result.pending, " ab12-cd34 ");
    expect(session).toEqual({ token: "t1", email: "ana@example.com" });
    expect(calls[1].url).toBe("http://api/_allauth/app/v1/auth/email/verify");
    expect(headersOf(calls[1])["X-Session-Token"]).toBe("flow");
    expect(JSON.parse(String(calls[1].init.body))).toEqual({ key: "AB12-CD34" });
    expect(calls[1].init.credentials).toBeUndefined();
  });

  it("signs in a confirmed account straight away", async () => {
    const { fetch } = fakeFetch([
      [
        200,
        {
          status: 200,
          data: { user: { email: "ana@example.com" } },
          meta: { session_token: "t1", is_authenticated: true },
        },
      ],
    ]);
    const identity = createIdentity({ baseUrl: "http://api", fetch });
    expect(await identity.signIn("ana@example.com", "uma-senha-boa")).toEqual({
      status: "signedIn",
      session: { token: "t1", email: "ana@example.com" },
    });
  });

  it("reads allauth's errors", async () => {
    const { fetch } = fakeFetch([
      [
        400,
        { status: 400, errors: [{ code: "email_taken", param: "email", message: "x" }] },
      ],
    ]);
    const identity = createIdentity({ baseUrl: "http://api", fetch });
    const error = await identity.signUp("ana@example.com", "x").catch((e) => e);
    expect(error).toBeInstanceOf(IdentityFailure);
    expect(identityMessage(error)).toBe("Já existe uma conta com este e-mail.");
  });

  it("tells an expired confirmation from an expired reset", () => {
    const expired = new IdentityFailure(409, [{ code: "409", message: "x" }]);
    expect(identityMessage(expired, "verify")).toBe(
      "O código venceu. Entre de novo para receber outro.",
    );
    expect(identityMessage(expired)).toBe(
      "O pedido de senha nova venceu. Peça outro código.",
    );
  });

  it("resets the password with the code under the flow's token", async () => {
    const { calls, fetch } = fakeFetch([
      [401, { status: 401, meta: { session_token: "flow" } }],
      [
        200,
        {
          status: 200,
          data: { user: { email: "ana@example.com" } },
          meta: { session_token: "t2" },
        },
      ],
    ]);
    const identity = createIdentity({ baseUrl: "http://api", fetch });
    const pending = await identity.requestReset("ana@example.com");
    const session = await identity.resetPassword(
      pending,
      " znpd-nttt ",
      "outra-senha-boa",
    );
    expect(session.token).toBe("t2");
    expect(headersOf(calls[1])["X-Session-Token"]).toBe("flow");
    expect(JSON.parse(String(calls[1].init.body)).key).toBe("ZNPD-NTTT");
  });
});

describe("the identity client, browser transport (web)", () => {
  const browser = (fetch: typeof globalThis.fetch, csrf: string | null = "c1") =>
    createIdentity({
      baseUrl: "http://api",
      fetch,
      client: "browser",
      csrfToken: () => csrf,
    });

  it("signs up and confirms in the cookie's session, with CSRF on every write", async () => {
    const { calls, fetch } = fakeFetch([
      [401, verifying()],
      [
        200,
        {
          status: 200,
          data: { user: { email: "ana@example.com" } },
          meta: { is_authenticated: true },
        },
      ],
    ]);
    const identity = browser(fetch);
    const result = await identity.signUp("ana@example.com", "uma-senha-boa");
    expect(result).toEqual({
      status: "verifyEmail",
      pending: { email: "ana@example.com", flowToken: null },
    });
    expect(calls[0].url).toBe("http://api/_allauth/browser/v1/auth/signup");
    expect(calls[0].init.credentials).toBe("include");
    expect(headersOf(calls[0])["X-CSRFToken"]).toBe("c1");
    if (result.status !== "verifyEmail") throw new Error("unreachable");
    const session = await identity.verifyEmail(result.pending, "AB12-CD34");
    expect(session).toEqual({ email: "ana@example.com", token: null });
    expect(headersOf(calls[1])["X-Session-Token"]).toBeUndefined();
    expect(headersOf(calls[1])["X-CSRFToken"]).toBe("c1");
  });

  it("reads the cookie's session, with no CSRF on a read", async () => {
    const { calls, fetch } = fakeFetch([
      [200, { status: 200, data: { user: { email: "ana@example.com" } } }],
      [401, { status: 401, data: { flows: [] }, meta: { is_authenticated: false } }],
    ]);
    const identity = browser(fetch);
    expect(await identity.current()).toEqual({ email: "ana@example.com", token: null });
    expect(headersOf(calls[0])["X-CSRFToken"]).toBeUndefined();
    expect(calls[0].init.credentials).toBe("include");
    expect(await identity.current()).toBeNull();
  });

  it("fetches the CSRF cookie before a write when it has none yet", async () => {
    let csrf: string | null = null;
    const { calls, fetch } = fakeFetch([
      [401, { status: 401, meta: { is_authenticated: false } }],
      [401, verifying()],
    ]);
    const identity = createIdentity({
      baseUrl: "http://api",
      client: "browser",
      csrfToken: () => csrf,
      fetch: (async (url: string, init: RequestInit) => {
        csrf = "c2";
        return fetch(url, init);
      }) as unknown as typeof globalThis.fetch,
    });
    await identity.signUp("ana@example.com", "uma-senha-boa");
    expect(calls.map((c) => c.url)).toEqual([
      "http://api/_allauth/browser/v1/auth/session",
      "http://api/_allauth/browser/v1/auth/signup",
    ]);
    expect(headersOf(calls[1])["X-CSRFToken"]).toBe("c2");
  });

  it("starts a reset with no flow token", async () => {
    const { fetch } = fakeFetch([[401, { status: 401, meta: {} }]]);
    expect(await browser(fetch).requestReset("ana@example.com")).toEqual({
      email: "ana@example.com",
      flowToken: null,
    });
  });
});
