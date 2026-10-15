// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { summarisePortfolio, type Currency } from "@/lib/portfolio/summary";
import type { MarketQuote } from "@/lib/market/types";
import { formatCurrency } from "@/lib/utils";
import PortfolioPage from "./page";

const mock = vi.hoisted(() => ({ portfolio: vi.fn(), refetch: vi.fn(), refetchQuotes: vi.fn(), upsert: vi.fn(), remove: vi.fn() }));
vi.mock("@/lib/hooks/use-portfolio", () => ({ usePortfolio: mock.portfolio }));
vi.mock("@/lib/hooks/use-prediction", () => ({ useStockSearch: () => ({ data: { results: [] }, isLoading: false, isError: false }) }));

const india = { id: "india", ticker: "TCS.NS", company_name: "Tata Consultancy Services", exchange: "NSE", quantity: 2, avg_buy_price: 100, buy_date: null, sector: "Technology" };
const us = { id: "us", ticker: "AAPL", company_name: "Apple", exchange: "NASDAQ", quantity: 1, avg_buy_price: 80, buy_date: null, sector: "Technology" };
function quote(symbol: string, overrides: Partial<MarketQuote> = {}): MarketQuote {
  return {
    symbol, name: symbol, exchange: "NSE", currency: "INR", assetType: "equity", price: 110,
    change: 1, changePercent: 1, changeAvailable: true, changePercentAvailable: true,
    provider: "yfinance", timestamp: "2026-10-12T10:00:00Z", sessionDate: "2026-10-12", sessionTimezone: "Asia/Kolkata",
    ...overrides,
  };
}
function result(holdings = [india], quotes: MarketQuote[] = [quote("TCS.NS")], rate: number | null = 80, base: Currency = "INR") {
  return {
    summary: summarisePortfolio(holdings, new Map(quotes.map((q) => [q.symbol, q])), rate, base), quotes,
    isLoading: false, isError: false, isFetching: false, refetch: mock.refetch,
    quotesLoading: false, quotesFetching: false, quotesError: null as Error | null, refetchQuotes: mock.refetchQuotes,
    upsertMutation: { mutateAsync: mock.upsert }, removeMutation: { mutateAsync: mock.remove, isPending: false },
  };
}
function card(name: string) {
  return within(screen.getByText(name).closest(".card") as HTMLElement);
}

beforeEach(() => { vi.resetAllMocks(); mock.portfolio.mockReturnValue(result()); });
afterEach(cleanup);

describe("portfolio stories and valuation states", () => {
  it("shows partial coverage and explains allocation denominators while keeping unquoted holdings editable", () => {
    mock.portfolio.mockReturnValue(result([india, us], [quote("TCS.NS")], null));
    render(<PortfolioPage />);
    const insights = screen.getByRole("region", { name: "Portfolio insights" });
    expect(insights.textContent).toContain("1 of 2 holdings are included in the INR valuation");
    expect(insights.textContent).toContain("₹220.00");
    expect(insights.textContent).toContain("priced, convertible book");
    expect(screen.getByRole("button", { name: "Edit AAPL" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("AAPL (no usable quote)");
    expect(card("Concentration").getByText("100.0%")).toBeTruthy();
    expect(screen.getByText("Weights use marked values in the priced, convertible book.")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Portfolio holdings, scroll horizontally for all columns" }).tabIndex).toBe(0);
  });

  it("shows dashes for a nonempty book with no usable prices instead of reporting a zero valuation", () => {
    mock.portfolio.mockReturnValue(result([india], []));
    render(<PortfolioPage />);
    expect(card("Total Value").getByText("—")).toBeTruthy();
    expect(card("Total Value").queryByText(formatCurrency(0, "INR", { compact: true }))).toBeNull();
    expect(card("Total P&L").getAllByText("—")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Portfolio insights" }).textContent).toContain("Valuation unavailable");
    expect(screen.getByRole("button", { name: "Edit TCS.NS" })).toBeTruthy();
  });

  it("announces quote loading without exposing an initial zero valuation", () => {
    mock.portfolio.mockReturnValue({ ...result([india], []), isLoading: true, quotesLoading: true });
    render(<PortfolioPage />);
    const insights = screen.getByRole("region", { name: "Portfolio insights" });
    expect(insights.getAttribute("aria-busy")).toBe("true");
    expect(within(insights).getByRole("status").textContent).toContain("Loading insights");
    expect(screen.getByRole("status", { name: "Loading portfolio" })).toBeTruthy();
    expect(screen.queryByText("Total Value")).toBeNull();
  });

  it("exposes a quote-specific retry after failure and preserves holdings separately from holdings errors", () => {
    mock.portfolio.mockReturnValue({ ...result([india], []), quotesError: new Error("Provider failed") });
    const { rerender } = render(<PortfolioPage />);
    expect(screen.getByRole("alert").textContent).toContain("Holding prices could not be refreshed");
    expect(screen.getByRole("button", { name: "Edit TCS.NS" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry insights" }));
    expect(mock.refetchQuotes).toHaveBeenCalledOnce();
    expect(mock.refetch).not.toHaveBeenCalled();
    mock.portfolio.mockReturnValue({ ...result([india], []), quotesError: new Error("Provider failed"), quotesFetching: true });
    rerender(<PortfolioPage />);
    expect((screen.getByRole("button", { name: "Retrying insights..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("keeps holdings-load recovery separate from quote recovery", () => {
    mock.portfolio.mockReturnValue({ ...result(), isError: true });
    render(<PortfolioPage />);
    expect(screen.queryByRole("region", { name: "Portfolio insights" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry portfolio" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
    expect(mock.refetchQuotes).not.toHaveBeenCalled();
  });

  it("uses legitimate zero valuation for an empty book and explains how to begin", () => {
    mock.portfolio.mockReturnValue(result([], []));
    render(<PortfolioPage />);
    expect(card("Total Value").getByText(formatCurrency(0, "INR", { compact: true }))).toBeTruthy();
    expect(screen.getByRole("region", { name: "Portfolio insights" }).textContent).toContain("No holdings yet");
    expect(screen.getByRole("button", { name: "Add Holding" })).toBeTruthy();
  });

  it("preserves native currency rows and explains missing conversion and currency changes", () => {
    const quotes = [quote("TCS.NS"), quote("AAPL", { currency: "USD", price: 100 })];
    mock.portfolio.mockReturnValue(result([india, us], quotes, null));
    const { rerender } = render(<PortfolioPage />);
    expect(screen.getByRole("status").textContent).toContain("AAPL (no usable USD/INR rate)");
    expect(screen.getByRole("table", { name: "Portfolio holdings" }).textContent).toContain("$100.00");
    mock.portfolio.mockReturnValue(result([india, us], quotes, 80, "USD"));
    rerender(<PortfolioPage />);
    const insights = screen.getByRole("region", { name: "Portfolio insights" });
    expect(insights.textContent).toContain("2 of 2 holdings are included in the USD valuation");
    expect(insights.textContent).toContain("$102.75");
    expect(insights.textContent).toContain("cost basis use the same supplied current rate of ₹80.00 per USD");
    expect(screen.getByText(/USD\/INR: ₹80\.00 per USD/)).toBeTruthy();
  });

  it("labels quote session changes and distinguishes an unknown comparison from a flat observed change", () => {
    mock.portfolio.mockReturnValue(result([india], [quote("TCS.NS", { change: 0, changeAvailable: false })]));
    const { rerender } = render(<PortfolioPage />);
    expect(card("Quoted Session Change").getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("Today's Change")).toBeNull();
    mock.portfolio.mockReturnValue(result([india], [quote("TCS.NS", { change: 0, changePercent: 0 })]));
    rerender(<PortfolioPage />);
    expect(card("Quoted Session Change").getByText("+0.00%")).toBeTruthy();
    expect(screen.getByText("Provider previous closes; sessions may differ")).toBeTruthy();
  });

  it("leaves a zero-cost percentage unavailable and explains invalid holding exclusions", () => {
    mock.portfolio.mockReturnValue(result([{ ...india, avg_buy_price: 0 }]));
    const { rerender } = render(<PortfolioPage />);
    expect(card("Total P&L").getByText("—")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Portfolio insights" }).textContent).toContain("percentage return is unavailable");
    mock.portfolio.mockReturnValue(result([{ ...india, avg_buy_price: Number.NaN }]));
    rerender(<PortfolioPage />);
    expect(screen.getByRole("status").textContent).toContain("invalid holding quantity or cost");
    expect(document.body.textContent).not.toContain("NaN");
  });
});
