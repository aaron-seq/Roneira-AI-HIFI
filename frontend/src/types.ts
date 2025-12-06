export interface StockPredictionResult {
    ticker_symbol: string;
    company_name: string;
    current_market_price: number;
    ml_predicted_price: number;
    predicted_price_change: number;
    predicted_percentage_change: number;
    prediction_horizon_days: number;
    model_accuracy_r2_score: number;
    market_sentiment: {
        label: string;
        score: number;
    };
    timestamp: string;
    technical_indicators: {
        relative_strength_index: number | null;
        simple_moving_average_5: number | null;
        simple_moving_average_20: number | null;
        macd_line: number | null;
        bollinger_position: number | null;
    };
    pdm_strategy_analysis?: {
        signal_type: string;
        confidence_score: number;
        price_velocity: number;
        price_curvature: number;
        volume_sensitivity: number;
        institutional_volume_factor: number;
        atr_hard_stop_loss: number;
        atr_trailing_stop: number;
        strategy_description: string;
    };
}

export interface PDMOpportunity {
    ticker_symbol: string;
    signal_type: string;
    current_price: number;
    confidence_score: number;
    price_velocity: number;
    price_curvature: number;
    volume_sensitivity: number;
    institutional_factor: number;
    atr_stop_loss: number;
    trailing_stop: number;
    signal_timestamp: string;
}

export interface MarketHealthStatus {
    service_status: string;
    timestamp: string;
    ml_service_status: string;
    pdm_engine_status: string;
    supported_features: string[];
    version: string;
}
