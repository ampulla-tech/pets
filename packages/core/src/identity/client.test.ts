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

describe("the identity client", () => {
  it("signs up and keeps the session token", async () => {
    const { calls, fetch } = fakeFetch([
      [200, { status: 200, data: { user: { email: "ana@example.com" } }, meta: { session_token: "t1" } }],
    ]);
    const identity = createIdentity({ baseUrl: "http://api", fetch });
    const session = await identity.signUp("ana@example.com", "uma-senha-boa");
    expect(session).toEqual({ token: "t1", email: "ana@example.com" });
    expect(calls[0].url).toBe("http://api/_allauth/app/v1/auth/signup");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({
      email: "ana@example.com",
      password: "uma-senha-boa",
    });
  });

  it("reads allauth's errors", async () => {
    const { fetch } = fakeFetch([
      [400, { status: 400, errors: [{ code: "email_taken", param: "email", message: "x" }] }],
    ]);
    const identity = createIdentity({ baseUrl: "http://api", fetch });
    const error = await identity.signUp("ana@example.com", "x").catch((e) => e);
    expect(error).toBeInstanceOf(IdentityFailure);
    expect(identityMessage(error)).toBe("Já existe uma conta com este e-mail.");
  });

  it("resets the password with the code under the flow's token", async () => {
    const { calls, fetch } = fakeFetch([
      [401, { status: 401, meta: { session_token: "flow" } }],
      [200, { status: 200, data: { user: { email: "ana@example.com" } }, meta: { session_token: "t2" } }],
    ]);
    const identity = createIdentity({ baseUrl: "http://api", fetch });
    const pending = await identity.requestReset("ana@example.com");
    const session = await identity.resetPassword(pending, " znpd-nttt ", "outra-senha-boa");
    expect(session.token).toBe("t2");
    const headers = calls[1].init.headers as Record<string, string>;
    expect(headers["X-Session-Token"]).toBe("flow");
    expect(JSON.parse(String(calls[1].init.body)).key).toBe("ZNPD-NTTT");
  });
});
