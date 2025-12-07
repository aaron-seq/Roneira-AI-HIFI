/**
 * News Dashboard Component
 *
 * Displays real-time market news and sentiment analysis
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Newspaper, ExternalLink, Clock } from 'lucide-react';
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
    const { data: news, isLoading, error } = useQuery<NewsItem[]>({
        queryKey: ['marketNews'],
        queryFn: fetchMarketNews,
        refetchInterval: 300000, // 5 minutes
    });

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
                <Newspaper className="w-8 h-8 text-gold-500" />
                <h2 className="text-2xl font-bold text-white">Market Intelligence</h2>
            </div>

            <div className="grid gap-6">
                {news && news.length > 0 ? (
                    news.map((item) => (
                        <div key={item.id} className="bg-gray-800 border border-gray-700 p-6 rounded-lg hover:border-gold-500/50 transition-colors group">
                            <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-semibold px-2 py-1 bg-gray-700 text-gold-400 rounded uppercase tracking-wider">
                                    {item.source}
                                </span>
                                <span className={`text-xs font-medium px-2 py-1 rounded ${item.sentiment === 'Positive' ? 'bg-green-900/30 text-green-400' :
                                    item.sentiment === 'Negative' ? 'bg-red-900/30 text-red-400' :
                                        'bg-gray-700 text-gray-400'
                                    }`}>
                                    {item.sentiment}
                                </span>
                            </div>

                            <h3 className="text-xl font-bold text-white mb-2 group-hover:text-gold-400 transition-colors">
                                {item.title}
                            </h3>

                            <p className="text-gray-400 mb-4 line-clamp-2">
                                {item.summary}
                            </p>

                            <div className="flex justify-between items-center text-sm text-gray-500">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                                </div>
                                <button className="flex items-center gap-1 text-gold-500 hover:text-gold-400 font-medium md:opacity-0 group-hover:opacity-100 transition-opacity">
                                    Read Analysis <ExternalLink className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center text-gray-500 py-12">
                        No recent news available
                    </div>
                )}
            </div>
        </div>
    );
};
