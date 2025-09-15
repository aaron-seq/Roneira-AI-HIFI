import React, { useState, useEffect } from 'react';
import axios, { AxiosError } from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// --- Type Definitions ---
// Type for the raw data coming from the backend API
interface RawStockData {
    date: string; // This will be a string like "2023-10-27T00:00:00.000Z"
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjClose?: number; // Optional property
}

// Type for the data formatted for the chart
interface FormattedStockData {
    date: string; // This will be a formatted string like "10/27/2023"
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface PredictionData {
    ticker: string;
    predicted_close_price: number;
    last_open_price: number;
}

// Type for a more structured API error response
interface ApiError {
    message: string;
}

// --- API Configuration ---
const API_BASE_URL = 'http://localhost:3001/api';

const App: React.FC = () => {
    // --- State Management ---
    const [ticker, setTicker] = useState<string>('AAPL');
    const [historicalData, setHistoricalData] = useState<FormattedStockData[]>([]);
    const [prediction, setPrediction] = useState<PredictionData | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true); // Start with loading true
    const [error, setError] = useState<string | null>(null);

    // --- Functions ---
    const formatDataForChart = (data: RawStockData[]): FormattedStockData[] => {
        // Sort the data by date to ensure the chart is chronological
        const sortedData = data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        return sortedData.map(item => ({
            date: new Date(item.date).toLocaleDateString(),
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close,
            volume: item.volume
        }));
    };

    const handleFetchData = async (currentTicker: string) => {
        if (!currentTicker) {
            setError('Please enter a stock ticker.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setPrediction(null);
        setHistoricalData([]);

        try {
            // Fetch both historical data and prediction concurrently
            const [historyRes, predictionRes] = await Promise.all([
                axios.get<RawStockData[]>(`${API_BASE_URL}/stock/${currentTicker}`),
                axios.post<PredictionData>(`${API_BASE_URL}/predict`, { ticker: currentTicker })
            ]);

            if (historyRes.data) {
                setHistoricalData(formatDataForChart(historyRes.data));
            }

            if (predictionRes.data) {
                setPrediction(predictionRes.data);
            }

        } catch (err) {
            console.error('Error fetching data:', err);
            let errorMessage = 'An unexpected error occurred. Check the console for details.';
            if (axios.isAxiosError(err)) {
                const serverError = err as AxiosError<ApiError>;
                if (serverError.response?.data?.message) {
                    errorMessage = serverError.response.data.message;
                }
            }
            setError(`Failed to fetch data for ${currentTicker.toUpperCase()}. ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch data for the default ticker on initial component load
    useEffect(() => {
        handleFetchData('AAPL');
    }, []);

    const onButtonClick = () => {
        handleFetchData(ticker);
    };


    // --- Render ---
    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 p-4 sm:p-6 lg:p-8 font-sans">
            <div className="max-w-7xl mx-auto">

                {/* Header */}
                <header className="mb-8">
                    <h1 className="text-4xl font-bold text-cyan-400">Stock Predictor</h1>
                    <p className="text-gray-400 mt-2">Enter a stock ticker to view its historical performance and get a next-day price prediction.</p>
                </header>

                {/* Input Form */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg mb-8">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTicker(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === 'Enter' && onButtonClick()}
                            placeholder="e.g., AAPL, GOOGL, TSLA"
                            className="flex-grow bg-gray-700 text-white placeholder-gray-400 rounded-md px-4 py-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                        <button
                            onClick={onButtonClick}
                            disabled={isLoading}
                            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-500 text-white font-bold py-3 px-6 rounded-md transition duration-300 ease-in-out transform hover:scale-105 disabled:scale-100"
                        >
                            {isLoading ? 'Loading...' : 'Get Data & Predict'}
                        </button>
                    </div>
                </div>

                {/* Error and Loading States */}
                {error && <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg mb-8">{error}</div>}

                {/* Results Display */}
                {isLoading && <div className="text-center p-8 text-xl">Loading data for {ticker}...</div>}

                {!isLoading && !error && historicalData.length === 0 && (
                    <div className="text-center p-8 bg-gray-800 rounded-lg">
                        <p>No data to display. Please enter a ticker and click "Get Data & Predict".</p>
                    </div>
                )}

                {!isLoading && historicalData.length > 0 && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Prediction Card */}
                        <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h2 className="text-2xl font-semibold mb-4 text-white">Prediction for <span className="text-cyan-400">{ticker}</span></h2>
                            {prediction ? (
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-gray-400">Predicted Next Close</p>
                                        <p className="text-4xl font-bold text-cyan-400">${prediction.predicted_close_price.toFixed(2)}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-400">Last Open Price</p>
                                        <p className="text-2xl text-gray-300">${prediction.last_open_price.toFixed(2)}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 pt-4">Disclaimer: This is a prediction from an LSTM model and should not be used as financial advice.</p>
                                </div>
                            ) : (
                                <p className="text-gray-400">Prediction data not available.</p>
                            )}
                        </div>

                        {/* Chart */}
                        <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg">
                            <h2 className="text-2xl font-semibold mb-6 text-white">Historical Closing Price</h2>
                            <ResponsiveContainer width="100%" height={400}>
                                <LineChart
                                    data={historicalData}
                                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                    <XAxis dataKey="date" stroke="#9CA3AF" />
                                    <YAxis stroke="#9CA3AF" domain={['auto', 'auto']} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: '#1F2937',
                                            borderColor: '#374151'
                                        }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="close" stroke="#22D3EE" strokeWidth={2} dot={false} name="Close Price" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default App;

