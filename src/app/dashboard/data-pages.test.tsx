// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PortfolioPage from "./portfolio/page";
import WatchlistPage from "./watchlist/page";
import NewsPage from "./news/page";
import { summarisePortfolio } from "@/lib/portfolio/summary";

const mock = vi.hoisted(() => ({
  portfolio: vi.fn(), watchlist: vi.fn(), search: vi.fn(), news: vi.fn(), refetch: vi.fn(),
  upsert: vi.fn(), remove: vi.fn(), add: vi.fn(), alert: vi.fn(), predict: vi.fn(),
}));
vi.mock("@/lib/hooks/use-portfolio", () => ({ usePortfolio: mock.portfolio }));
vi.mock("@/lib/hooks/use-watchlist", () => ({ useWatchlist: mock.watchlist }));
vi.mock("@/lib/hooks/use-prediction", () => ({
  useStockSearch: mock.search,
  usePredictionMutation: () => ({ mutateAsync: mock.predict }),
}));
vi.mock("@/lib/hooks/use-news-feed", () => ({ useNewsFeed: mock.news }));
vi.mock("@/lib/hooks/use-live-market", () => ({
  useQuoteHistory: () => ({ data: { candles: [] }, isLoading: false }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
const stock = { symbol: "TCS.NS", name: "Tata Consultancy Services", exchange: "NSE" };
const article = {
  id: "headline", source: "Example News", title: "Market overview", description: "Today's market activity.",
  url: "https://example.test/news", publishedAt: "2026-10-10T10:00:00Z", sentiment: "positive", relatedTickers: [],
};
const portfolioResult = () => ({
  summary: summarisePortfolio([], new Map(), null, "INR"), isLoading: false, isError: false, isFetching: false,
  refetch: mock.refetch, upsertMutation: { mutateAsync: mock.upsert },
  removeMutation: { mutateAsync: mock.remove, isPending: false },
});
const watchlistResult = () => ({
  rows: [{ id: "holding", ticker: "TCS.NS", name: stock.name, exchange: "NSE", price: 3300, changePercent: 1,
    notes: null, alert_price: null, alert_triggered_at: null, sort_order: 0, added_at: "2026-10-10" }],
  isLoading: false, isError: false, isFetching: false, refetch: mock.refetch,
  addMutation: { mutateAsync: mock.add }, alertMutation: { mutateAsync: mock.alert },
  removeMutation: { mutateAsync: mock.remove, isPending: false },
});

beforeEach(() => {
  vi.resetAllMocks();
  for (const [name, value] of [["showModal", function (this: HTMLDialogElement) { this.setAttribute("open", ""); }],
    ["close", function (this: HTMLDialogElement) { this.removeAttribute("open"); }]] as const) {
    Object.defineProperty(HTMLDialogElement.prototype, name, { configurable: true, value });
  }
  mock.portfolio.mockReturnValue(portfolioResult());
  mock.watchlist.mockReturnValue(watchlistResult());
  mock.search.mockImplementation((query: string) => ({
    data: { results: query.trim() ? [stock] : [] }, isLoading: false, isError: false, refetch: mock.refetch,
  }));
  mock.news.mockImplementation((_market: string, query: string) => ({
    data: { articles: query ? [] : [article] }, isLoading: false, isError: false, isFetching: false, refetch: mock.refetch,
  }));
  mock.upsert.mockResolvedValue(undefined); mock.add.mockResolvedValue(undefined); mock.alert.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of [["showModal", originalShow], ["close", originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

describe("portfolio editor and recovery", () => {
  it("uses a labelled native form and submits valid holding values", async () => {
    render(<PortfolioPage />);
    fireEvent.click(screen.getByRole("button", { name: "Add Holding" }));
    const dialog = screen.getByRole("dialog", { name: "Add Holding" });
    expect(document.activeElement).toBe(within(dialog).getByLabelText("Search for a stock"));
    for (const [label, value] of [["Ticker", " TCS.NS "], ["Company name", " TCS "], ["Quantity", "2.5"], ["Average buy price", "0"]]) {
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
    fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(mock.upsert).toHaveBeenCalledWith(expect.objectContaining({
      ticker: "TCS.NS", company_name: "TCS", quantity: 2.5, avg_buy_price: 0,
    })));
    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });

  it("keeps an invalid zero-quantity holding out of the mutation", () => {
    render(<PortfolioPage />); fireEvent.click(screen.getByRole("button", { name: "Add Holding" }));
    const dialog = screen.getByRole("dialog", { name: "Add Holding" });
    for (const [label, value] of [["Ticker", "TCS.NS"], ["Company name", "TCS"], ["Quantity", "0"], ["Average buy price", "100"]]) {
      fireEvent.change(within(dialog).getByLabelText(label), { target: { value } });
    }
    fireEvent.submit(dialog.querySelector("form")!);
    expect(within(dialog).getByRole("alert").textContent).toContain("quantity above zero");
    expect(mock.upsert).not.toHaveBeenCalled();
  });

  it("offers retry without exposing setup instructions as a user error", () => {
    mock.portfolio.mockReturnValue({ ...portfolioResult(), isError: true });
    render(<PortfolioPage />); fireEvent.click(screen.getByRole("button", { name: "Retry portfolio" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).not.toContain("Supabase");
  });
});

describe("watchlist dialogs and action errors", () => {
  it("labels a missing quote instead of displaying a zero price and flat change", () => {
    const result = watchlistResult();
    mock.watchlist.mockReturnValue({ ...result, rows: [{ ...result.rows[0], price: null, changePercent: null }] });
    render(<WatchlistPage />);
    expect(screen.getByText("Quote unavailable")).toBeTruthy();
    expect(screen.getByLabelText("Change unavailable")).toBeTruthy();
    expect(screen.queryByText("0.00")).toBeNull();
  });
  it("names and focuses stock search and shows failed additions inside its dialog", async () => {
    mock.add.mockRejectedValue(new Error("Could not add this stock."));
    render(<WatchlistPage />); fireEvent.click(screen.getByRole("button", { name: "Add Stock" }));
    const dialog = screen.getByRole("dialog", { name: "Add to Watchlist" });
    const input = within(dialog).getByLabelText("Search stocks for your watchlist");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "TCS" } });
    fireEvent.click(within(dialog).getByRole("button", { name: /TCS.NS/ }));
    await waitFor(() => expect(within(dialog).getByRole("alert").textContent).toContain("Could not add"));
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("validates a positive alert and submits it through the form", async () => {
    render(<WatchlistPage />); fireEvent.click(screen.getByRole("button", { name: "Set price alert for TCS.NS" }));
    const dialog = screen.getByRole("dialog", { name: "Set Price Alert" });
    const input = within(dialog).getByLabelText("Alert price");
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "0" } }); fireEvent.submit(dialog.querySelector("form")!);
    expect(within(dialog).getByRole("alert").textContent).toContain("above zero");
    expect(mock.alert).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "3200.5" } }); fireEvent.submit(dialog.querySelector("form")!);
    await waitFor(() => expect(mock.alert).toHaveBeenCalledWith({ id: "holding", alertPrice: 3200.5 }));
    await waitFor(() => expect(dialog.hasAttribute("open")).toBe(false));
  });

  it("announces stock-search failure and offers retry", () => {
    mock.search.mockReturnValue({ isLoading: false, isError: true, refetch: mock.refetch });
    render(<WatchlistPage />); fireEvent.click(screen.getByRole("button", { name: "Add Stock" }));
    const dialog = screen.getByRole("dialog", { name: "Add to Watchlist" });
    fireEvent.change(within(dialog).getByLabelText("Search stocks for your watchlist"), { target: { value: "TCS" } });
    expect(within(dialog).getByRole("alert").textContent).toContain("Stock search is unavailable");
    fireEvent.click(within(dialog).getByRole("button", { name: "Retry search" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
  });
});

describe("market news result states", () => {
  it("submits searches explicitly and distinguishes no matches from an empty market feed", () => {
    render(<NewsPage />);
    const input = screen.getByLabelText("Search market news");
    fireEvent.change(input, { target: { value: "missing" } });
    expect(screen.getByText("Market overview")).toBeTruthy();
    fireEvent.submit(screen.getByRole("search"));
    expect(screen.getByRole("status").textContent).toContain("No headlines match “missing”");
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect((input as HTMLInputElement).value).toBe("");
    expect(screen.getByText("Market overview")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read more" })).toBeTruthy();
  });

  it("describes a market feed with no articles without claiming a failed request", () => {
    mock.news.mockReturnValue({ data: { articles: [] }, isLoading: false, isError: false, isFetching: false, refetch: mock.refetch });
    render(<NewsPage />);
    expect(screen.getByRole("status").textContent).toContain("No headlines are available for this market");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("offers retry on provider errors", () => {
    mock.news.mockReturnValue({ isLoading: false, isError: true, isFetching: false, refetch: mock.refetch });
    render(<NewsPage />); fireEvent.click(screen.getByRole("button", { name: "Retry news" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert").textContent).toContain("temporarily unavailable");
  });
});
