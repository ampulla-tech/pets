/**
 * A fake API behind `fetch`: the screens run against it exactly as against the
 * backend, through the generated client and the identity client.
 */
import { vi } from "vitest";

export interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Headers;
  json: unknown;
  form: FormData | null;
}

const REPLY = Symbol("reply");
type Reply = {
  [REPLY]: true;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  raw?: BodyInit;
};
type Handler = (call: Call, params: Record<string, string>) => Reply | unknown;

function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/");
  const b = path.split("/");
  if (a.length !== b.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function reply(
  status: number,
  body?: unknown,
  headers?: Record<string, string>,
): Reply {
  return { [REPLY]: true, status, body, headers };
}

/** A non-JSON answer (a PDF). */
export function raw(
  body: BodyInit,
  headers: Record<string, string>,
  status = 200,
): Reply {
  return { [REPLY]: true, status, raw: body, headers };
}

function isReply(value: unknown): value is Reply {
  return typeof value === "object" && value !== null && REPLY in value;
}

/**
 * `routes` maps "METHOD /path/:param" to a handler (or a fixed answer). A
 * call nobody answers fails the test loudly with a 599.
 */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const calls: Call[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(String(input), init);
    const url = new URL(request.url);
    const type = request.headers.get("content-type") ?? "";
    let json: unknown = null;
    let form: FormData | null = null;
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (type.includes("multipart/form-data")) form = await request.formData();
      else {
        const text = await request.text();
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = text;
        }
      }
    }
    const call: Call = {
      method: request.method,
      path: url.pathname,
      query: url.searchParams,
      headers: request.headers,
      json,
      form,
    };
    calls.push(call);
    for (const [key, handler] of Object.entries(routes)) {
      const [method, pattern] = key.split(" ");
      if (method !== request.method) continue;
      const params = match(pattern, url.pathname);
      if (!params) continue;
      const out =
        typeof handler === "function" ? (handler as Handler)(call, params) : handler;
      const r: Reply = isReply(out) ? out : { [REPLY]: true, status: 200, body: out };
      const status = r.status ?? 200;
      if (r.raw !== undefined) return new Response(r.raw, { status, headers: r.headers });
      if (status === 204 || r.body === undefined)
        return new Response(null, { status, headers: r.headers });
      return new Response(JSON.stringify(r.body), {
        status,
        headers: { "Content-Type": "application/json", ...r.headers },
      });
    }
    return new Response(
      JSON.stringify({ detail: `unmocked ${request.method} ${url.pathname}` }),
      { status: 599 },
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return {
    calls,
    /** The calls to one route ("POST /animals/:id/vaccines"). */
    to(key: string) {
      const [method, pattern] = key.split(" ");
      return calls.filter((c) => c.method === method && match(pattern, c.path));
    },
  };
}
