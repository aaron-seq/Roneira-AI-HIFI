import { describe, expect, it } from "vitest";
import { dueAlerts, marketOf, marketSessionDate, sessionRange, type ArmedAlert } from "./evaluate";

const now = new Date("2026-10-09T11:00:00Z");
const session = { timestamp: null, sessionDate: "2026-10-09", sessionTimezone: "Asia/Kolkata" };

const alert = (over: Partial<ArmedAlert> = {}): ArmedAlert => ({
  id: "a1",
  user_id: "u1",
  ticker: "TCS.NS",
  exchange: "NSE",
  alert_price: 3500,
  alert_revision: 0,
  alert_armed_at: "2026-10-08T10:00:00Z",
  ...over,
});

describe("price alert evaluation", () => {
  it("fires when the level sits inside the session's high-low range, even if the close left it", () => {
    const quotes = new Map([["TCS.NS", { ...session, price: 3450, high: 3520, low: 3440, previousClose: 3460 }]]);
    expect(dueAlerts([alert()], quotes, 20, now)).toHaveLength(1);
  });

  it("does not fire when the session never reached the level", () => {
    const quotes = new Map([["TCS.NS", { ...session, price: 3450, high: 3480, low: 3440, previousClose: 3460 }]]);
    expect(dueAlerts([alert()], quotes, 20, now)).toHaveLength(0);
  });

  it("does not invent touches across an overnight gap when a daily range is unavailable", () => {
    expect(sessionRange({ price: 3520, high: null, low: null, previousClose: 3480 })).toEqual([3520, 3520]);
    const quotes = new Map([["TCS.NS", { ...session, price: 3520, high: null, low: null, previousClose: 3480 }]]);
    expect(dueAlerts([alert()], quotes, 20, now)).toHaveLength(0);
    expect(dueAlerts([alert({ alert_price: 3520 })], quotes, 20, now)).toHaveLength(1);
    expect(sessionRange({ price: Number.NaN, high: null, low: null, previousClose: 3480 })).toBeNull();
  });

  it("skips tickers with no quote rather than guessing", () => {
    expect(dueAlerts([alert()], new Map())).toHaveLength(0);
  });

  it("caps notifications per user per run", () => {
    const quotes = new Map([["TCS.NS", { ...session, price: 3500, high: 3510, low: 3490, previousClose: 3500 }]]);
    const many = Array.from({ length: 30 }, (_, i) => alert({ id: `a${i}` }));
    const other = alert({ id: "b", user_id: "u2" });
    const due = dueAlerts([...many, other], quotes, 20, now);
    expect(due.filter((a) => a.user_id === "u1")).toHaveLength(20);
    expect(due.some((a) => a.user_id === "u2")).toBe(true);
  });

  it("rejects previous/future sessions, including holiday and weekend carry-forward data", () => {
    for (const sessionDate of ["2026-10-08", "2026-10-10", "invalid", null]) {
      const quotes = new Map([["TCS.NS", { ...session, sessionDate, price: 3500, high: 3520, low: 3440 }]]);
      expect(dueAlerts([alert()], quotes, 20, now)).toHaveLength(0);
    }
    const quotes = new Map([["TCS.NS", { ...session, price: 3500, high: 3520, low: 3440 }]]);
    expect(dueAlerts([alert()], quotes, 20, new Date("2026-10-10T11:00:00Z"))).toHaveLength(0);
  });

  it("accepts actual intraday timestamps only for the current exchange date", () => {
    for (const timestamp of ["2026-10-09T10:00:00Z", "2026-10-09T15:30:00+05:30"]) {
      const quotes = new Map([["TCS.NS", { timestamp, price: 3500, high: 3520, low: 3440 }]]);
      expect(dueAlerts([alert()], quotes, 20, now)).toHaveLength(1);
    }
    for (const timestamp of [null, "invalid", "2026-10-08T10:00:00Z", "2026-10-09T12:00:00Z"]) {
      const quotes = new Map([["TCS.NS", { timestamp, price: 3500, high: 3520, low: 3440 }]]);
      expect(dueAlerts([alert()], quotes, 20, now)).toHaveLength(0);
    }
  });

  it("does not trust a fresh date label when the quote timestamp is stale", () => {
    const quotes = new Map([["TCS.NS", { ...session, timestamp: "2026-10-08T10:00:00Z", price: 3500, high: 3520, low: 3440 }]]);
    expect(dueAlerts([alert()], quotes, 20, now)).toHaveLength(0);
  });

  it("uses exchange-local dates at UTC day boundaries and across US DST", () => {
    expect(marketSessionDate("india", new Date("2026-10-08T19:00:00Z"))).toBe("2026-10-09");
    expect(marketSessionDate("us", new Date("2026-10-09T01:00:00Z"))).toBe("2026-10-08");
    expect(marketSessionDate("us", new Date("2026-11-02T04:30:00Z"))).toBe("2026-11-01");
  });

  it("skips invalid alert levels instead of treating NaN as an in-range value", () => {
    const quotes = new Map([["TCS.NS", { ...session, price: 3500, high: 3520, low: 3440 }]]);
    expect(dueAlerts([alert({ alert_price: Number.NaN }), alert({ alert_price: -1 })], quotes, 20, now)).toHaveLength(0);
  });

  it("does not fire a same-session re-arm using a range observed before it was armed", () => {
    const quotes = new Map([["TCS.NS", { ...session, price: 3450, high: 3520, low: 3440 }]]);
    expect(dueAlerts([alert({ alert_armed_at: "2026-10-09T10:30:00Z" })], quotes, 20, now)).toHaveLength(0);
    expect(dueAlerts([alert({ alert_armed_at: "2026-10-09T04:00:00Z" })], quotes, 20, now)).toHaveLength(0);
    expect(dueAlerts([alert({ alert_armed_at: "2026-10-09T03:44:00Z" })], quotes, 20, now)).toHaveLength(1);
  });

  it("uses only an actual post-arm last price for an alert armed during the session", () => {
    const armed = alert({ alert_armed_at: "2026-10-09T04:00:00Z" });
    const quote = { timestamp: "2026-10-09T10:00:00Z", price: 3450, high: 3520, low: 3440 };
    expect(dueAlerts([armed], new Map([["TCS.NS", quote]]), 20, now)).toHaveLength(0);
    expect(dueAlerts([armed], new Map([["TCS.NS", { ...quote, price: 3500 }]]), 20, now)).toHaveLength(1);
    expect(dueAlerts([armed], new Map([["TCS.NS", { ...quote, price: 3500, timestamp: "2026-10-09T03:00:00Z" }]]), 20, now)).toHaveLength(0);
  });

  it("maps exchanges to the market whose close triggers the run", () => {
    expect(marketOf("NSE")).toBe("india");
    expect(marketOf("BSE")).toBe("india");
    expect(marketOf("NASDAQ")).toBe("us");
    expect(marketOf("NYSE")).toBe("us");
  });
});
