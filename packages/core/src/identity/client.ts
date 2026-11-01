/**
 * The identity client, written by hand: allauth's headless flows sit outside
 * the ninja OpenAPI document (ADR-0002). One client, two transports:
 *
 * - `"app"` (the native app): every successful sign-up, sign-in or reset
 *   answers a session token, which the app keeps (the Keychain) and the API
 *   client sends as `X-Session-Token`. A flow in progress (the e-mail code, the
 *   reset code) is carried by its own flow token.
 * - `"browser"` (the web): the session, and any flow in progress, is allauth's
 *   session cookie. Every call carries the cookies, and every write sends the
 *   CSRF cookie back as `X-CSRFToken`, read through `csrfToken()`.
 *
 * A new account, or one not yet confirmed, is not signed in: sign-up and
 * sign-in answer a pending e-mail confirmation, finished with the code the API
 * e-mailed. Typed, with no DOM and no React Native.
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
  email: string;
  /** allauth's session token: the "app" client's. The "browser" client's session is its cookie (null). */
  token: string | null;
}

/** A flow waiting for an e-mailed code. The "app" client carries it by its flow token. */
interface PendingFlow {
  email: string;
  flowToken: string | null;
}

/** A started password reset: the code was e-mailed. */
export type PendingReset = PendingFlow;

/** An account waiting for its e-mail to be confirmed: the code was e-mailed. */
export type PendingVerification = PendingFlow;

/** What sign-up and sign-in answer: a session, or the e-mail still to confirm. */
export type SignInResult =
  | { status: "signedIn"; session: Session }
  | { status: "verifyEmail"; pending: PendingVerification };

interface Envelope {
  status: number;
  data?: {
    user?: { email?: string };
    flows?: { id: string; is_pending?: boolean }[];
  };
  meta?: { session_token?: string; is_authenticated?: boolean };
  errors?: IdentityError[];
}

interface CommonConfig {
  baseUrl: string;
  fetch?: typeof fetch;
}

export type IdentityConfig =
  | (CommonConfig & { client?: "app" })
  | (CommonConfig & {
      client: "browser";
      /** The CSRF cookie's value now, read by the web from its cookies. */
      csrfToken(): string | null;
    });

const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export function createIdentity(config: IdentityConfig) {
  const doFetch = config.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const browser = config.client === "browser" ? config : null;
  const base = `${config.baseUrl}/_allauth/${browser ? "browser" : "app"}/v1`;

  async function call(
    method: string,
    path: string,
    body?: unknown,
    token?: string | null,
  ): Promise<{ status: number; envelope: Envelope }> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (browser && !SAFE.has(method)) {
      // Any allauth answer sets the CSRF cookie: ask for one if it is missing.
      if (!browser.csrfToken())
        await doFetch(`${base}/auth/session`, { credentials: "include" }).catch(
          () => undefined,
        );
      const csrf = browser.csrfToken();
      if (csrf) headers["X-CSRFToken"] = csrf;
    } else if (!browser && token) {
      headers["X-Session-Token"] = token;
    }
    const response = await doFetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      ...(browser ? { credentials: "include" as const } : {}),
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

  function signedIn(status: number, envelope: Envelope, fallbackEmail: string): Session {
    const token = envelope.meta?.session_token ?? null;
    if (status !== 200 || (!browser && !token)) throw failure(status, envelope);
    return {
      email: envelope.data?.user?.email ?? fallbackEmail,
      token: browser ? null : token,
    };
  }

  function pendingFlow(envelope: Envelope, email: string): PendingFlow {
    return { email, flowToken: browser ? null : (envelope.meta?.session_token ?? null) };
  }

  /** Sign-up and sign-in: a session, or the e-mail confirmation allauth asks for. */
  function signInResult(status: number, envelope: Envelope, email: string): SignInResult {
    const verifying = envelope.data?.flows?.some(
      (flow) => flow.id === "verify_email" && flow.is_pending,
    );
    if (status === 401 && verifying)
      return { status: "verifyEmail", pending: pendingFlow(envelope, email) };
    return { status: "signedIn", session: signedIn(status, envelope, email) };
  }

  return {
    /** Create the account; its e-mail is to be confirmed before it signs in. */
    async signUp(email: string, password: string): Promise<SignInResult> {
      const { status, envelope } = await call("POST", "/auth/signup", {
        email,
        password,
      });
      return signInResult(status, envelope, email);
    },

    /** Sign in; an account not yet confirmed gets a fresh code instead. */
    async signIn(email: string, password: string): Promise<SignInResult> {
      const { status, envelope } = await call("POST", "/auth/login", { email, password });
      return signInResult(status, envelope, email);
    },

    /** Confirm the e-mail with the code it received; signs in. */
    async verifyEmail(pending: PendingVerification, code: string): Promise<Session> {
      const { status, envelope } = await call(
        "POST",
        "/auth/email/verify",
        { key: code.trim().toUpperCase() },
        pending.flowToken,
      );
      return signedIn(status, envelope, pending.email);
    },

    /** E-mail another confirmation code. */
    async resendVerification(pending: PendingVerification): Promise<void> {
      const { status, envelope } = await call(
        "POST",
        "/auth/email/verify/resend",
        {},
        pending.flowToken,
      );
      if (status !== 200) throw failure(status, envelope);
    },

    /** The session open now, if any: the token's ("app"), or the cookie's ("browser"). */
    async current(token?: string | null): Promise<Session | null> {
      if (!browser && !token) return null;
      const { status, envelope } = await call("GET", "/auth/session", undefined, token);
      const email = envelope.data?.user?.email;
      if (status !== 200 || !email) return null;
      return { email, token: browser ? null : (token ?? null) };
    },

    /** End the session on the server (answers 401 by design). */
    async signOut(token?: string | null): Promise<void> {
      await call("DELETE", "/auth/session", undefined, token);
    },

    /** E-mail a reset code. The answer is the same whether the address exists or not. */
    async requestReset(email: string): Promise<PendingReset> {
      const { status, envelope } = await call("POST", "/auth/password/request", {
        email,
      });
      const pending = pendingFlow(envelope, email);
      if ((status === 401 || status === 200) && (browser || pending.flowToken))
        return pending;
      throw failure(status, envelope);
    },

    /** Set the new password with the e-mailed code; signs in. */
    async resetPassword(
      pending: PendingReset,
      code: string,
      password: string,
    ): Promise<Session> {
      const { status, envelope } = await call(
        "POST",
        "/auth/password/reset",
        { key: code.trim().toUpperCase(), password },
        pending.flowToken,
      );
      return signedIn(status, envelope, pending.email);
    },
  };
}

export type Identity = ReturnType<typeof createIdentity>;

/** The on-screen message for an identity failure, in pt-BR. */
export function identityMessage(
  error: unknown,
  flow: "reset" | "verify" = "reset",
): string {
  if (!(error instanceof IdentityFailure))
    return "Não deu para falar com o servidor. Tente de novo.";
  if (error.has("email_taken")) return "Já existe uma conta com este e-mail.";
  if (error.has("email_password_mismatch")) return "E-mail ou senha não conferem.";
  if (error.has("password_too_short"))
    return "A senha precisa de pelo menos 8 caracteres.";
  if (error.has("password_too_common"))
    return "Esta senha é comum demais. Escolha outra.";
  if (error.has("password_entirely_numeric")) return "A senha não pode ter só números.";
  if (error.has("incorrect_code")) return "Código incorreto. Confira o e-mail.";
  if (error.status === 409)
    return flow === "verify"
      ? "O código venceu. Entre de novo para receber outro."
      : "O pedido de senha nova venceu. Peça outro código.";
  if (error.status === 429) return "Muitas tentativas. Espere um pouco e tente de novo.";
  // allauth's own messages are already in pt-BR (the backend's language).
  return error.message;
}
