import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { setUpApi } from "@/lib/api";
import { session } from "@/lib/session";

setUpApi();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  session.reload();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
