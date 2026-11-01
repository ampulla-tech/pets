import { describe, expect, it } from "vitest";
import { readCookie } from "@/lib/csrf";

describe("the CSRF cookie", () => {
  it("is read by name among the page's cookies", () => {
    expect(readCookie("csrftoken", "sessionid=x; csrftoken=abc%3D; other=1")).toBe(
      "abc=",
    );
    expect(readCookie("csrftoken", "sessionid=x")).toBeNull();
  });
});
