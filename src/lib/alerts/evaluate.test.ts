import { describe, expect, it } from "vitest";
import { dueAlerts, marketOf, sessionRange, type ArmedAlert } from "./evaluate";

const alert = (over: Partial<ArmedAlert> = {}): ArmedAlert => ({
  id: "a1",
  user_id: "u1",
  ticker: "TCS.NS",
  exchange: "NSE",
  alert_price: 3500,
  ...over,
});

describe("price alert evaluation", () => {
  it("fires when the level sits inside the session's high-low range, even if the close left it", () => {
    const quotes = new Map([["TCS.NS", { price: 3450, high: 3520, low: 3440, previousClose: 3460 }]]);
    expect(dueAlerts([alert()], quotes)).toHaveLength(1);
  });

  it("does not fire when the session never reached the level", () => {
    const quotes = new Map([["TCS.NS", { price: 3450, high: 3480, low: 3440, previousClose: 3460 }]]);
    expect(dueAlerts([alert()], quotes)).toHaveLength(0);
  });

  it("falls back to previous close -> last price when the quote has no range", () => {
    expect(sessionRange({ price: 3520, high: null, low: null, previousClose: 3480 })).toEqual([3480, 3520]);
    expect(sessionRange({ price: 3520, high: null, low: null, previousClose: null })).toBeNull();
  });

  it("skips tickers with no quote rather than guessing", () => {
    expect(dueAlerts([alert()], new Map())).toHaveLength(0);
  });

  it("caps notifications per user per run", () => {
    const quotes = new Map([["TCS.NS", { price: 3500, high: 3510, low: 3490, previousClose: 3500 }]]);
    const many = Array.from({ length: 30 }, (_, i) => alert({ id: `a${i}` }));
    const other = alert({ id: "b", user_id: "u2" });
    const due = dueAlerts([...many, other], quotes, 20);
    expect(due.filter((a) => a.user_id === "u1")).toHaveLength(20);
    expect(due.some((a) => a.user_id === "u2")).toBe(true);
  });

  it("maps exchanges to the market whose close triggers the run", () => {
    expect(marketOf("NSE")).toBe("india");
    expect(marketOf("BSE")).toBe("india");
    expect(marketOf("NASDAQ")).toBe("us");
    expect(marketOf("NYSE")).toBe("us");
  });
});
