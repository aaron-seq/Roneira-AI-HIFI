// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MarketQuote } from "@/lib/market/types";
import MarketOverviewPage from "./page";

const mock = vi.hoisted(() => ({ market: vi.fn(), history: vi.fn(), refetch: vi.fn() }));
vi.mock("@/lib/hooks/use-live-market", () => ({ useMarketOverviewData: mock.market, useQuoteHistory: mock.history }));

function quote(symbol: string, name: string, overrides: Partial<MarketQuote> = {}): MarketQuote {
  return {
    symbol, name, exchange: "NSE", currency: "INR", assetType: "index", price: 100,
    change: 1, changePercent: 1, changeAvailable: true, changePercentAvailable: true,
    provider: "yfinance", timestamp: "2026-10-12T10:00:00Z", sessionDate: "2026-10-12", sessionTimezone: "Asia/Kolkata",
    ...overrides,
  };
}
function result(quotes: MarketQuote[] = []) {
  return {
    data: { data: quotes, sections: { india: quotes.filter((q) => q.assetType === "index"), us: [], europe: [], special: quotes.filter((q) => q.assetType === "volatility") },
      movers: { gainers: [] as MarketQuote[], losers: [] as MarketQuote[] }, timestamp: "2026-10-13T10:00:00Z" },
    isPending: false, isError: false, isFetching: false, refetch: mock.refetch,
  };
}
function card(name: string) {
  return within(screen.getByText(name).closest(".card") as HTMLElement);
}

beforeEach(() => {
  vi.resetAllMocks();
  mock.market.mockReturnValue(result());
  mock.history.mockReturnValue({ data: { candles: [] }, isPending: false });
});
afterEach(cleanup);

describe("market stories and quote availability", () => {
  it("integrates actual tracked index movement without treating zero, unknown, or volatility as gains", () => {
    mock.market.mockReturnValue(result([
      quote("^NSEI", "NIFTY 50"),
      quote("^NSEBANK", "NIFTY Bank", { change: 0, changePercent: 0 }),
      quote("^BSESN", "SENSEX", { change: 0, changePercent: 0, changeAvailable: false, changePercentAvailable: false }),
      quote("^INDIAVIX", "India VIX", { assetType: "volatility", changePercent: 20 }),
    ]));
    render(<MarketOverviewPage />);
    const insights = screen.getByRole("region", { name: "Market insights" });
    expect(insights.textContent).toContain("3 of 12 tracked regional indices have a usable price");
    expect(insights.textContent).toContain("1 higher, 0 lower, and 1 unchanged");
    expect(insights.textContent).toContain("2 of 4 tracked indices");
    expect(screen.queryByText(/tracked instruments higher today/)).toBeNull();
    expect(card("SENSEX").getByText("Change unavailable")).toBeTruthy();
    expect(card("SENSEX").queryByText("+0.00%")).toBeNull();
    expect(card("NIFTY Bank").getByText("+0.00%").getAttribute("style")).toContain("var(--color-text-muted)");
    expect(within(insights).getByText("Sources and calculations").tagName).toBe("SUMMARY");
    expect(insights.textContent).toContain("2026-10-12");
  });

  it("preserves legacy numeric cards while explaining that story comparisons need availability metadata", () => {
    mock.market.mockReturnValue(result([quote("^BSESN", "SENSEX", { changeAvailable: undefined, changePercentAvailable: undefined })]));
    render(<MarketOverviewPage />);
    expect(card("SENSEX").getByText("+1.00%")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Market insights" }).textContent).toContain("Previous-close comparisons are unavailable for all 4 tracked indices");
  });

  it("announces loading before presenting any derived movement counts", () => {
    mock.market.mockReturnValue({ ...result(), data: undefined, isPending: true, isLoading: false });
    render(<MarketOverviewPage />);
    const insights = screen.getByRole("region", { name: "Market insights" });
    expect(insights.getAttribute("aria-busy")).toBe("true");
    expect(within(insights).getByRole("status").textContent).toContain("Loading insights");
    expect(screen.queryByText("Tracked index coverage")).toBeNull();
  });

  it("offers retry after a provider failure and retains previous quotes during refresh failure", () => {
    mock.market.mockReturnValue({ ...result([quote("^NSEI", "NIFTY 50")]), isError: true });
    const { rerender } = render(<MarketOverviewPage />);
    expect(screen.getByRole("alert").textContent).toContain("could not be refreshed");
    expect(card("NIFTY 50").getByText("100.00")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry insights" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
    mock.market.mockReturnValue({ ...result(), data: undefined, isError: true, isFetching: true });
    rerender(<MarketOverviewPage />);
    expect((screen.getByRole("button", { name: "Retrying insights..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("describes an empty snapshot as missing coverage and leaves the absent hero quote unavailable", () => {
    render(<MarketOverviewPage />);
    expect(screen.getByRole("region", { name: "Market insights" }).textContent).toContain("0 of 12 tracked regional indices");
    expect(screen.getByText("Quote unavailable")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("No gainers are reported in the tracked stock snapshot.")).toBeTruthy();
  });

  it("labels the selected history range and handles an unknown mover without a false zero change", () => {
    const unknown = quote("TCS.NS", "Tata Consultancy Services", { assetType: "equity", change: 0, changePercent: 0, changeAvailable: false, changePercentAvailable: false });
    const value = result([quote("^NSEI", "NIFTY 50")]);
    value.data.movers.gainers = [unknown];
    mock.market.mockReturnValue(value);
    render(<MarketOverviewPage />);
    const range = screen.getByRole("button", { name: "NIFTY 50 history: 3 months" });
    fireEvent.click(range);
    expect(range.getAttribute("aria-pressed")).toBe("true");
    expect(mock.history).toHaveBeenLastCalledWith("^NSEI", "1day", "3month");
    expect(screen.getByText("Change unavailable")).toBeTruthy();
    expect(screen.queryByText("+0.00%")).toBeNull();
  });
});
