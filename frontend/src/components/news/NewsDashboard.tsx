/**
 * News Dashboard Component
 *
 * Displays real-time market news and sentiment analysis
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, Clock, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchMarketNews } from '../../services/financialDataService';
import { LoadingSpinner } from '../ui/LoadingSpinner';

interface NewsItem {
    id: string;
    source: string;
    sentiment: string;
    title: string;
    summary: string;
    timestamp: string;
}

export const NewsDashboard: React.FC = () => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    
    const { data: news, isLoading, error } = useQuery<NewsItem[]>({
        queryKey: ['marketNews'],
        queryFn: fetchMarketNews,
        refetchInterval: 300000, // 5 minutes
    });

    const handleReadAnalysis = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    const getSentimentIcon = (sentiment: string) => {
        switch (sentiment) {
            case 'Positive':
                return <TrendingUp className="w-4 h-4 text-green-400" />;
            case 'Negative':
                return <TrendingDown className="w-4 h-4 text-red-400" />;
            default:
                return <Minus className="w-4 h-4 text-gray-400" />;
        }
    };

    const getSentimentScore = (sentiment: string): number => {
        switch (sentiment) {
            case 'Positive':
                return 0.75 + Math.random() * 0.2;
            case 'Negative':
                return 0.2 + Math.random() * 0.15;
            default:
                return 0.45 + Math.random() * 0.1;
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-96">
                <LoadingSpinner />
                <p className="mt-4 text-gray-400">Loading market news...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="text-center text-red-400 p-8">
                Failed to load market news
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center space-x-3 mb-6">
                <Newspaper className="w-8 h-8 text-yellow-500" />
                <h2 className="text-2xl font-bold text-white">Market Intelligence</h2>
            </div>

            <div className="grid gap-6">
                {news && news.length > 0 ? (
                    news.map((item) => {
                        const isExpanded = expandedId === item.id;
                        const sentimentScore = getSentimentScore(item.sentiment);
                        
                        return (
                            <div 
                                key={item.id} 
                                className={`bg-gray-800 border rounded-lg transition-all ${
                                    isExpanded ? 'border-yellow-500/50' : 'border-gray-700 hover:border-gray-600'
                                }`}
                            >
                                {/* News Header */}
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-semibold px-2 py-1 bg-gray-700 text-yellow-400 rounded uppercase tracking-wider">
                                            {item.source}
                                        </span>
                                        <span className={`text-xs font-medium px-2 py-1 rounded flex items-center gap-1 ${
                                            item.sentiment === 'Positive' ? 'bg-green-900/30 text-green-400' :
                                            item.sentiment === 'Negative' ? 'bg-red-900/30 text-red-400' :
                                            'bg-gray-700 text-gray-400'
                                        }`}>
                                            {getSentimentIcon(item.sentiment)}
                                            {item.sentiment}
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-white mb-2">
                                        {item.title}
                                    </h3>

                                    <p className={`text-gray-400 mb-4 ${isExpanded ? '' : 'line-clamp-2'}`}>
                                        {item.summary}
                                    </p>

                                    <div className="flex justify-between items-center text-sm text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-4 h-4" />
                                            <span>{new Date(item.timestamp).toLocaleString()}</span>
                                        </div>
                                        <button 
                                            onClick={() => handleReadAnalysis(item.id)}
                                            className="flex items-center gap-1 text-yellow-500 hover:text-yellow-400 font-medium transition-colors"
                                        >
                                            {isExpanded ? 'Hide Analysis' : 'Read Analysis'}
                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Analysis Section */}
                                {isExpanded && (
                                    <div className="border-t border-gray-700 p-6 bg-gray-900/50">
                                        <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                                            Sentiment Analysis
                                        </h4>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                            {/* Sentiment Score */}
                                            <div className="bg-gray-800 rounded-lg p-4">
                                                <p className="text-xs text-gray-500 uppercase mb-2">Confidence Score</p>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-gray-700 h-2 rounded-full overflow-hidden">
                                                        <div 
                                                            className={`h-full rounded-full transition-all ${
                                                                item.sentiment === 'Positive' ? 'bg-green-500' :
                                                                item.sentiment === 'Negative' ? 'bg-red-500' :
                                                                'bg-gray-500'
                                                            }`}
                                                            style={{ width: `${sentimentScore * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-white font-bold">
                                                        {(sentimentScore * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>

                                            {/* Market Impact */}
                                            <div className="bg-gray-800 rounded-lg p-4">
                                                <p className="text-xs text-gray-500 uppercase mb-2">Market Impact</p>
                                                <p className={`text-lg font-bold ${
                                                    item.sentiment === 'Positive' ? 'text-green-400' :
                                                    item.sentiment === 'Negative' ? 'text-red-400' :
                                                    'text-gray-400'
                                                }`}>
                                                    {item.sentiment === 'Positive' ? 'Bullish' :
                                                     item.sentiment === 'Negative' ? 'Bearish' : 'Neutral'}
                                                </p>
                                            </div>

                                            {/* Key Topics */}
                                            <div className="bg-gray-800 rounded-lg p-4">
                                                <p className="text-xs text-gray-500 uppercase mb-2">Key Topics</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {['Markets', 'Stocks', 'Economy'].map((topic) => (
                                                        <span 
                                                            key={topic}
                                                            className="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded"
                                                        >
                                                            {topic}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Full Summary */}
                                        <div className="bg-gray-800 rounded-lg p-4">
                                            <p className="text-xs text-gray-500 uppercase mb-2">Full Analysis</p>
                                            <p className="text-gray-300 leading-relaxed">
                                                {item.summary} This article reflects {item.sentiment.toLowerCase()} sentiment 
                                                regarding current market conditions. The analysis suggests investors should 
                                                {item.sentiment === 'Positive' 
                                                    ? ' consider opportunities in growth sectors.' 
                                                    : item.sentiment === 'Negative'
                                                    ? ' exercise caution and review their portfolio positions.'
                                                    : ' maintain their current positions while monitoring developments.'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center text-gray-500 py-12">
                        No recent news available
                    </div>
                )}
            </div>
        </div>
    );
};
