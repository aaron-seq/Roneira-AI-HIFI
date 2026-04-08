import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { PredictionResult } from "@/lib/market/types";

const ML_BACKEND_URL =
  process.env.NEXT_PUBLIC_ML_BACKEND_URL || "http://localhost:8000";

interface PredictRequestBody {
  ticker: string;
  timeframe: string;
  model_type?: string;
}

const TIMEFRAME_DAYS: Record<string, number> = {
  tomorrow: 1,
  "1week": 7,
  "1month": 30,
  "3month": 90,
  "6month": 180,
  "1year": 365,
  "1year_plus": 400,
};

function getTargetDate(timeframe: string) {
  const target = new Date();
  target.setUTCDate(target.getUTCDate() + (TIMEFRAME_DAYS[timeframe] ?? 30));
  return target.toISOString();
}

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
    const body = (await request.json()) as PredictRequestBody;
    const ticker = body.ticker?.toUpperCase();
    const timeframe = body.timeframe;
    const modelType = body.model_type?.toUpperCase() || "ENSEMBLE";

    if (!ticker || !timeframe) {
      return NextResponse.json(
        { error: "ticker and timeframe are required" },
        { status: 400 }
      );
    }

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
    });

    if (!mlResponse.ok) {
      const errorText = await mlResponse.text();
      console.error("ML backend error:", errorText);
      return NextResponse.json(
        { error: "ML prediction service unavailable", details: errorText },
        { status: 502 }
      );
    }

    const prediction = (await mlResponse.json()) as PredictionResult;
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
