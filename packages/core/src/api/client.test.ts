import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch, authHeaders, configureApi } from "./client";

function captureFetch(status = 200) {
  const requests: Request[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (request: Request) => {
      requests.push(request);
      return new Response("{}", { status });
    }),
  );
  return requests;
}

afterEach(() => vi.unstubAllGlobals());

describe("the API client's session", () => {
  it("native: the token on every call, no cookies", async () => {
    const requests = captureFetch();
    configureApi({ baseUrl: "http://api", token: () => "t1" });
    await apiFetch("http://api/animals", { method: "POST", body: "{}" });
    expect(requests[0].headers.get("X-Session-Token")).toBe("t1");
    expect(requests[0].headers.get("X-CSRFToken")).toBeNull();
    expect(requests[0].credentials).not.toBe("include");
    expect(authHeaders()).toEqual({ "X-Session-Token": "t1" });
  });

  it("web: the cookies on every call, CSRF on writes only", async () => {
    const requests = captureFetch();
    configureApi({ baseUrl: "http://api", csrfToken: () => "c1" });
    await apiFetch("http://api/animals");
    await apiFetch("http://api/animals/a1/visits/v1/attachments", {
      method: "POST",
      body: new FormData(),
    });
    expect(requests.map((r) => r.credentials)).toEqual(["include", "include"]);
    expect(requests[0].headers.get("X-CSRFToken")).toBeNull();
    expect(requests[1].headers.get("X-CSRFToken")).toBe("c1");
    expect(requests[1].headers.get("X-Session-Token")).toBeNull();
    expect(authHeaders()).toEqual({});
  });

  it("a 401 signs the app out", async () => {
    captureFetch(401);
    const onUnauthorized = vi.fn();
    configureApi({ baseUrl: "http://api", csrfToken: () => "c1", onUnauthorized });
    await apiFetch("http://api/me");
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });
});
