import { afterEach, beforeEach, vi } from "vitest";
import { cleanup, configure } from "@testing-library/react";
import { setUpApi } from "@/lib/api";
import { session } from "@/lib/session";

setUpApi();

beforeEach(() => {
  // The CSRF cookie the API sets with any allauth answer (ADR-0002).
  document.cookie = "csrftoken=csrf-1; path=/";
  localStorage.clear();
  sessionStorage.clear();
  session.reload();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A CI runner is slower than a laptop: give screens that load over the fake
// API more than the default second to settle.
configure({ asyncUtilTimeout: 5000 });
