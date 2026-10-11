"use client";

export function ModelScore({ score }: { score: number }) {
  const displayScore = Number.isFinite(score) ? Math.min(100, Math.max(0, score)).toFixed(0) : "—";

  return (
    <section aria-label="Heuristic model score" className="w-full rounded-xl border p-5" style={{ borderColor: "var(--color-border)", background: "var(--color-bg)" }}>
      <h2 className="text-xs font-semibold" style={{ color: "var(--color-text-muted)" }}>Heuristic model score</h2>
      <p className="mt-3 font-mono text-3xl font-semibold" data-financial style={{ color: "var(--color-text-primary)" }}>
        {displayScore}<span className="ml-2 text-sm font-normal" style={{ color: "var(--color-text-muted)" }}>of 100</span>
      </p>
      <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        This model-specific score is not calibrated. It is not the probability of a correct forecast or a profitable trade, and scores from different models are not directly comparable.
      </p>
    </section>
  );
}
