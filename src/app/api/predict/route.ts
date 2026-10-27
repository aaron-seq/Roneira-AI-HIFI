import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { PredictionResult } from "@/lib/market/types";
import { getTargetDate } from "@/lib/market/timeframe";
import { formatIssues, predictRequestSchema } from "@/lib/server/validation";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";
import { fetchMLJson, mlServiceErrorResponse } from "@/lib/server/ml";

async function persistPrediction(
  prediction: PredictionResult,
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  try {
    const cacheRow = {
      ticker: prediction.ticker,
      timeframe: prediction.timeframe,
      model_used: prediction.model_used,
      predicted_price: prediction.predicted_price,
      confidence_score: prediction.confidence,
      current_price: prediction.current_price,
      price_target_low: prediction.price_target_low,
      price_target_high: prediction.price_target_high,
      technical_signal: prediction.short_term_signal.signal,
      analysis_data: prediction,
    };

    const historyRow = {
      user_id: userId,
      ticker: prediction.ticker,
      timeframe: prediction.timeframe,
      model_used: prediction.model_used,
      current_price_at_prediction: prediction.current_price,
      predicted_price: prediction.predicted_price,
      confidence_score: prediction.confidence,
      technical_signal: prediction.short_term_signal.signal,
      target_date: getTargetDate(prediction.timeframe),
      prediction_payload: prediction,
    };

    const auditRow = {
      user_id: userId,
      action_type: "RUN_PREDICTION",
      entity_type: "prediction",
      new_values: {
        ticker: prediction.ticker,
        timeframe: prediction.timeframe,
        model_used: prediction.model_used,
        predicted_price: prediction.predicted_price,
        confidence: prediction.confidence,
        fallback: prediction.fallback ?? null,
        fallback_reason: prediction.fallback_reason ?? null,
        excluded_components: prediction.excluded_components ?? [],
      },
    };

    const persisted = await Promise.allSettled([
      // An unavailable model returns a disclosed no-change reference. Saving
      // it as a successful forecast would pollute later outcome evaluation.
      ...(!prediction.fallback ? [
        supabase.from("predictions_cache").insert(cacheRow),
        supabase.from("prediction_history").insert(historyRow),
      ] : []),
      // The public Data API cannot append audit records (migration014). Keep
      // this privileged write separate so an audit failure cannot skip the
      // user-scoped history/cache writes above.
      Promise.resolve().then(() => createAdminClient().from("audit_log").insert(auditRow)),
    ]);
    for (const result of persisted) {
      if (result.status === "rejected" || result.value.error) {
        console.warn("Prediction persistence write failed");
      }
    }
  } catch (error) {
    console.warn("Prediction persistence warning:", error);
  }
}

export async function POST(request: Request) {
  try {
    // Each request is a real ML inference call (Random Forest refits per
    // request per the comment below) -- throttle so one client can't wedge
    // the FastAPI service for everyone else.
    const limit = await rateLimit("predict", request, 20, 60);
    if (!limit.ok) {
      return tooManyRequests(60);
    }

    // Prediction fits consume CPU and are part of the authenticated dashboard.
    // Verify the session before contacting the private service, and reuse that
    // same identity when saving the result.
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = predictRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json(
        { error: formatIssues(parsed.error) },
        { status: 400 }
      );
    }

    const ticker = parsed.data.ticker.toUpperCase();
    const timeframe = parsed.data.timeframe;
    const modelType = parsed.data.model_type ?? "ENSEMBLE";

    // Route prediction requests through the Next.js API to the internal FastAPI service
    // This keeps the ML backend private and validates payloads
    const prediction = await fetchMLJson<PredictionResult>("/predict", {
      method: "POST",
      body: JSON.stringify({
        ticker,
        timeframe,
        model_type: modelType,
        include_pdm: true,
      }),
      // Inference is slow by nature (Random Forest refits per request), but
      // unbounded means a wedged ML service hangs this route forever.
      timeoutMs: 30_000,
    });
    // Persist prediction for historical outcome evaluation and audit logging
    await persistPrediction(prediction, supabase, user.id);
    return NextResponse.json(prediction);
  } catch (error) {
    const unavailable = mlServiceErrorResponse(error);
    if (unavailable) return unavailable;
    console.error("Prediction API error:", error);
    return NextResponse.json(
      { error: "Failed to get prediction" },
      { status: 500 }
    );
  }
}
