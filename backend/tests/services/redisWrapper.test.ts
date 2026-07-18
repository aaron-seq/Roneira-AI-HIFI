import { stockQuoteKey, predictionKey } from '../../src/services/redisWrapper';

describe('redisWrapper cache key generators', () => {
  describe('stockQuoteKey', () => {
    it('should generate the correct key for a lowercase ticker', () => {
      expect(stockQuoteKey('aapl')).toBe('stock:quote:AAPL');
    });

    it('should generate the correct key for an uppercase ticker', () => {
      expect(stockQuoteKey('MSFT')).toBe('stock:quote:MSFT');
    });

    it('should generate the correct key for a mixed case ticker', () => {
      expect(stockQuoteKey('gOoG')).toBe('stock:quote:GOOG');
    });
  });

  describe('predictionKey', () => {
    it('should generate the correct key for a lowercase ticker and positive days', () => {
      expect(predictionKey('aapl', 30)).toBe('prediction:AAPL:30d');
    });

    it('should generate the correct key for an uppercase ticker and zero days', () => {
      expect(predictionKey('MSFT', 0)).toBe('prediction:MSFT:0d');
    });

    it('should generate the correct key for a mixed case ticker and negative days', () => {
      expect(predictionKey('tSlA', -7)).toBe('prediction:TSLA:-7d');
    });
  });
});
