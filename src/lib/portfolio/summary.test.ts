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
  it("does not let another holding hide an unavailable per-position comparison baseline", () => {
    const summary = summarisePortfolio(
      [holding({ ticker: "BAD", exchange: "NSE", quantity: 1 }), holding({ ticker: "GOOD", exchange: "NSE", quantity: 1 })],
      new Map([["BAD", { price: 100, change: 100, changeAvailable: true }],
        ["GOOD", { price: 100, change: 0, changeAvailable: true }]]),
      null, "INR"
    );
    expect(summary.current).toBe(200);
    expect(summary.excluded).toEqual([]);
    expect(summary.rows[0].dayChangePercent).toBeNull();
    expect(summary.dayChangeAvailable).toBe(false);
    expect(summary.rows.every((row) => row.weight === .5)).toBe(true);
  });

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
    expect(summary.dayChangeAvailable).toBe(true);
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

  it.each([null, 0, -1, NaN, Infinity, -Infinity])("excludes foreign values when USD/INR is unusable (%s)", (rate) => {
    const summary = summarisePortfolio(
      [holding({ ticker: "LOCAL", exchange: "NSE" }), holding({ ticker: "FOREIGN", exchange: "NASDAQ" })],
      new Map([["LOCAL", { price: 110, change: 1 }], ["FOREIGN", { price: 120, change: 2 }]]),
      rate,
      "INR"
    );
    expect(summary.usdInr).toBeNull();
    expect(summary.current).toBe(1100);
    expect(summary.pnl).toBe(100);
    expect(summary.excluded).toEqual([{ ticker: "FOREIGN", reason: "no-fx-rate" }]);
    expect(summary.rows[1].currentValue).toBe(1200);
    expect(summary.rows[1].weight).toBeNull();
    expect(summary.rows[0].weight).toBe(1);
  });

  it.each([
    { quantity: 0 }, { quantity: -1 }, { quantity: NaN }, { quantity: Infinity },
    { avg_buy_price: -1 }, { avg_buy_price: NaN }, { avg_buy_price: Infinity },
    { quantity: 1e308, avg_buy_price: 100 },
  ])("excludes invalid holding inputs without fabricated financial values (%j)", (invalid) => {
    const summary = summarisePortfolio(
      [holding({ ticker: "INVALID", exchange: "NSE", ...invalid }), holding({ ticker: "VALID", exchange: "NSE" })],
      new Map([["INVALID", { price: 110, change: 1 }], ["VALID", { price: 120, change: 2 }]]),
      null,
      "INR"
    );
    expect(summary.excluded).toEqual([{ ticker: "INVALID", reason: "invalid-holding" }]);
    expect(summary.rows[0]).toMatchObject({ investedValue: null, currentValue: null, pnl: null, pnlPercent: null, dayChange: null, weight: null });
    expect(summary.invested).toBe(1000);
    expect(summary.current).toBe(1200);
    expect(summary.pnl).toBe(200);
    expect(summary.rows[1].weight).toBe(1);
    expect(summary.dayChangeAvailable).toBe(true);
  });

  it("excludes an overflowing marked value while keeping a known finite cost basis", () => {
    const summary = summarisePortfolio(
      [holding({ ticker: "OVERFLOW", exchange: "NSE", quantity: 1e308, avg_buy_price: 1 })],
      new Map([["OVERFLOW", { price: 100, change: 1 }]]),
      null,
      "INR"
    );
    expect(summary.excluded).toEqual([{ ticker: "OVERFLOW", reason: "invalid-value" }]);
    expect(summary.rows[0].investedValue).toBe(1e308);
    expect(summary.rows[0].currentValue).toBeNull();
    expect(summary.rows[0].pnl).toBeNull();
    expect(summary.rows[0].weight).toBeNull();
    expect(summary.current).toBe(0);
    expect(summary.pnlPercent).toBeNull();
    expect(summary.dayChangeAvailable).toBe(false);
  });

  it.each([
    { base: "INR" as const, exchange: "NASDAQ", rate: 1e308 },
    { base: "USD" as const, exchange: "NSE", rate: 1e-308 },
  ])("excludes conversion overflow in either direction ($base)", ({ base, exchange, rate }) => {
    const summary = summarisePortfolio(
      [holding({ ticker: "OVERFLOW", exchange })],
      new Map([["OVERFLOW", { price: 120, change: 2 }]]),
      rate,
      base
    );
    expect(summary.excluded).toEqual([{ ticker: "OVERFLOW", reason: "invalid-value" }]);
    expect(summary.rows[0].currentValue).toBe(1200);
    expect(summary.rows[0].pnl).toBe(200);
    expect(summary.rows[0].weight).toBeNull();
    expect(summary.invested).toBe(0);
    expect(summary.current).toBe(0);
    expect(summary.sectors).toEqual([]);
  });

  it("keeps aggregates finite when adding individually finite values would overflow", () => {
    const summary = summarisePortfolio(
      [holding({ ticker: "A", exchange: "NSE", quantity: 1, avg_buy_price: 1e308 }),
        holding({ ticker: "B", exchange: "NSE", quantity: 1, avg_buy_price: 1e308 })],
      new Map([["A", { price: 1e308, change: 0 }], ["B", { price: 1e308, change: 0 }]]),
      null,
      "INR"
    );
    expect(summary.excluded).toEqual([{ ticker: "B", reason: "invalid-value" }]);
    expect(summary.invested).toBe(1e308);
    expect(summary.current).toBe(1e308);
    expect(summary.rows.map((row) => row.weight)).toEqual([1, null]);
    expect(summary.sectors[0].weight).toBe(1);
  });

  it.each([
    { change: 0, changeAvailable: false },
    { change: NaN, changeAvailable: true },
    { change: Infinity, changeAvailable: true },
  ])("values a holding without substituting zero for an unknown quote movement (%j)", (movement) => {
    const summary = summarisePortfolio(
      [holding({ ticker: "UNKNOWN", exchange: "NSE" }), holding({ ticker: "KNOWN", exchange: "NSE" })],
      new Map([["UNKNOWN", { price: 120, ...movement }], ["KNOWN", { price: 110, change: 1, changeAvailable: true }]]),
      null,
      "INR"
    );
    expect(summary.excluded).toEqual([]);
    expect(summary.current).toBe(2300);
    expect(summary.pnl).toBe(300);
    expect(summary.rows[0].dayChange).toBeNull();
    expect(summary.rows[0].dayChangePercent).toBeNull();
    expect(summary.rows[0].weight).toBeCloseTo(1200 / 2300);
    expect(summary.dayChangeAvailable).toBe(false);
    expect(summary.dayChange).toBe(10);
  });

  it("keeps an observed zero change available and allows finite legacy movement", () => {
    const summary = summarisePortfolio(
      [holding({ ticker: "FLAT", exchange: "NSE" }), holding({ ticker: "LEGACY", exchange: "NSE" })],
      new Map([["FLAT", { price: 100, change: 0, changeAvailable: true }], ["LEGACY", { price: 100, change: 1 }]]),
      null,
      "INR"
    );
    expect(summary.rows[0].dayChange).toBe(0);
    expect(summary.rows[0].dayChangePercent).toBe(0);
    expect(summary.rows[1].dayChange).toBe(10);
    expect(summary.dayChangeAvailable).toBe(true);
    expect(summary.dayChangePercent).toBeCloseTo((10 / 1990) * 100);
  });

  it("does not drop valuation when multiplication makes quote movement unrepresentable", () => {
    const summary = summarisePortfolio(
      [holding({ ticker: "OVERFLOW", exchange: "NSE", quantity: 10, avg_buy_price: 1 })],
      new Map([["OVERFLOW", { price: 2, change: 1e308, changeAvailable: true }]]),
      null,
      "INR"
    );
    expect(summary.current).toBe(20);
    expect(summary.rows[0].weight).toBe(1);
    expect(summary.rows[0].dayChange).toBeNull();
    expect(summary.dayChangeAvailable).toBe(false);
  });

  it("does not claim a day percentage when the implied previous value is unusable", () => {
    const summary = summarisePortfolio(
      [holding({ ticker: "BAD_BASELINE", exchange: "NSE" })],
      new Map([["BAD_BASELINE", { price: 100, change: 100, changeAvailable: true }]]),
      null,
      "INR"
    );
    expect(summary.rows[0].dayChange).toBe(1000);
    expect(summary.rows[0].dayChangePercent).toBeNull();
    expect(summary.dayChangeAvailable).toBe(false);
  });

  it("retains a valid zero cost basis while leaving percentage profit unavailable", () => {
    const summary = summarisePortfolio(
      [holding({ ticker: "ZERO_COST", exchange: "NSE", avg_buy_price: 0 })],
      new Map([["ZERO_COST", { price: 100, change: 0 }]]),
      null,
      "INR"
    );
    expect(summary.excluded).toEqual([]);
    expect(summary.invested).toBe(0);
    expect(summary.pnl).toBe(1000);
    expect(summary.pnlPercent).toBeNull();
    expect(summary.rows[0].pnlPercent).toBeNull();
    expect(summary.rows[0].weight).toBe(1);
  });

  it("has no observed day change or percentage return for an empty book", () => {
    const summary = summarisePortfolio([], new Map(), null, "INR");
    expect(summary.dayChangeAvailable).toBe(false);
    expect(summary.pnlPercent).toBeNull();
    expect(summary.largestPosition).toBeNull();
  });
});
