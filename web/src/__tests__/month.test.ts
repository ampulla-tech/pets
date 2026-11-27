import { describe, expect, it } from "vitest";
import { monthValue } from "@/lib/dates";

// Where the browser has no month picker (Safari and Firefox on a computer) the
// lot expiry field is plain text: what the tutor types goes through here.
describe("a month typed where there is no picker", () => {
  it("takes the picker's own value and the typed MM/AAAA", () => {
    expect(monthValue("2027-09")).toBe("2027-09");
    expect(monthValue("09/2027")).toBe("2027-09");
    expect(monthValue("9/2027")).toBe("2027-09");
  });

  it("refuses what is not a month", () => {
    expect(monthValue("092027")).toBeNull();
    expect(monthValue("13/2027")).toBeNull();
    expect(monthValue("set 27")).toBeNull();
  });
});
