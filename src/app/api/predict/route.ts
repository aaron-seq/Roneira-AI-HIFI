import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PredictionResult } from "@/lib/market/types";
import { getTargetDate } from "@/lib/market/timeframe";
import { formatIssues, predictRequestSchema } from "@/lib/server/validation";
import { rateLimit, tooManyRequests } from "@/lib/server/rate-limit";

const ML_BACKEND_URL =
  process.env.NEXT_PUBLIC_ML_BACKEND_URL || "http://localhost:8000";



async function persistPrediction(prediction: PredictionResult) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

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
      },
    };

    await Promise.allSettled([
      supabase.from("predictions_cache").insert(cacheRow),
      supabase.from("prediction_history").insert(historyRow),
      supabase.from("audit_log").insert(auditRow),
    ]);
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
    const mlResponse = await fetch(`${ML_BACKEND_URL}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ticker,
        timeframe,
        model_type: modelType,
        include_pdm: true,
      }),
      cache: "no-store",
      // Inference is slow by nature (Random Forest refits per request), but
      // unbounded means a wedged ML service hangs this route forever.
      signal: AbortSignal.timeout(30_000),
    });

    if (!mlResponse.ok) {
      // Handle integration/fallback issues gracefully if the ML service encounters a problem
      const errorText = await mlResponse.text();
      console.error("ML backend error:", errorText);
      return NextResponse.json(
        { error: "ML prediction service unavailable", details: errorText },
        { status: 502 }
      );
    }

    const prediction = (await mlResponse.json()) as PredictionResult;
    // Persist prediction for historical outcome evaluation and audit logging
    await persistPrediction(prediction);
    return NextResponse.json(prediction);
  } catch (error) {
    console.error("Prediction API error:", error);
    return NextResponse.json(
      { error: "Failed to get prediction" },
      { status: 500 }
    );
  }
}
