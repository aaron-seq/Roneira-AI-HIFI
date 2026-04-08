-- ==============================================
-- Roneira AI HIFI — Initial Database Schema
-- Supabase PostgreSQL with Row Level Security
-- ==============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== TABLE: users ==========
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  full_name TEXT,
  email TEXT UNIQUE,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  avatar_url TEXT,
  preferences JSONB DEFAULT '{"theme":"dark","defaultMarket":"NSE","newsFeed":["global","india"]}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========== TABLE: watchlist ==========
CREATE TABLE IF NOT EXISTS public.watchlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('NSE', 'BSE', 'NASDAQ', 'NYSE')),
  added_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT,
  alert_price NUMERIC,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(user_id, ticker)
);

-- ========== TABLE: portfolio_holdings ==========
CREATE TABLE IF NOT EXISTS public.portfolio_holdings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticker TEXT NOT NULL,
  company_name TEXT NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('NSE', 'BSE', 'NASDAQ', 'NYSE')),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  avg_buy_price NUMERIC NOT NULL CHECK (avg_buy_price >= 0),
  buy_date DATE,
  sector TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========== TABLE: portfolio_transactions ==========
CREATE TABLE IF NOT EXISTS public.portfolio_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  holding_id UUID REFERENCES public.portfolio_holdings(id) ON DELETE SET NULL,
  ticker TEXT NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('BUY', 'SELL', 'DIVIDEND', 'SPLIT')),
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  price NUMERIC NOT NULL CHECK (price >= 0),
  total_value NUMERIC GENERATED ALWAYS AS (quantity * price) STORED,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== TABLE: audit_log ==========
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'ADD_STOCK', 'EDIT_HOLDING', 'DELETE_HOLDING',
    'RUN_PREDICTION', 'LOGIN', 'LOGOUT',
    'ADD_WATCHLIST', 'REMOVE_WATCHLIST',
    'PRICE_ALERT', 'SIGNUP', 'SETTINGS_CHANGE'
  )),
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'portfolio', 'watchlist', 'prediction', 'auth', 'settings'
  )),
  entity_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ========== TABLE: predictions_cache ==========
CREATE TABLE IF NOT EXISTS public.predictions_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticker TEXT NOT NULL,
  timeframe TEXT NOT NULL CHECK (timeframe IN (
    'tomorrow', '1week', '1month', '3month', '6month', '1year', '1year_plus'
  )),
  model_used TEXT NOT NULL CHECK (model_used IN (
    'LSTM', 'RANDOM_FOREST', 'GAN', 'ENSEMBLE',
    'FUNDAMENTAL', 'TECHNICAL', 'PVD_MOMENTUM'
  )),
  predicted_price NUMERIC NOT NULL,
  confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  current_price NUMERIC NOT NULL,
  price_target_low NUMERIC,
  price_target_high NUMERIC,
  sentiment_score NUMERIC,
  technical_signal TEXT CHECK (technical_signal IN (
    'STRONG_BUY', 'BUY', 'HOLD', 'SELL', 'STRONG_SELL'
  )),
  analysis_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '6 hours')
);

-- ========== TABLE: news_preferences ==========
CREATE TABLE IF NOT EXISTS public.news_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  followed_tickers TEXT[] DEFAULT '{}',
  followed_sectors TEXT[] DEFAULT '{}',
  news_sources TEXT[] DEFAULT '{"reuters","bloomberg","cnbc","moneycontrol","economic_times"}',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================
-- INDEXES
-- ==============================================
CREATE INDEX IF NOT EXISTS idx_watchlist_user ON public.watchlist(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlist_ticker ON public.watchlist(ticker);
CREATE INDEX IF NOT EXISTS idx_holdings_user ON public.portfolio_holdings(user_id);
CREATE INDEX IF NOT EXISTS idx_holdings_ticker ON public.portfolio_holdings(ticker);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON public.portfolio_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_holding ON public.portfolio_transactions(holding_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.portfolio_transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.audit_log(action_type);
CREATE INDEX IF NOT EXISTS idx_predictions_ticker ON public.predictions_cache(ticker, timeframe);
CREATE INDEX IF NOT EXISTS idx_predictions_expires ON public.predictions_cache(expires_at);

-- ==============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ==============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_holdings_updated_at
  BEFORE UPDATE ON public.portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- ROW LEVEL SECURITY POLICIES
-- ==============================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.predictions_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_preferences ENABLE ROW LEVEL SECURITY;

-- ---- users table ----
CREATE POLICY "Users can read own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can read all profiles"
  ON public.users FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- watchlist table ----
CREATE POLICY "Users can manage own watchlist"
  ON public.watchlist FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- portfolio_holdings table ----
CREATE POLICY "Users can manage own holdings"
  ON public.portfolio_holdings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all holdings"
  ON public.portfolio_holdings FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- portfolio_transactions table ----
CREATE POLICY "Users can manage own transactions"
  ON public.portfolio_transactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all transactions"
  ON public.portfolio_transactions FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ---- audit_log table ----
CREATE POLICY "Users can read own audit logs"
  ON public.audit_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all audit logs"
  ON public.audit_log FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "System can insert audit logs"
  ON public.audit_log FOR INSERT
  WITH CHECK (true);

-- Prevent deletion of audit logs (append-only)
-- No DELETE policy = cannot delete

-- ---- predictions_cache table ----
CREATE POLICY "Anyone authenticated can read predictions"
  ON public.predictions_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can manage predictions cache"
  ON public.predictions_cache FOR ALL
  USING (true)
  WITH CHECK (true);

-- ---- news_preferences table ----
CREATE POLICY "Users can manage own news preferences"
  ON public.news_preferences FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ==============================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ==============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );

  -- Also create default news preferences
  INSERT INTO public.news_preferences (user_id)
  VALUES (NEW.id);

  -- Log signup event
  INSERT INTO public.audit_log (user_id, action_type, entity_type, new_values)
  VALUES (
    NEW.id,
    'SIGNUP',
    'auth',
    jsonb_build_object('email', NEW.email, 'username', COALESCE(NEW.raw_user_meta_data->>'username', ''))
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================
-- AUDIT LOG TRIGGER FOR PORTFOLIO CHANGES
-- ==============================================
CREATE OR REPLACE FUNCTION public.log_portfolio_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, new_values)
    VALUES (
      NEW.user_id,
      'ADD_STOCK',
      'portfolio',
      NEW.id,
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, old_values, new_values)
    VALUES (
      NEW.user_id,
      'EDIT_HOLDING',
      'portfolio',
      NEW.id,
      to_jsonb(OLD),
      to_jsonb(NEW)
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, old_values)
    VALUES (
      OLD.user_id,
      'DELETE_HOLDING',
      'portfolio',
      OLD.id,
      to_jsonb(OLD)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_portfolio_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.portfolio_holdings
  FOR EACH ROW EXECUTE FUNCTION public.log_portfolio_change();

-- Watchlist audit
CREATE OR REPLACE FUNCTION public.log_watchlist_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, new_values)
    VALUES (NEW.user_id, 'ADD_WATCHLIST', 'watchlist', NEW.id, to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_log (user_id, action_type, entity_type, entity_id, old_values)
    VALUES (OLD.user_id, 'REMOVE_WATCHLIST', 'watchlist', OLD.id, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_watchlist_changes
  AFTER INSERT OR DELETE ON public.watchlist
  FOR EACH ROW EXECUTE FUNCTION public.log_watchlist_change();
