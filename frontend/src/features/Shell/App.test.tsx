import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/financialDataService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/financialDataService')>();
  return {
    ...actual,
    fetchMarketOverview: vi.fn().mockResolvedValue({
      trending_stocks: [],
      indices: [],
      market_sentiment: { overall: 'Neutral', score: 50 },
      last_updated: new Date().toISOString()
    }),
    fetchMarketHealth: vi.fn().mockResolvedValue({
      service_status: 'healthy',
      timestamp: new Date().toISOString(),
      cached_models_count: 5,
      pdm_engine_status: 'active'
    })
  };
});

// Mock global fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ service_status: 'healthy' }),
  })
) as unknown as typeof fetch;

describe('App', () => {
  it('renders the main application container', async () => {
    render(<App />);

    await waitFor(() => {
      screen.debug();
      const errorText = screen.queryByText(/Something went wrong/i);
      if (errorText) {
        console.log('App crashed!');
      }
      expect(screen.getByRole('main')).toBeInTheDocument();
    });
  });
});
