/**
 * The session: allauth's token (ADR-0002), kept in the Keychain / Keystore
 * through expo-secure-store and sent as `X-Session-Token` by the API client.
 *
 * The token lives in a module variable as well as in React state, because the
 * API client reads it on every call, outside any component.
 */

import { configureApi } from "@pets/core/api";
import type { Session } from "@pets/core/identity";
import { useQueryClient } from "@tanstack/react-query";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { API_URL } from "./env";
import { identity } from "./identity";
import { forgetPushToken } from "./push";

const KEY = "pets.session";

export type SessionState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; token: string; email: string };

interface SessionApi {
  state: SessionState;
  /** Keep a session identity answered (sign-in, sign-up, password reset). */
  signIn(session: Session): Promise<void>;
  /** End the session here and on the server; forgets this phone's push token. */
  signOut(): Promise<void>;
}

let currentToken: string | null = null;
let onGone: (() => void) | null = null;

configureApi({
  baseUrl: API_URL,
  token: () => currentToken,
  onUnauthorized: () => onGone?.(),
});

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const queryClient = useQueryClient();
  const signingOut = useRef(false);

  const clear = useCallback(async () => {
    currentToken = null;
    await SecureStore.deleteItemAsync(KEY);
    queryClient.clear();
    setState({ status: "signedOut" });
  }, [queryClient]);

  useEffect(() => {
    let alive = true;
    SecureStore.getItemAsync(KEY)
      .then((raw) => {
        if (!alive) return;
        const kept = raw ? (JSON.parse(raw) as Session) : null;
        if (kept?.token) {
          currentToken = kept.token;
          setState({ status: "signedIn", token: kept.token, email: kept.email });
        } else {
          setState({ status: "signedOut" });
        }
      })
      .catch(() => alive && setState({ status: "signedOut" }));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // A 401 on a call that carried the token: the session is gone server-side.
    onGone = () => {
      if (!signingOut.current) void clear();
    };
    return () => {
      onGone = null;
    };
  }, [clear]);

  const signIn = useCallback(async (session: Session) => {
    currentToken = session.token;
    await SecureStore.setItemAsync(KEY, JSON.stringify(session));
    setState({ status: "signedIn", token: session.token, email: session.email });
  }, []);

  const signOut = useCallback(async () => {
    const token = currentToken;
    signingOut.current = true;
    try {
      await forgetPushToken().catch(() => undefined);
      if (token) await identity.signOut(token).catch(() => undefined);
    } finally {
      signingOut.current = false;
      await clear();
    }
  }, [clear]);

  const value = useMemo(() => ({ state, signIn, signOut }), [state, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession outside SessionProvider");
  return value;
}
