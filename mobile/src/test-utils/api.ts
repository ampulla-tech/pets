/**
 * A fake API behind `fetch`: a test lists the answers by "METHOD /path" (the
 * path without the query string, or with it to be specific), and every call
 * is recorded so the test can assert what was sent.
 */

export type Answer =
  | { status?: number; body?: unknown }
  | ((call: Call) => { status?: number; body?: unknown });

export interface Call {
  method: string;
  path: string;
  url: string;
  headers: Record<string, string>;
  body: unknown;
}

export interface FakeApi {
  calls: Call[];
  /** The calls to one "METHOD /path". */
  callsTo(route: string): Call[];
  on(route: string, answer: Answer): void;
}

async function readBody(init?: RequestInit, request?: Request): Promise<unknown> {
  const body = init?.body ?? (request ? await request.text().catch(() => undefined) : undefined);
  if (body === undefined || body === null || body === "") return undefined;
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

export function fakeApi(routes: Record<string, Answer> = {}): FakeApi {
  const table = new Map(Object.entries(routes));
  const calls: Call[] = [];

  const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const isRequest = typeof input === "object" && "method" in input && "headers" in input;
    const request = isRequest ? (input as Request) : undefined;
    const url = request ? request.url : String(input);
    const method = (init?.method ?? request?.method ?? "GET").toUpperCase();
    const parsed = new URL(url);
    const path = parsed.pathname;
    const headers: Record<string, string> = {};
    new Headers(request ? request.headers : init?.headers).forEach((v, k) => (headers[k] = v));
    const call: Call = { method, path, url, headers, body: await readBody(isRequest ? undefined : init, request) };
    calls.push(call);
    const answer = table.get(`${method} ${path}${parsed.search}`) ?? table.get(`${method} ${path}`);
    if (!answer) {
      return new Response(JSON.stringify({ detail: `no fake for ${method} ${path}` }), {
        status: 599,
        headers: { "Content-Type": "application/json" },
      });
    }
    const { status = 200, body } = typeof answer === "function" ? answer(call) : answer;
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;

  // The multipart uploads go through XMLHttpRequest (src/lib/files.ts): the
  // same table answers them.
  class FakeXhr {
    status = 0;
    responseText = "";
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    private method = "GET";
    private url = "";
    private headers: Record<string, string> = {};
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }
    send(body: unknown) {
      void fetchMock(this.url, { method: this.method, headers: this.headers, body: body as BodyInit })
        .then(async (response) => {
          this.status = response.status;
          this.responseText = await response.text();
          this.onload?.();
        })
        .catch(() => this.onerror?.());
    }
  }
  globalThis.XMLHttpRequest = FakeXhr as unknown as typeof XMLHttpRequest;

  return {
    calls,
    callsTo: (route) => calls.filter((c) => `${c.method} ${c.path}` === route),
    on: (route, answer) => table.set(route, answer),
  };
}
