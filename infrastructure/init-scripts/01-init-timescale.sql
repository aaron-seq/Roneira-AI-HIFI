-- Roneira AI HIFI - TimescaleDB Initialization Script
-- This script sets up TimescaleDB extension and configures time-series capabilities

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Create schemas for organization
CREATE SCHEMA IF NOT EXISTS portfolio;
CREATE SCHEMA IF NOT EXISTS market_data;
CREATE SCHEMA IF NOT EXISTS ml_predictions;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'TimescaleDB extension and schemas initialized successfully';
END $$;
