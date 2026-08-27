# Future Enhancements and Ideas

This document outlines proposed enhancements for the Roneira AI HIFI platform. Contributions from day trading experts and quantitative analysts are welcome.

## Triage

The sections below are a flat brainstorm list — this triage sorts the same
items by how close they are to being buildable against the *current*
canonical stack (`src/` + `ml/` + Supabase), so "someday" ideas don't compete
for attention with things that could ship next.

**Shipped**
- ~~Additional technical indicators (Supertrend, Ichimoku, Anchored VWAP)~~ — done. All three are in `ml/app/models/technical_analysis.py` as `_supertrend`, `_ichimoku` and `_anchored_vwap`, voting alongside the original six. Building them surfaced a bug in the aggregate they feed: it was `buy / total`, which counted every Neutral as evidence against buying, so a flat tape read `SELL` and a sustained downtrend read `HOLD`. The verdict is now the net vote — see the Technical Analysis section of `ml/MODELS.md`. Harmonic patterns, Volume Profile / Market Profile, Wyckoff and Elliott Wave (listed further down) are *not* done and are a different order of effort — they need swing/pivot detection rather than a rolling window.

**Near-term — buildable now, moderate effort, clear user value**
- Multi-timeframe confluence dashboard — reuses existing prediction/technical endpoints across a few `timeframe` values. → [#146](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/146)
- Trade journal / performance attribution on the Portfolio dashboard — data already lives in `portfolio_transactions`. → [#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147)
- Alert system for signal triggers — needs a scheduler first; nothing in the stack currently runs periodically, and Render's free tier spins down after 15 min idle. → [#148](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/148)

**Mid-term — real value, needs new infrastructure or a provider decision**
- Backtesting framework (walk-forward, Monte Carlo) — needs a historical-data store beyond the 6-month cache `market_data.stock_prices` currently holds. **Promoted: every ML claim in this repo rests on a single 80/20 split, and the rule-based models have never been measured at all.** → [#144](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/144)
- Options flow integration, dark-pool/algo detection — needs a paid data provider; evaluate cost against the free-tier-first posture of the current providers (Twelve Data, Finnhub, Alpha Vantage).
- Portfolio risk allocation (risk parity, mean-variance, Black-Litterman) — meaningful math, but well-scoped as a pure computation over existing `portfolio_holdings` data.
- Sector rotation signals, correlation matrices — needs cross-ticker historical data at a scale beyond what's cached today.

**Speculative — real architectural changes, evaluate before committing**
- WebSocket / real-time price feeds — the old `realtime/` Socket.IO service was deleted (orphaned, built against the Vite frontend's port, never in CI). Reviving real-time ticks means deciding whether to recover it from git history or build something that actually fits the Vercel+Supabase+Railway/Render model.
- Multi-asset PDM extension (crypto, forex) — current provider fallback chain (Twelve Data → yfinance) is equity-oriented; needs its own data-source evaluation.
- Mobile PWA — no mobile-specific work has started; would need its own scoping pass.
- Institutional/regulatory features (MiFID II, SEC reporting), white-label — out of scope for a personal/portfolio-stage project; revisit only if the product's audience actually changes.

---

## Tracked work

Anything with an issue number is tracked there, not here. This document is the
brainstorm; the tracker is the backlog.

| # | What | Kind |
|---|---|---|
| [#140](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/140) | `ml/` dev env runs a different Python and numpy than CI and deploy | bug |
| [#141](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/141) | No way to test React components (vitest is node-only, jsdom unused) | dx |
| [#142](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/142) | ATR/ADX use an SMA, not Wilder smoothing | bug |
| [#143](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/143) | GAN slot's 5-draw spread is structurally zero | bug |
| [#144](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/144) | Walk-forward backtesting | feature |
| [#145](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/145) | Ensemble weights are hand-set and unvalidated | feature |
| [#146](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/146) | Multi-timeframe confluence | feature |
| [#147](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/147) | Trade journal / performance attribution | feature |
| [#148](https://github.com/aaron-seq/Roneira-AI-HIFI/issues/148) | Signal alerts (blocked on a scheduler decision) | feature |

---

## PDM Strategy Enhancements

### 1. Advanced Momentum Metrics

- **Jerk Analysis (d³f/dt³)** - Third derivative to detect early momentum reversals
- **Cross-Asset Correlation** - Track momentum correlation across sectors
- **Intraday Momentum Decay** - Measure how momentum changes throughout trading sessions
- **Options Flow Integration** - Incorporate unusual options activity as momentum confirmation

### 2. Machine Learning Integration

- **LSTM Networks** - Sequence prediction for momentum continuation/reversal
- **Gradient Boosting** - Feature importance for signal strength calculation
- **Reinforcement Learning** - Adaptive position sizing based on market regime
- **Transformer Models** - Attention-based pattern recognition in price-volume data

### 3. Risk Management

- **Dynamic Position Sizing** - Kelly Criterion with volatility adjustment
- **Correlation-Based Hedging** - Automatic hedge suggestions for correlated positions
- **Drawdown Protection** - Automated de-risking during adverse market conditions
- **Sector Rotation Signals** - PDM-based sector allocation recommendations

### 4. Real-Time Enhancements

- **WebSocket Price Feeds** - Sub-second price updates for intraday trading
- **Order Book Analysis** - Level 2 data integration for liquidity assessment
- **Dark Pool Detection** - Identify institutional block trades
- **Algo Detection** - Recognize algorithmic trading patterns

---

## Technical Analysis Improvements

### Chart Enhancements

- **Volume Profile** - Point of Control (POC) and Value Area calculations
- **Market Profile** - TPO (Time Price Opportunity) charts
- **Wyckoff Analysis** - Accumulation/Distribution phase detection
- **Elliott Wave Counter** - Automated wave counting with confidence scores

### Additional Indicators

- ~~**Anchored VWAP**~~ - done, anchored at both the lookback's highest high and lowest low (the two anchors that actually get drawn). Abstains when the anchored segment has no volume.
- ~~**Supertrend**~~ - done, ATR(10) bands at 3x, with the standard ratcheting bands and direction flip.
- ~~**Ichimoku Cloud**~~ - done: tenkan, kijun, and both senkou spans. The chikou span is deliberately omitted — it can only be read against price 26 bars back, so it says nothing about the current bar and invites a look-ahead comparison.
- **Harmonic Patterns** - Gartley, Butterfly, Crab pattern detection — needs swing/pivot detection first, which nothing here has yet.
- **Order Flow Imbalance** - Buy/Sell pressure analysis — needs tick or L2 data; no current provider supplies it.

### Multi-Timeframe Analysis

- **MTF Dashboard** - Synchronized signals across 5m, 15m, 1h, 4h, Daily
- **Timeframe Confluence** - Highlight when multiple timeframes align
- **Higher Timeframe Bias** - Automatic trend direction from larger timeframes

---

## Data Integration Ideas

### Market Data APIs

| Provider | Data Type | Use Case |
|----------|-----------|----------|
| Alpha Vantage | Historical OHLCV | Backtesting, long-term analysis |
| Polygon.io | Real-time quotes | Live trading signals |
| Quandl | Fundamental data | Value-based filters |
| IEX Cloud | Corporate actions | Dividend/split adjustments |
| Finnhub | Earnings calendar | Event-based trading |
| TradingView | Chart widgets | Professional charting |

### Alternative Data Sources

- **Satellite Imagery** - Retail foot traffic for consumer stocks
- **Social Sentiment** - Twitter/Reddit sentiment analysis
- **SEC Filings** - 13F institutional holdings tracking
- **Patent Filings** - Innovation signals for tech stocks
- **Supply Chain Data** - Lead indicators for manufacturing

---

## Backtesting Framework

### Proposed Features

- **Walk-Forward Optimization** - Prevent overfitting with rolling windows
- **Monte Carlo Simulation** - Risk assessment through randomization
- **Transaction Cost Modeling** - Realistic slippage and commission estimates
- **Market Impact Analysis** - Estimate price impact for larger positions
- **Regime Detection** - Identify bull/bear/sideways market conditions

### Performance Metrics

- Sharpe Ratio, Sortino Ratio, Calmar Ratio
- Maximum Drawdown Duration
- Win Rate by Market Regime
- Profit Factor by Position Size
- Recovery Factor Analysis

---

## Portfolio Management

### Risk Allocation

- **Risk Parity** - Equal risk contribution across positions
- **Mean-Variance Optimization** - Efficient frontier allocation
- **Black-Litterman Model** - Combine market equilibrium with views
- **Hierarchical Risk Parity** - Cluster-based allocation

### Position Management

- **Partial Profit Taking** - Systematic scaling out of winners
- **Pyramiding Rules** - Add to winning positions with defined criteria
- **Portfolio Heat Map** - Real-time risk visualization
- **Correlation Matrix** - Live correlation monitoring

---

## User Experience

### Dashboard Enhancements

- **Customizable Layouts** - Drag-and-drop widget arrangement
- **Alert System** - Push notifications for signal triggers
- **Trade Journal** - Built-in journaling with automatic trade import
- **Performance Attribution** - Analyze returns by strategy/sector

### Mobile Features

- **PWA Support** - Progressive Web App for mobile access
- **Push Notifications** - Real-time signal alerts
- **Quick Watchlist** - Streamlined mobile watchlist management

---

## Contributing

We welcome contributions from:

- **Day Trading Experts** - Strategy refinement and real-world validation
- **Quantitative Analysts** - Mathematical model improvements
- **Data Scientists** - Machine learning and feature engineering
- **Software Engineers** - Platform scalability and performance
- **UX Designers** - Trading interface optimization

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-idea`)
3. Implement your enhancement with tests
4. Submit a Pull Request with detailed description
5. Engage in code review process

### Discussion Topics

Open an issue with the `enhancement` label to discuss:

- New indicator implementations
- Alternative data source integrations
- Backtesting methodology improvements
- PDM strategy refinements
- Performance optimization ideas

---

## Research Priorities

### Q1 2026

- [x] Additional technical indicators (Supertrend, Ichimoku, Anchored VWAP)
- [ ] LSTM-based momentum prediction
- [ ] Options flow integration
- [ ] Real-time WebSocket implementation
- [ ] Mobile PWA development

### Q2 2026

- [ ] Multi-asset PDM extension (Crypto, Forex)
- [ ] Sector rotation strategy
- [ ] Sentiment analysis enhancement
- [ ] Advanced risk management dashboard

---

*This document is a living roadmap. Please contribute your ideas via GitHub Issues or Pull Requests.*
