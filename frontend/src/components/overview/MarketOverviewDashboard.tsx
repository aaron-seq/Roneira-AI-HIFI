/**
 * Market Overview Dashboard Component
 *
 * Displays a real-time snapshot of market indices and top-performing stocks
 *
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { FinancialDataService } from '../../services/financialDataService';
import { ApplicationConfiguration } from '../../config/applicationConfig';
import { LoadingSpinner } from '../ui/LoadingSpinner';

const applicationConfig = new ApplicationConfiguration();
const financialDataService = new FinancialDataService(applicationConfig.apiBaseUrl);

export const MarketOverviewDashboard: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['marketOverview'],
    queryFn: () => financialDataService.getMarketOverview(),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500">
        <h2 className="text-2xl font-bold">Error</h2>
        <p>{error.message}</p>
      </div>
    );
  }

  return (
    <div className="text-white">
      <h1 className="text-3xl font-bold">Market Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {data?.indices.map((index: any) => (
          <div key={index.name} className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-bold">{index.name}</h3>
            <p className="text-2xl font-bold">{index.value}</p>
            <p className={`text-${index.change.startsWith('-') ? 'red' : 'green'}-500`}>
              {index.change}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <h2 className="text-2xl font-bold">Top Performing Stocks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          {data?.topPerformers.map((stock: any) => (
            <div key={stock.ticker} className="bg-gray-800 p-4 rounded-lg">
              <h3 className="text-lg font-bold">{stock.ticker}</h3>
              <p className="text-2xl font-bold">{stock.price}</p>
              <p className={`text-${stock.change.startsWith('-') ? 'red' : 'green'}-500`}>
                {stock.change}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
