import { describe, expect, it } from "vitest";
import type { NoticeOut } from "../generated/api/types.gen";
import { groupNotices, initialOf, noticeDayLabel, noticeTime } from "./notices";
import { canOfferPush, pushBanner, unblockSteps } from "./push";

const notice = (id: string, sent_at: string): NoticeOut => ({
  id,
  animal_id: "a",
  animal_name: "Paçoca",
  sent_at,
  title: "Hoje é dia de vacinar a Paçoca.",
  body: "Vanguard Plus",
  url: "/animais/a",
  read: false,
});

describe("the notice list", () => {
  const now = new Date(2026, 10, 6, 15, 0);

  it("names each day from today", () => {
    expect(noticeDayLabel(new Date(2026, 10, 6, 8).toISOString(), now)).toBe("Hoje");
    expect(noticeDayLabel(new Date(2026, 10, 5, 8).toISOString(), now)).toBe("Ontem");
    expect(noticeDayLabel(new Date(2026, 9, 30, 8).toISOString(), now)).toBe(
      "30 de outubro",
    );
    expect(noticeDayLabel(new Date(2025, 11, 24, 8).toISOString(), now)).toBe(
      "24 de dezembro de 2025",
    );
  });

  it("groups the notices by the day they were sent, keeping their order", () => {
    const days = groupNotices(
      [
        notice("3", new Date(2026, 10, 6, 9).toISOString()),
        notice("2", new Date(2026, 10, 6, 8).toISOString()),
        notice("1", new Date(2026, 10, 5, 8).toISOString()),
      ],
      now,
    );
    expect(days.map((d) => [d.label, d.items.map((n) => n.id)])).toEqual([
      ["Hoje", ["3", "2"]],
      ["Ontem", ["1"]],
    ]);
  });

  it("says the hour and the animal's initial", () => {
    expect(noticeTime(new Date(2026, 10, 6, 8, 5).toISOString())).toBe("08:05");
    expect(initialOf(" paçoca")).toBe("P");
  });
});

describe("the notification on this device", () => {
  it("shows a banner only when it can be asked or installed, until Agora não", () => {
    expect(pushBanner("askable", false)).toBe("ask");
    expect(pushBanner("ios-install", false)).toBe("install");
    expect(pushBanner("askable", true)).toBeNull();
    expect(pushBanner("ios-install", true)).toBeNull();
    for (const state of ["active", "blocked", "unsupported", null] as const) {
      expect(pushBanner(state, false)).toBeNull();
    }
  });

  it("offers Ativar notificações in the menu unless it is active or impossible", () => {
    expect(canOfferPush("askable")).toBe(true);
    expect(canOfferPush("ios-install")).toBe(true);
    expect(canOfferPush("blocked")).toBe(true);
    expect(canOfferPush("active")).toBe(false);
    expect(canOfferPush("unsupported")).toBe(false);
  });

  it("has numbered steps for every device it tells how to unblock", () => {
    expect(unblockSteps("ios").map((s) => s.join(""))).toEqual([
      "Abra os Ajustes e toque em Apps.",
      "Toque em Pets e depois em Notificações.",
      "Ligue Permitir Notificações.",
    ]);
    expect(unblockSteps("android")).toHaveLength(3);
    expect(unblockSteps("other")).toHaveLength(1);
  });
});
