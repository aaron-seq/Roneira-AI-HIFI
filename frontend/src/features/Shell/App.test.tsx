import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../services/financialDataService', () => {
  const FinancialDataService = vi.fn();
  FinancialDataService.prototype.checkSystemHealth = vi.fn().mockResolvedValue({ service_status: 'healthy' });
  FinancialDataService.prototype.getMarketOverview = vi.fn().mockResolvedValue({
    indices: [],
    topPerformers: [],
  });
  return { FinancialDataService };
});

describe('App', () => {
  it('renders the main application container', async () => {
    render(<App />);

    await waitFor(() => {
      const mainContainer = screen.getByRole('main');
      expect(mainContainer).toBeInTheDocument();
    });
  });
});
