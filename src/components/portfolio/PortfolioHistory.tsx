"use client";

import { useId, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { usePortfolioHistory } from "@/lib/hooks/use-portfolio-history";
import type { PortfolioSnapshot } from "@/lib/portfolio/history";
import type { Currency } from "@/lib/portfolio/summary";
import { useAppStore } from "@/lib/stores/app-store";
import { formatCurrency, formatPercent } from "@/lib/utils";

const DAY = 86_400_000;
const exclusionLabels = {
  "no-quote": "quote unavailable",
  "no-fx-rate": "conversion unavailable",
  "invalid-holding": "invalid quantity or cost",
  "invalid-value": "invalid calculated value",
  "quote-currency-mismatch": "quote currency does not match holding",
};

// Include unobserved dates so a line never bridges missing or partial captures.
export function portfolioHistoryChartData(snapshots: PortfolioSnapshot[]) {
  if (!snapshots.length) return [];
  const byDate = new Map(snapshots.map((snapshot) => [snapshot.valuedOn, snapshot]));
  const dates = [...byDate.keys()].sort();
  const first = Date.parse(`${dates[0]}T00:00:00Z`);
  const last = Date.parse(`${dates[dates.length - 1]}T00:00:00Z`);
  if (!Number.isFinite(first) || !Number.isFinite(last) || last - first > 365 * DAY) return [];
  const points = [];
  for (let time = first; time <= last; time += DAY) {
    const date = new Date(time).toISOString().slice(0, 10);
    const snapshot = byDate.get(date);
    points.push({
      date,
      currentValue: snapshot?.coverageComplete ? snapshot.currentValue : null,
      investedValue: snapshot?.coverageComplete ? snapshot.investedValue : null,
    });
  }
  return points;
}

function PortfolioHistoryContent({ defaultCurrency }: { defaultCurrency: Currency }) {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const currency = selectedCurrency ?? defaultCurrency;
  const history = usePortfolioHistory(currency);
  const headingId = useId();
  const currencyId = useId();
  const chartId = useId();
  const snapshots = [...(history.data?.snapshots ?? [])].sort((a, b) => a.valuedOn.localeCompare(b.valuedOn));
  const chartData = portfolioHistoryChartData(snapshots);
  const money = (value: number | null) => value !== null && Number.isFinite(value) ? formatCurrency(value, currency) : "—";
  const latest = snapshots.at(-1);

  return (
    <section className="card mb-6 min-w-0 p-5" aria-labelledby={headingId} aria-busy={history.isFetching || history.capture.isPending}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>Portfolio history</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
            Observed value and cost basis over the last 90 days. History begins with saved captures.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={currencyId} className="mb-1 block text-xs" style={{ color: "var(--color-text-muted)" }}>History currency</label>
            <select id={currencyId} value={currency} onChange={(event) => setSelectedCurrency(event.target.value as Currency)}
              className="rounded-lg border px-3 py-2 text-sm" style={{ background: "var(--color-surface)", borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}>
              <option value="INR">INR</option><option value="USD">USD</option>
            </select>
          </div>
          <button type="button" onClick={() => history.capture.mutate()} disabled={!history.isSignedIn || history.capture.isPending || history.isPending}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50" style={{ borderColor: "var(--color-border)", color: "var(--color-text-primary)" }}>
            {history.capture.isPending ? "Saving snapshot..." : "Save latest snapshot"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs" style={{ color: "var(--color-text-muted)" }}>
        A capture is attempted when you first open this portfolio each UTC day. Saving again replaces today&apos;s point in this currency.
        Changes in book value can include edited holdings and currency moves; they are not investment returns.
      </p>

      {!history.isSignedIn ? <p className="mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>Sign in to save and view your private portfolio history.</p>
        : history.isPending ? <p role="status" className="mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading portfolio history...</p>
        : <>
          {history.isError && <div role="alert" className="mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>
            <p>{snapshots.length ? "Saved history could not be refreshed. The captures below have not changed." : "Your saved history could not be loaded. Your current holdings are still available."}</p>
            <button type="button" onClick={() => { void history.refetch(); }} disabled={history.isFetching} className="mt-2 rounded-lg border px-3 py-2 text-sm">
              {history.isFetching ? "Retrying history..." : "Retry history"}
            </button>
          </div>}
          {history.capture.isError && <div role="alert" className="mt-4 text-sm" style={{ color: "var(--color-loss)" }}>
            <p>Could not confirm this save. {history.capture.error instanceof Error ? history.capture.error.message : "The response was unavailable."} Refresh history to check the latest saved capture before trying again.</p>
            <button type="button" onClick={() => { void history.refetch(); }} disabled={history.isFetching} className="mt-2 rounded-lg border px-3 py-2 text-sm">
              {history.isFetching ? "Refreshing saved history..." : "Refresh saved history"}
            </button>
          </div>}
          {history.capture.isPending && <p role="status" className="mt-4 text-sm" style={{ color: "var(--color-text-muted)" }}>Saving a server-valued snapshot of your current holdings...</p>}
          {history.capture.isSuccess && !history.capture.isPending && <p role="status" className="mt-4 text-xs" style={{ color: "var(--color-text-muted)" }}>Today&apos;s snapshot was saved. Refreshing the saved history if needed.</p>}

          {snapshots.length === 0 && !history.isError && <div className="mt-4 rounded-lg border p-4" style={{ borderColor: "var(--color-border)", color: "var(--color-text-muted)" }}>
            <p className="text-sm font-medium">No saved history in {currency} yet</p>
            <p className="mt-1 text-xs">Your first capture starts the record. We do not backfill past values from today&apos;s holdings.</p>
          </div>}

          {latest && <>
            <p className="mt-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
              Latest capture: <time dateTime={latest.capturedAt}>{latest.capturedAt.replace("T", " ").replace(/\.\d{3}Z$/, " UTC").replace(/Z$/, " UTC")}</time>.
              {" "}{latest.coverageComplete ? "All holdings were included." : `${latest.pricedHoldings} of ${latest.totalHoldings} holdings were included; totals cover that priced subset.`}
            </p>
            {chartData.some((point) => point.currentValue !== null) ? <figure className="mt-4">
              <figcaption id={chartId} className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "var(--color-text-muted)" }}>
                <span><span aria-hidden="true" style={{ color: "var(--color-info)" }}>● </span>Recorded market value</span>
                <span><span aria-hidden="true" style={{ color: "var(--color-teal)" }}>● </span>Included cost basis</span>
                <span>Complete captures only · exact figures in the table below</span>
              </figcaption>
              <div className="h-52 w-full min-w-0" aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 8, left: 8 }}>
                    <CartesianGrid vertical={false} stroke="var(--color-border)" />
                    <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} minTickGap={30} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
                    <YAxis width={60} tickFormatter={(value: number) => formatCurrency(value, currency, { compact: true })} tick={{ fill: "var(--color-text-muted)", fontSize: 11 }} />
                    <Line name="Recorded market value" type="linear" dataKey="currentValue" stroke="var(--color-info)" strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                    <Line name="Included cost basis" type="linear" dataKey="investedValue" stroke="var(--color-teal)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </figure> : <p className="mt-4 text-xs" style={{ color: "var(--color-text-muted)" }}>No complete valuation to chart yet. Partial and unavailable captures remain in the table.</p>}

            <details className="mt-4" open>
              <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Saved values and source details ({snapshots.length})</summary>
              <div className="mt-3 overflow-x-auto" role="region" aria-label="Saved portfolio values, scroll horizontally for all columns" tabIndex={0}>
                <table className="w-full text-left text-xs" aria-label={`Saved portfolio values in ${currency}`}>
                  <caption className="mb-2 text-left" style={{ color: "var(--color-text-muted)" }}>One capture per UTC day. Partial totals describe only the priced, convertible subset; a dash means unavailable.</caption>
                  <thead><tr style={{ borderBottom: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
                    <th scope="col" className="p-2">UTC day</th><th scope="col" className="p-2">Recorded market value</th><th scope="col" className="p-2">Included cost basis</th><th scope="col" className="p-2">Unrealized P&amp;L</th><th scope="col" className="p-2">P&amp;L / basis</th><th scope="col" className="p-2">Coverage</th><th scope="col" className="p-2">Sources</th>
                  </tr></thead>
                  <tbody>{[...snapshots].reverse().map((snapshot) => <tr key={snapshot.id} style={{ borderBottom: "1px solid var(--color-divider)", color: "var(--color-text-primary)" }}>
                    <th scope="row" className="whitespace-nowrap p-2 font-normal"><time dateTime={snapshot.valuedOn}>{snapshot.valuedOn}</time></th>
                    <td className="whitespace-nowrap p-2 font-mono" data-financial>{money(snapshot.currentValue)}</td>
                    <td className="whitespace-nowrap p-2 font-mono" data-financial>{money(snapshot.investedValue)}</td>
                    <td className="whitespace-nowrap p-2 font-mono" data-financial>{money(snapshot.pnl)}</td>
                    <td className="whitespace-nowrap p-2 font-mono" data-financial>{snapshot.pnlPercent !== null && Number.isFinite(snapshot.pnlPercent) ? formatPercent(snapshot.pnlPercent) : "—"}</td>
                    <td className="whitespace-nowrap p-2">{snapshot.pricedHoldings}/{snapshot.totalHoldings} · {snapshot.coverageComplete ? "Complete" : "Partial"}</td>
                    <td className="min-w-48 p-2"><details>
                      <summary className="cursor-pointer">Sources for {snapshot.valuedOn}</summary>
                      <p className="mt-1 break-words">Captured at {snapshot.capturedAt}.</p>
                      <p className="break-words">Holdings observed at {snapshot.holdingsObservedAt}.</p>
                      {snapshot.usdInr !== null && <p>USD/INR: {formatCurrency(snapshot.usdInr, "INR")} per USD at capture.</p>}
                      {snapshot.quoteSources.length ? <ul className="mt-1 space-y-1">{snapshot.quoteSources.map((source) => <li key={`${source.usedFor}:${source.symbol}`}>
                        {source.symbol} · {source.provider} · {source.usedFor === "currency-conversion" ? "FX" : "holding"}; source time {source.timestamp ?? "unavailable"}; exchange session {source.sessionDate ?? "unavailable"} ({source.sessionTimezone ?? "timezone unavailable"}).
                      </li>)}</ul> : <p>No usable market-data sources were included.</p>}
                      {snapshot.exclusions.length > 0 && <p className="mt-1">Excluded: {snapshot.exclusions.map(({ ticker, reason }) => `${ticker} (${exclusionLabels[reason]})`).join(", ")}.</p>}
                    </details></td>
                  </tr>)}</tbody>
                </table>
              </div>
            </details>
          </>}
        </>}

      <details className="mt-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <summary className="cursor-pointer">How history and profit/loss are calculated</summary>
        <p className="mt-2">Unrealized P&amp;L compares captured market value with the included current holding cost basis using the capture&apos;s FX rate. It excludes realized gains, cash flows, fees, dividends and historical FX effects. These figures do not measure total investment return.</p>
        <ul className="mt-2 space-y-1">{history.data?.methodology.map((line) => <li key={line}>{line}</li>)}</ul>
      </details>
    </section>
  );
}

export function PortfolioHistory({ defaultCurrency }: { defaultCurrency: Currency }) {
  const userId = useAppStore((state) => state.user?.id);
  // Local controls and mutation messages cannot survive an account change.
  return <PortfolioHistoryContent key={userId ?? "signed-out"} defaultCurrency={defaultCurrency} />;
}
