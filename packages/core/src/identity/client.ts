/**
 * The identity client, written by hand: allauth's headless flows (the "app"
 * client) sit outside the ninja OpenAPI document (ADR-0002).
 *
 * Every successful sign-up, sign-in or password reset answers a session token;
 * the app keeps it (localStorage on the web, the Keychain on the phone) and the
 * API client sends it on every call. Typed, with no DOM and no React Native.
 */

export interface IdentityError {
  /** allauth's error code (`email_taken`, `email_password_mismatch`, …), or a status. */
  code: string;
  /** The field it is about, when there is one. */
  param?: string;
  message: string;
}

export class IdentityFailure extends Error {
  constructor(
    readonly status: number,
    readonly errors: IdentityError[],
  ) {
    super(errors[0]?.message ?? `identity call failed (${status})`);
  }

  has(code: string): boolean {
    return this.errors.some((e) => e.code === code);
  }
}

export interface Session {
  token: string;
  email: string;
}

/** A started password reset: the code was e-mailed, the flow token is kept. */
export interface PendingReset {
  flowToken: string;
  email: string;
}

interface Envelope {
  status: number;
  data?: { user?: { email?: string } };
  meta?: { session_token?: string; is_authenticated?: boolean };
  errors?: IdentityError[];
}

export interface IdentityConfig {
  baseUrl: string;
  fetch?: typeof fetch;
}

export function createIdentity(config: IdentityConfig) {
  const doFetch = config.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const base = `${config.baseUrl}/_allauth/app/v1`;

  async function call(
    method: string,
    path: string,
    body?: unknown,
    token?: string,
  ): Promise<{ status: number; envelope: Envelope }> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers["X-Session-Token"] = token;
    const response = await doFetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let envelope: Envelope = { status: response.status };
    try {
      envelope = (await response.json()) as Envelope;
    } catch {
      // An empty or non-JSON body: keep the status only.
    }
    return { status: response.status, envelope };
  }

  function failure(status: number, envelope: Envelope): IdentityFailure {
    const errors = envelope.errors?.length
      ? envelope.errors
      : [{ code: String(status), message: `identity call failed (${status})` }];
    return new IdentityFailure(status, errors);
  }

  function session(status: number, envelope: Envelope, fallbackEmail: string): Session {
    const token = envelope.meta?.session_token;
    if (status !== 200 || !token) throw failure(status, envelope);
    return { token, email: envelope.data?.user?.email ?? fallbackEmail };
  }

  return {
    /** Create the account and sign in. */
    async signUp(email: string, password: string): Promise<Session> {
      const { status, envelope } = await call("POST", "/auth/signup", { email, password });
      return session(status, envelope, email);
    },

    async signIn(email: string, password: string): Promise<Session> {
      const { status, envelope } = await call("POST", "/auth/login", { email, password });
      return session(status, envelope, email);
    },

    /** Whether a kept token still opens a session. */
    async check(token: string): Promise<boolean> {
      const { status } = await call("GET", "/auth/session", undefined, token);
      return status === 200;
    },

    /** End the session on the server (answers 401 by design). */
    async signOut(token: string): Promise<void> {
      await call("DELETE", "/auth/session", undefined, token);
    },

    /** E-mail a reset code. The answer is the same whether the address exists or not. */
    async requestReset(email: string): Promise<PendingReset> {
      const { status, envelope } = await call("POST", "/auth/password/request", { email });
      const flowToken = envelope.meta?.session_token;
      if (status === 401 && flowToken) return { flowToken, email };
      if (status === 200 && flowToken) return { flowToken, email };
      throw failure(status, envelope);
    },

    /** Set the new password with the e-mailed code; signs in. */
    async resetPassword(pending: PendingReset, code: string, password: string): Promise<Session> {
      const { status, envelope } = await call(
        "POST",
        "/auth/password/reset",
        { key: code.trim().toUpperCase(), password },
        pending.flowToken,
      );
      return session(status, envelope, pending.email);
    },
  };
}

export type Identity = ReturnType<typeof createIdentity>;

/** The on-screen message for an identity failure, in pt-BR. */
export function identityMessage(error: unknown): string {
  if (!(error instanceof IdentityFailure)) return "Não deu para falar com o servidor. Tente de novo.";
  if (error.has("email_taken")) return "Já existe uma conta com este e-mail.";
  if (error.has("email_password_mismatch")) return "E-mail ou senha não conferem.";
  if (error.has("password_too_short")) return "A senha precisa de pelo menos 8 caracteres.";
  if (error.has("password_too_common")) return "Esta senha é comum demais. Escolha outra.";
  if (error.has("password_entirely_numeric")) return "A senha não pode ter só números.";
  if (error.has("incorrect_code")) return "Código incorreto. Confira o e-mail.";
  if (error.status === 409) return "O pedido de senha nova venceu. Peça outro código.";
  if (error.status === 429) return "Muitas tentativas. Espere um pouco e tente de novo.";
  // allauth's own messages are already in pt-BR (the backend's language).
  return error.message;
}
