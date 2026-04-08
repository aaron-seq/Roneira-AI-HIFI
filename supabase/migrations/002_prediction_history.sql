-- ==============================================
-- Roneira AI HIFI - Prediction History Tracking
-- Durable records for realized-outcome evaluation
-- ==============================================

CREATE TABLE IF NOT EXISTS public.prediction_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN (
    'tomorrow', '1week', '1month', '3month', '6month', '1year', '1year_plus'
  )),
  model_used TEXT NOT NULL CHECK (model_used IN (
    'LSTM', 'RANDOM_FOREST', 'GAN', 'ENSEMBLE',
    'FUNDAMENTAL', 'TECHNICAL', 'PVD_MOMENTUM'
  )),
  current_price_at_prediction NUMERIC NOT NULL,
  predicted_price NUMERIC NOT NULL,
  confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  technical_signal TEXT CHECK (technical_signal IN (
    'STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'
  )),
  target_date TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  actual_price NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'expired')),
  prediction_payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prediction_history_ticker_target
  ON public.prediction_history(ticker, target_date DESC);

CREATE INDEX IF NOT EXISTS idx_prediction_history_user
  ON public.prediction_history(user_id, created_at DESC);

ALTER TABLE public.prediction_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own prediction history"
  ON public.prediction_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all prediction history"
  ON public.prediction_history FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert prediction history"
  ON public.prediction_history FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update prediction history"
  ON public.prediction_history FOR UPDATE
  USING (true)
  WITH CHECK (true);
