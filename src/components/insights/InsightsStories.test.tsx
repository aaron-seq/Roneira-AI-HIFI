// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InsightStories } from "@/lib/insights/stories";
import { InsightsStories } from "./InsightsStories";

afterEach(cleanup);

const insights: InsightStories = {
  stories: [
    { id: "coverage", title: "Valuation coverage", body: "1 of 3 holdings are included in the INR valuation." },
    { id: "weight", title: "Largest exposure", body: "TCS.NS represents 100.0% of the priced, convertible book." },
  ],
  sourceNote: "Provider as-of: 2026-10-09 10:00:00 UTC. Exchange sessions: 2026-10-09 (Asia/Kolkata).",
  methodology: ["Missing quotes are excluded from totals.", "Partial coverage does not establish whole-portfolio concentration."],
};

describe("shared data stories", () => {
  it("uses a named region and readable headings and keeps source dates visible", () => {
    render(<InsightsStories title="Portfolio insights" insights={insights} />);
    const panel = screen.getByRole("region", { name: "Portfolio insights" });
    expect(within(panel).getByRole("heading", { level: 2 }).textContent).toBe("Portfolio insights");
    expect(within(panel).getAllByRole("heading", { level: 3 })).toHaveLength(2);
    expect(panel.textContent).toContain("1 of 3 holdings");
    const source = within(panel).getByText(insights.sourceNote);
    expect(source.closest("details")).toBeNull();
    expect(panel.getAttribute("aria-busy")).toBe("false");
  });

  it("puts the calculation limits in a native disclosure", () => {
    render(<InsightsStories title="Portfolio insights" insights={insights} />);
    const disclosure = screen.getByText("Sources and calculations");
    expect(disclosure.tagName).toBe("SUMMARY");
    expect(disclosure.parentElement?.tagName).toBe("DETAILS");
    expect(disclosure.parentElement?.textContent).toContain("Missing quotes are excluded from totals");
    expect(disclosure.parentElement?.textContent).toContain("whole-portfolio concentration");
  });

  it("announces loading and keeps old values out of the loading panel", () => {
    render(<InsightsStories title="Market insights" insights={insights} state="loading" />);
    const panel = screen.getByRole("region", { name: "Market insights" });
    expect(panel.getAttribute("aria-busy")).toBe("true");
    expect(within(panel).getByRole("status").textContent).toContain("Loading insights");
    expect(within(panel).queryByText(insights.stories[0].body)).toBeNull();
    expect(within(panel).queryByText(insights.sourceNote)).toBeNull();
  });

  it("provides a retry for failed data without showing a successful zero book", () => {
    const retry = vi.fn();
    const { rerender } = render(<InsightsStories title="Portfolio insights" insights={insights} state="error" onRetry={retry} errorMessage="Portfolio quotes are unavailable." />);
    expect(screen.getByRole("alert").textContent).toBe("Portfolio quotes are unavailable.");
    fireEvent.click(screen.getByRole("button", { name: "Retry insights" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.queryByText(insights.stories[0].body)).toBeNull();
    rerender(<InsightsStories title="Portfolio insights" insights={insights} state="error" onRetry={retry} isRetrying />);
    expect((screen.getByRole("button", { name: "Retrying insights..." }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("region", { name: "Portfolio insights" }).getAttribute("aria-busy")).toBe("true");
  });

  it("supports two instances without duplicated heading identifiers", () => {
    render(<><InsightsStories title="Market insights" insights={insights} /><InsightsStories title="Portfolio insights" insights={insights} /></>);
    const market = screen.getByRole("region", { name: "Market insights" });
    const portfolio = screen.getByRole("region", { name: "Portfolio insights" });
    expect(market.getAttribute("aria-labelledby")).not.toBe(portfolio.getAttribute("aria-labelledby"));
  });

  it("has an explicit empty result and renders user labels as text", () => {
    const { rerender } = render(<InsightsStories title="Insights" insights={{ ...insights, stories: [] }} />);
    expect(screen.getByRole("status").textContent).toContain("No insights are available");
    rerender(<InsightsStories title="Insights" insights={{ ...insights, stories: [{ id: "label", title: "<script>Sector</script>", body: "<img src=x onerror=alert(1)>" }] }} />);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("<script>Sector</script>");
    expect(screen.getByRole("region", { name: "Insights" }).querySelector("script, img")).toBeNull();
  });
});
