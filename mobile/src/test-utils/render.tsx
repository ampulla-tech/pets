/**
 * Render the real app (its routes, layouts and providers) at a URL, over the
 * fake API, the way a person would land on that screen.
 */

import { act } from "@testing-library/react-native";
import { renderRouter, screen } from "expo-router/testing-library";

const SESSION_KEY = "pets.session";

export const ME = { token: "token-1", email: "ana@example.com" };

/** Start signed in, as if the Keychain kept a session from an earlier launch. */
export function signedIn(session = ME) {
  const store = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;
  store.set(SESSION_KEY, JSON.stringify(session));
}

export function signedOut() {
  const store = (jest.requireMock("expo-secure-store") as { __store: Map<string, string> }).__store;
  store.clear();
}

/** Render the app at a URL; the router's helpers (getPathname, …) come along. */
export async function renderApp(initialUrl: string) {
  const result = renderRouter("./src/app", { initialUrl });
  // The testing library's render is asynchronous; the router puts its helpers
  // on what it returns.
  await result;
  // The session is read from the Keychain stand-in before anything shows.
  await act(async () => undefined);
  return {
    pathname: () => result.getPathname(),
    params: () => result.getSearchParams(),
    segments: () => result.getSegments(),
  };
}

type Json = { type: string; props: Record<string, unknown>; children: (Json | string)[] | null };

/**
 * The titles of the native headers on screen: a native stack hands its title
 * to the header config as a prop, never as text a query can find.
 */
export function headerTitles(): string[] {
  const titles: string[] = [];
  const walk = (node: Json | Json[] | string | null) => {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "RNSScreenStackHeaderConfig" && typeof node.props.title === "string") {
      titles.push(node.props.title);
    }
    node.children?.forEach(walk);
  };
  walk(screen.toJSON() as Json | Json[] | null);
  return titles;
}

export { screen };
