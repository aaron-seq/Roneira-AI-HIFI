import { describe, expect, it } from "vitest";
import { summarisePortfolio, type HoldingInput } from "./summary";

const holding = (over: Partial<HoldingInput> & Pick<HoldingInput, "ticker" | "exchange">): HoldingInput => ({
  id: over.ticker,
  quantity: 10,
  avg_buy_price: 100,
  sector: "Technology",
  ...over,
});

describe("summarisePortfolio", () => {
  it("converts USD holdings into an INR base instead of adding rupees to dollars", () => {
    const summary = summarisePortfolio(
      [
        holding({ ticker: "TCS.NS", exchange: "NSE", quantity: 10, avg_buy_price: 3000 }),
        holding({ ticker: "AAPL", exchange: "NASDAQ", quantity: 10, avg_buy_price: 150 }),
      ],
      new Map([
        ["TCS.NS", { price: 3300, change: 30 }],
        ["AAPL", { price: 200, change: -2 }],
      ]),
      80,
      "INR"
    );

    expect(summary.invested).toBe(30_000 + 1_500 * 80);
    expect(summary.current).toBe(33_000 + 2_000 * 80);
    // Day change is quantity x the quote's own change, converted -- not a
    // fraction of total P&L.
    expect(summary.dayChange).toBe(10 * 30 + 10 * -2 * 80);
    expect(summary.excluded).toEqual([]);
  });

  it("leaves an unquoted holding out of the totals and says so", () => {
    const summary = summarisePortfolio(
      [
        holding({ ticker: "INFY.NS", exchange: "NSE" }),
        holding({ ticker: "WIPRO.NS", exchange: "NSE", avg_buy_price: 500 }),
      ],
      new Map([["INFY.NS", { price: 110, change: 1 }]]),
      null,
      "INR"
    );

    const wipro = summary.rows.find((r) => r.holding.ticker === "WIPRO.NS")!;
    expect(wipro.price).toBeNull();
    expect(wipro.pnl).toBeNull();
    expect(summary.invested).toBe(1_000);
    expect(summary.excluded).toEqual([{ ticker: "WIPRO.NS", reason: "no-quote" }]);
  });

  it("excludes the foreign-currency side rather than guessing when there is no FX rate", () => {
    const summary = summarisePortfolio(
      [holding({ ticker: "TCS.NS", exchange: "NSE" }), holding({ ticker: "AAPL", exchange: "NASDAQ" })],
      new Map([
        ["TCS.NS", { price: 120, change: 0 }],
        ["AAPL", { price: 120, change: 0 }],
      ]),
      null,
      "INR"
    );
    expect(summary.current).toBe(1_200);
    expect(summary.excluded).toEqual([{ ticker: "AAPL", reason: "no-fx-rate" }]);
    // AAPL still shows its own native-currency P&L in its row.
    expect(summary.rows[1].pnl).toBe(200);
    expect(summary.rows[1].weight).toBeNull();
  });

  it("reports concentration as the largest position and sector weights", () => {
    const summary = summarisePortfolio(
      [
        holding({ ticker: "A", exchange: "NSE", quantity: 30, sector: "Banking" }),
        holding({ ticker: "B", exchange: "NSE", quantity: 10, sector: "Technology" }),
      ],
      new Map([
        ["A", { price: 100, change: 0 }],
        ["B", { price: 100, change: 0 }],
      ]),
      null,
      "INR"
    );
    expect(summary.largestPosition).toEqual({ ticker: "A", weight: 0.75 });
    expect(summary.sectors[0]).toMatchObject({ sector: "Banking", weight: 0.75 });
  });
});
