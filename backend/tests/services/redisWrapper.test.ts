import {
  predictionKey,
  stockQuoteKey,
  portfolioKey,
  pdmSignalKey,
  newsKey,
} from '../../src/services/redisWrapper';

describe('redisWrapper key generators', () => {
  describe('predictionKey', () => {
    it('should generate a correctly formatted key for a ticker and days', () => {
      const ticker = 'AAPL';
      const days = 30;
      const expected = 'prediction:AAPL:30d';
      expect(predictionKey(ticker, days)).toBe(expected);
    });

    it('should convert lowercase tickers to uppercase', () => {
      const ticker = 'aapl';
      const days = 7;
      const expected = 'prediction:AAPL:7d';
      expect(predictionKey(ticker, days)).toBe(expected);
    });

    it('should handle different day values correctly', () => {
      expect(predictionKey('TSLA', 1)).toBe('prediction:TSLA:1d');
      expect(predictionKey('TSLA', 90)).toBe('prediction:TSLA:90d');
    });
  });

  describe('stockQuoteKey', () => {
    it('should generate a correctly formatted key for a ticker', () => {
      expect(stockQuoteKey('AAPL')).toBe('stock:quote:AAPL');
    });

    it('should convert ticker to uppercase', () => {
      expect(stockQuoteKey('msft')).toBe('stock:quote:MSFT');
    });
  });

  describe('portfolioKey', () => {
    it('should generate a correctly formatted key for a user ID', () => {
      expect(portfolioKey('user123')).toBe('portfolio:user123');
    });

    it('should use "default" as the default user ID', () => {
      expect(portfolioKey()).toBe('portfolio:default');
    });
  });

  describe('pdmSignalKey', () => {
    it('should generate a correctly formatted key for a ticker', () => {
      expect(pdmSignalKey('AAPL')).toBe('pdm:signal:AAPL');
    });

    it('should convert ticker to uppercase', () => {
      expect(pdmSignalKey('tsla')).toBe('pdm:signal:TSLA');
    });
  });

  describe('newsKey', () => {
    it('should generate a correctly formatted key for a ticker', () => {
      expect(newsKey('AAPL')).toBe('news:AAPL');
    });

    it('should generate a market news key when no ticker is provided', () => {
      expect(newsKey()).toBe('news:market');
    });

    it('should convert ticker to uppercase', () => {
      expect(newsKey('nvda')).toBe('news:NVDA');
    });
  });
});
