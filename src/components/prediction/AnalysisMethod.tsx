import type { PredictionResult } from "@/lib/market/types";

const BACKENDS: Record<string, string> = {
  xgboost: "Gradient-boosted trees (XGBoost)",
  sklearn: "Gradient-boosted trees (scikit-learn)",
  tensorflow: "TensorFlow",
  random_forest: "Random forest",
  technical: "Technical indicators",
  pvd_momentum: "Price / volume momentum",
  ensemble: "Blend of compatible models",
  fallback: "No-change reference",
};

const REASONS: Record<string, string> = {
  horizon_mismatch: "Trained for a different horizon",
  artifact_unavailable: "Trained model unavailable",
  artifact_incompatible: "Trained model needs updating",
  insufficient_history: "Not enough valid historical sessions",
  invalid_input: "Historical features are unavailable",
  inference_failed: "Model could not produce an estimate",
  no_eligible_models: "No compatible model was available",
};

const MODEL_NAMES: Record<string, string> = {
  RANDOM_FOREST: "Random forest",
  TECHNICAL: "Technical rules",
  PVD_MOMENTUM: "Momentum rules",
  LSTM: "Sequence artifact",
  GAN: "Price / range artifact",
  ENSEMBLE: "Equal-weight blend",
};

export function unavailableReason(reason?: string | null) {
  return (reason && REASONS[reason]) || "Model unavailable";
}

export function modelName(name: string) {
  return MODEL_NAMES[name] ?? "Selected model";
}

export function backendName(backend?: string | null) {
  return (backend && BACKENDS[backend]) || "Not provided";
}

function sessions(count?: number | null) {
  return count == null ? "Not provided" : `${count} trading session${count === 1 ? "" : "s"}`;
}

export function trainedHorizon(backend?: string, count?: number | null) {
  if (backend === "technical" || backend === "pvd_momentum") return "Not applicable (rules)";
  return sessions(count);
}

/** Provider daily-session provenance is distinct from a real-time quote stamp. */
export function AnalysisMethod({ result }: { result: PredictionResult }) {
  const status = result.model_status;
  const excluded = result.excluded_components ?? [];
  const fallback = Boolean(result.fallback || status?.fallback);
  const ensembleHorizon = !fallback && result.components?.length
    ? "See included models"
    : excluded.length > 0 ? "See excluded models" : "Not provided";

  return (
    <section aria-label="Analysis method" className="card p-5 sm:p-6">
      <h2 className="text-sm font-semibold" style={{ color: "var(--color-text-primary)" }}>Analysis method</h2>
      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        {[
          ["Method", fallback ? "No-change reference" : backendName(status?.backend)],
          ["Requested horizon", sessions(result.horizon_sessions ?? status?.requested_horizon_sessions)],
          ["Trained horizon", status?.backend === "ensemble" ? ensembleHorizon : trainedHorizon(status?.backend, status?.trained_horizon_sessions)],
          ["Input history", sessions(result.history_sessions)],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs" style={{ color: "var(--color-text-faint)" }}>{label}</dt>
            <dd className="mt-1 text-sm" style={{ color: "var(--color-text-primary)" }}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
        Provider daily session: {result.data_session_date ?? "Not provided"}
        {result.data_session_timezone ? ` (${result.data_session_timezone})` : ""}.
        {" "}This identifies the historical input session, not a live quote or forecast date.
      </p>
      {!status && (
        <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-warning)" }}>
          Model status was not provided. Training compatibility and fallback status cannot be confirmed for this result.
        </p>
      )}
      {excluded.length > 0 && (
        <div className="mt-4 border-t pt-4" style={{ borderColor: "var(--color-divider)" }}>
          <h3 className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>Excluded from this blend</h3>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            {excluded.map((component) => (
              <li key={component.name}>
                <span className="font-medium">{modelName(component.name)}</span>: {unavailableReason(component.reason)}
                {component.trained_horizon_sessions != null ? ` (trained for ${sessions(component.trained_horizon_sessions)})` : ""}.
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
            Excluded models contribute no estimate or weight.{" "}
            {fallback ? "No supported blend was produced." : "The remaining compatible models share the blend equally."}
          </p>
        </div>
      )}
    </section>
  );
}
