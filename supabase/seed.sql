-- Local development seed. Loaded by `supabase start` / `supabase db reset`
-- against the LOCAL stack only -- never run this against a hosted project.
--
-- Test accounts (local only, test values):
--   demo  / demo-password-123   -- regular user with a portfolio and watchlist
--   admin / admin-password-123  -- admin, for /dashboard/admin
--
-- Sign in on /login with the username, not the email.

-- Users go into auth.users; the on_auth_user_created trigger creates the
-- matching public.users row, news preferences and SIGNUP audit entry.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) VALUES
  (
    '00000000-0000-0000-0000-000000000000', '11111111-1111-1111-1111-111111111111',
    'authenticated', 'authenticated', 'demo@roneira.test',
    crypt('demo-password-123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"demo","full_name":"Demo Trader"}',
    now() - interval '400 days', now(), '', '', '', ''
  ),
  (
    '00000000-0000-0000-0000-000000000000', '22222222-2222-2222-2222-222222222222',
    'authenticated', 'authenticated', 'admin@roneira.test',
    crypt('admin-password-123', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"admin","full_name":"Local Admin"}',
    now() - interval '400 days', now(), '', '', '', ''
  );

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
FROM auth.users u
WHERE u.id IN ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222');

-- Role is set here, as the database owner, not through signup metadata: the
-- trigger deliberately ignores a client-supplied role.
UPDATE public.users SET role = 'admin' WHERE id = '22222222-2222-2222-2222-222222222222';

-- Holdings: a mixed India / US book with a sector spread, so allocation,
-- P&L colouring and currency handling all have something to show.
INSERT INTO public.portfolio_holdings (user_id, ticker, company_name, exchange, quantity, avg_buy_price, buy_date, sector) VALUES
  ('11111111-1111-1111-1111-111111111111', 'RELIANCE.NS', 'Reliance Industries',       'NSE',    40, 1240.00, current_date - 380, 'Energy'),
  ('11111111-1111-1111-1111-111111111111', 'TCS.NS',      'Tata Consultancy Services', 'NSE',    15, 2050.00, current_date - 300, 'Technology'),
  ('11111111-1111-1111-1111-111111111111', 'HDFCBANK.NS', 'HDFC Bank',                 'NSE',    60,  690.00, current_date - 250, 'Banking'),
  ('11111111-1111-1111-1111-111111111111', 'INFY.NS',     'Infosys',                   'NSE',    30, 1060.00, current_date - 120, 'Technology'),
  ('11111111-1111-1111-1111-111111111111', 'AAPL',        'Apple Inc.',                'NASDAQ', 12,  185.00, current_date - 200, 'Technology'),
  ('11111111-1111-1111-1111-111111111111', 'NVDA',        'NVIDIA',                    'NASDAQ',  8,  110.00, current_date - 140, 'Technology');

-- Transaction history behind those holdings. INFY includes a partial sell and
-- a re-entry -- the two cases realised-P&L code most often gets wrong (#147).
INSERT INTO public.portfolio_transactions (user_id, holding_id, ticker, transaction_type, quantity, price, transaction_date, notes)
SELECT '11111111-1111-1111-1111-111111111111', h.id, t.ticker, t.kind, t.qty, t.price, current_date - t.days_ago, t.note
FROM (VALUES
  ('RELIANCE.NS', 'BUY',      40, 1240.00, 380, 'Initial position'),
  ('RELIANCE.NS', 'DIVIDEND', 40,    5.50, 150, 'Final dividend'),
  ('TCS.NS',      'BUY',      15, 2050.00, 300, NULL),
  ('HDFCBANK.NS', 'BUY',      60,  690.00, 250, NULL),
  ('INFY.NS',     'BUY',      50,  980.00, 330, NULL),
  ('INFY.NS',     'SELL',     50, 1150.00, 200, 'Took profit'),
  ('INFY.NS',     'BUY',      30, 1060.00, 120, 'Re-entry after pullback'),
  ('AAPL',        'BUY',      12,  185.00, 200, NULL),
  ('NVDA',        'BUY',      10,  110.00, 140, NULL),
  ('NVDA',        'SELL',      2,  128.00,  95, 'Trimmed')
) AS t(ticker, kind, qty, price, days_ago, note)
JOIN public.portfolio_holdings h
  ON h.ticker = t.ticker AND h.user_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.watchlist (user_id, ticker, exchange, notes, alert_price, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111', 'SBIN.NS',       'NSE',    'Waiting for a pullback', 760, 0),
  ('11111111-1111-1111-1111-111111111111', 'BAJFINANCE.NS', 'NSE',    NULL,                     NULL, 1),
  ('11111111-1111-1111-1111-111111111111', 'MSFT',          'NASDAQ', 'Earnings next month',    NULL, 2),
  ('11111111-1111-1111-1111-111111111111', 'GOOGL',         'NASDAQ', NULL,                     NULL, 3);
