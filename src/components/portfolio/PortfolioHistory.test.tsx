// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { PortfolioHistory as History, PortfolioSnapshot } from "@/lib/portfolio/history";
import { DEFAULT_USER_PREFERENCES, useAppStore } from "@/lib/stores/app-store";
import { PortfolioHistory, portfolioHistoryChartData } from "./PortfolioHistory";

const mock = vi.hoisted(() => ({ history: vi.fn(), save: vi.fn(), refetch: vi.fn() }));
vi.mock("@/lib/hooks/use-portfolio-history", () => ({ usePortfolioHistory: mock.history }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: ReactNode }) => <div data-testid="history-chart">{children}</div>,
  CartesianGrid: () => null, XAxis: () => null, YAxis: () => null, Line: () => null,
}));

function snapshot(overrides: Partial<PortfolioSnapshot> = {}): PortfolioSnapshot {
  return { id: "first", valuedOn: "2026-10-18", capturedAt: "2026-10-18T12:30:00.000Z", holdingsObservedAt: "2026-10-18T12:29:00.000Z", currency: "INR",
    currentValue: 1200, investedValue: 1000, pnl: 200, pnlPercent: 20, totalHoldings: 2, pricedHoldings: 2,
    coverageComplete: true, usdInr: 84, exclusions: [],
    quoteSources: [{ symbol: "TCS.NS", provider: "yfinance", timestamp: null, sessionDate: "2026-10-16", sessionTimezone: "Asia/Kolkata", usedFor: "holding" }],
    ...overrides };
}
function result(snapshots: PortfolioSnapshot[] = []) {
  return { data: { currency: "INR", days: 90, snapshots, methodology: ["Source sessions may precede capture time."] } as History,
    isSignedIn: true, isPending: false, isFetching: false, isError: false, refetch: mock.refetch,
    capture: { mutate: mock.save, isPending: false, isError: false, isSuccess: false, error: null as Error | null } };
}

beforeEach(() => {
  vi.resetAllMocks(); mock.history.mockReturnValue(result());
  useAppStore.getState().setUser({ id: "account-a", username: "fixture", full_name: "Fixture", email: "fixture@example.test",
    role: "user", avatar_url: null, preferences: DEFAULT_USER_PREFERENCES });
});
afterEach(() => { cleanup(); useAppStore.getState().setUser(null); });

describe("portfolio history for ordinary investors", () => {
  it("explains that history begins with real captures and value changes are not investment returns", () => {
    render(<PortfolioHistory defaultCurrency="INR" />);
    const region = screen.getByRole("region", { name: "Portfolio history" });
    expect(region.textContent).toContain("No saved history in INR yet");
    expect(region.textContent).toContain("We do not backfill past values");
    expect(region.textContent).toContain("they are not investment returns");
    expect(region.textContent).toContain("excludes realized gains, cash flows, fees, dividends and historical FX effects");
    expect(screen.queryByTestId("history-chart")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save latest snapshot" }));
    expect(mock.save).toHaveBeenCalledOnce();
  });

  it("renders exact currency figures, P&L, coverage and the original source sessions separately from capture time", () => {
    mock.history.mockReturnValue(result([snapshot()]));
    render(<PortfolioHistory defaultCurrency="INR" />);
    const table = screen.getByRole("table", { name: "Saved portfolio values in INR" });
    expect(within(table).getByText("₹1,200.00")).toBeTruthy();
    expect(within(table).getByText("₹1,000.00")).toBeTruthy();
    expect(within(table).getByText("₹200.00")).toBeTruthy();
    expect(within(table).getByText("+20.00%")).toBeTruthy();
    expect(table.textContent).toContain("2/2 · Complete");
    expect(table.textContent).toContain("2026-10-18T12:30:00.000Z");
    expect(table.textContent).toContain("Holdings observed at 2026-10-18T12:29:00.000Z");
    expect(table.textContent).toContain("exchange session 2026-10-16 (Asia/Kolkata)");
    expect(table.textContent).toContain("source time unavailable");
    expect(screen.getByTestId("history-chart")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Saved portfolio values, scroll horizontally for all columns" }).tabIndex).toBe(0);
  });

  it("keeps partial values and exclusions in the table without plotting them as a complete portfolio", () => {
    mock.history.mockReturnValue(result([snapshot({ coverageComplete: false, pricedHoldings: 1,
      exclusions: [{ ticker: "AAPL", reason: "no-fx-rate" }] })]));
    render(<PortfolioHistory defaultCurrency="INR" />);
    expect(screen.getByRole("region", { name: "Portfolio history" }).textContent).toContain("1 of 2 holdings were included; totals cover that priced subset");
    const table = screen.getByRole("table");
    expect(table.textContent).toContain("1/2 · Partial");
    expect(table.textContent).toContain("AAPL (conversion unavailable)");
    expect(within(table).getByText("₹1,200.00")).toBeTruthy();
    expect(screen.queryByTestId("history-chart")).toBeNull();
    expect(screen.getByText(/No complete valuation to chart yet/)).toBeTruthy();
  });

  it("distinguishes an unpriced book from an observed empty book and a zero cost basis", () => {
    mock.history.mockReturnValue(result([snapshot({ coverageComplete: false, pricedHoldings: 0, currentValue: null, investedValue: null, pnl: null, pnlPercent: null })]));
    const { rerender } = render(<PortfolioHistory defaultCurrency="INR" />);
    expect(within(screen.getByRole("table")).getAllByText("—")).toHaveLength(4);
    expect(screen.queryByTestId("history-chart")).toBeNull();
    mock.history.mockReturnValue(result([snapshot({ totalHoldings: 0, pricedHoldings: 0, currentValue: 0, investedValue: 0, pnl: 0, pnlPercent: null, quoteSources: [], usdInr: null })]));
    rerender(<PortfolioHistory defaultCurrency="INR" />);
    expect(within(screen.getByRole("table")).getAllByText("₹0.00")).toHaveLength(3);
    expect(within(screen.getByRole("table")).getByText("—")).toBeTruthy();
    expect(screen.getByRole("table").textContent).toContain("0/0 · Complete");
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/);
  });

  it("shows a loading state without reporting zero history and disables capture until the first read finishes", () => {
    mock.history.mockReturnValue({ ...result(), data: undefined, isPending: true, isFetching: true });
    render(<PortfolioHistory defaultCurrency="INR" />);
    expect(screen.getByRole("status").textContent).toContain("Loading portfolio history");
    expect((screen.getByRole("button", { name: "Save latest snapshot" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText(/No saved history/)).toBeNull();
  });

  it("keeps current holdings independent of a history failure and exposes a native retry button", () => {
    mock.history.mockReturnValue({ ...result(), isError: true });
    const { rerender } = render(<PortfolioHistory defaultCurrency="INR" />);
    expect(screen.getByRole("alert").textContent).toContain("Your current holdings are still available");
    fireEvent.click(screen.getByRole("button", { name: "Retry history" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
    mock.history.mockReturnValue({ ...result([snapshot()]), isError: true, isFetching: true });
    rerender(<PortfolioHistory defaultCurrency="INR" />);
    expect(screen.getByRole("table")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("The captures below have not changed");
    expect((screen.getByRole("button", { name: "Retrying history..." }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("exposes save progress and failure without changing already recorded values", () => {
    const ready = result([snapshot()]);
    mock.history.mockReturnValue({ ...ready, capture: { ...ready.capture, isPending: true } });
    const { rerender } = render(<PortfolioHistory defaultCurrency="INR" />);
    expect((screen.getByRole("button", { name: "Saving snapshot..." }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toContain("server-valued snapshot");
    mock.history.mockReturnValue({ ...ready, capture: { ...ready.capture, isError: true, error: new Error("Holdings changed. Save again.") } });
    rerender(<PortfolioHistory defaultCurrency="INR" />);
    expect(screen.getByRole("alert").textContent).toContain("Holdings changed. Save again.");
    expect(screen.getByRole("alert").textContent).toContain("Could not confirm this save");
    expect(screen.getByRole("alert").textContent).toContain("Refresh history to check the latest saved capture before trying again");
    fireEvent.click(screen.getByRole("button", { name: "Refresh saved history" }));
    expect(mock.refetch).toHaveBeenCalledOnce();
    expect(within(screen.getByRole("table")).getByText("₹1,200.00")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Save latest snapshot" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("switches native currency controls to an independent history series", () => {
    mock.history.mockImplementation((currency: "INR" | "USD") => ({ ...result([snapshot({ currency })]), data: { ...result().data, currency, snapshots: [snapshot({ currency })] } }));
    render(<PortfolioHistory defaultCurrency="INR" />);
    fireEvent.change(screen.getByRole("combobox", { name: "History currency" }), { target: { value: "USD" } });
    expect(mock.history).toHaveBeenLastCalledWith("USD");
    expect(screen.getByRole("table", { name: "Saved portfolio values in USD" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Saved portfolio values in INR" })).toBeNull();
    expect(screen.getByText("$1,200.00")).toBeTruthy();
  });

  it("resets local currency selection when a different account opens the page", () => {
    render(<PortfolioHistory defaultCurrency="INR" />);
    fireEvent.change(screen.getByRole("combobox", { name: "History currency" }), { target: { value: "USD" } });
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("USD");
    act(() => useAppStore.getState().setUser({ ...useAppStore.getState().user!, id: "account-b" }));
    expect((screen.getByRole("combobox") as HTMLSelectElement).value).toBe("INR");
    expect(mock.history).toHaveBeenLastCalledWith("INR");
  });

  it("explains sign-in without presenting a private series to a signed-out visitor", () => {
    mock.history.mockReturnValue({ ...result(), isSignedIn: false, isPending: true });
    render(<PortfolioHistory defaultCurrency="INR" />);
    expect(screen.getByText("Sign in to save and view your private portfolio history.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
    expect((screen.getByRole("button", { name: "Save latest snapshot" }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe("capture chart continuity", () => {
  it("leaves gaps for missing dates and partial coverage rather than interpolating a portfolio path", () => {
    const points = portfolioHistoryChartData([
      snapshot(),
      snapshot({ id: "partial", valuedOn: "2026-10-20", coverageComplete: false, pricedHoldings: 1 }),
      snapshot({ id: "complete", valuedOn: "2026-10-21", currentValue: 1300 }),
    ]);
    expect(points).toEqual([
      { date: "2026-10-18", currentValue: 1200, investedValue: 1000 },
      { date: "2026-10-19", currentValue: null, investedValue: null },
      { date: "2026-10-20", currentValue: null, investedValue: null },
      { date: "2026-10-21", currentValue: 1300, investedValue: 1000 },
    ]);
  });

  it("does not create chart history for an empty or unbounded range", () => {
    expect(portfolioHistoryChartData([])).toEqual([]);
    expect(portfolioHistoryChartData([snapshot(), snapshot({ id: "far", valuedOn: "2099-01-01" })])).toEqual([]);
  });
});
