"use client";

import { useId } from "react";
import type { InsightStories } from "@/lib/insights/stories";

export interface InsightsStoriesProps {
  title: string;
  insights: InsightStories;
  state?: "ready" | "loading" | "error";
  onRetry?: () => void;
  isRetrying?: boolean;
  errorMessage?: string;
}

/** Shared, readable narratives; each calculation and data source stays inspectable. */
export function InsightsStories({
  title,
  insights,
  state = "ready",
  onRetry,
  isRetrying = false,
  errorMessage = "The data for these insights could not be loaded.",
}: InsightsStoriesProps) {
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} aria-busy={state === "loading" || isRetrying} className="card mb-6 min-w-0 p-5 sm:p-6">
      <h2 id={titleId} className="text-base font-semibold" style={{ color: "var(--color-text-primary)" }}>{title}</h2>

      {state === "loading" ? (
        <p role="status" className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>Loading insights from available data...</p>
      ) : state === "error" ? (
        <div className="mt-3">
          <p role="alert" className="text-sm" style={{ color: "var(--color-text-muted)" }}>{errorMessage}</p>
          {onRetry && (
            <button type="button" onClick={onRetry} disabled={isRetrying} className="mt-3 rounded-lg border px-3 py-2 text-sm font-medium" style={{ color: "var(--color-text-primary)", borderColor: "var(--color-border)" }}>
              {isRetrying ? "Retrying insights..." : "Retry insights"}
            </button>
          )}
        </div>
      ) : (
        <>
          {insights.stories.length > 0 ? (
            <ul className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {insights.stories.map((story) => (
                <li key={story.id} className="min-w-0 rounded-lg border p-4" style={{ borderColor: "var(--color-divider)", background: "var(--color-surface-offset)" }}>
                  <h3 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>{story.title}</h3>
                  <p className="mt-2 break-words text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{story.body}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status" className="mt-3 text-sm" style={{ color: "var(--color-text-muted)" }}>No insights are available for this data.</p>
          )}
          <p className="mt-4 break-words text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>{insights.sourceNote}</p>
          <details className="mt-4 border-t pt-3" style={{ borderColor: "var(--color-divider)" }}>
            <summary className="cursor-pointer text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>Sources and calculations</summary>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
              {insights.methodology.map((method, index) => <li key={index}>{method}</li>)}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}
