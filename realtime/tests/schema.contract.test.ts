import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  TickDataSchema,
  TickUpdateMessageSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  HeartbeatMessageSchema,
  ConnectionStatusSchema,
  ErrorMessageSchema,
  ServerMessageSchema,
  ClientMessageSchema,
} from '../src/schemas';

/**
 * WebSocket Contract Tests
 * Validates payloads against Zod schemas to ensure type safety
 */
describe('WebSocket Zod Schema Contract Tests', () => {
  describe('TickDataSchema', () => {
    it('should validate a valid tick data object', () => {
      const validTick = {
        symbol: 'AAPL',
        price: 195.50,
        change: 2.35,
        changePercent: 1.22,
        volume: 45000000,
        high: 197.20,
        low: 193.10,
        open: 194.00,
        timestamp: Date.now(),
      };

      const result = TickDataSchema.safeParse(validTick);
      expect(result.success).toBe(true);
    });

    it('should reject tick with empty symbol', () => {
      const invalidTick = {
        symbol: '',
        price: 195.50,
        change: 2.35,
        changePercent: 1.22,
        volume: 45000000,
        high: 197.20,
        low: 193.10,
        open: 194.00,
        timestamp: Date.now(),
      };

      const result = TickDataSchema.safeParse(invalidTick);
      expect(result.success).toBe(false);
    });

    it('should reject tick with negative price', () => {
      const invalidTick = {
        symbol: 'AAPL',
        price: -100,
        change: 2.35,
        changePercent: 1.22,
        volume: 45000000,
        high: 197.20,
        low: 193.10,
        open: 194.00,
        timestamp: Date.now(),
      };

      const result = TickDataSchema.safeParse(invalidTick);
      expect(result.success).toBe(false);
    });

    it('should reject tick with negative volume', () => {
      const invalidTick = {
        symbol: 'AAPL',
        price: 195.50,
        change: 2.35,
        changePercent: 1.22,
        volume: -1000,
        high: 197.20,
        low: 193.10,
        open: 194.00,
        timestamp: Date.now(),
      };

      const result = TickDataSchema.safeParse(invalidTick);
      expect(result.success).toBe(false);
    });

    it('should reject tick with symbol too long', () => {
      const invalidTick = {
        symbol: 'VERYLONGSYMBOL',
        price: 195.50,
        change: 2.35,
        changePercent: 1.22,
        volume: 45000000,
        high: 197.20,
        low: 193.10,
        open: 194.00,
        timestamp: Date.now(),
      };

      const result = TickDataSchema.safeParse(invalidTick);
      expect(result.success).toBe(false);
    });

    it('should allow negative change values', () => {
      const validTick = {
        symbol: 'AAPL',
        price: 190.50,
        change: -5.00,
        changePercent: -2.55,
        volume: 45000000,
        high: 197.20,
        low: 189.10,
        open: 195.00,
        timestamp: Date.now(),
      };

      const result = TickDataSchema.safeParse(validTick);
      expect(result.success).toBe(true);
    });
  });

  describe('TickUpdateMessageSchema', () => {
    it('should validate a valid tick update message', () => {
      const validMessage = {
        type: 'ticks',
        ticks: [
          {
            symbol: 'AAPL',
            price: 195.50,
            change: 2.35,
            changePercent: 1.22,
            volume: 45000000,
            high: 197.20,
            low: 193.10,
            open: 194.00,
            timestamp: Date.now(),
          },
        ],
        serverTime: Date.now(),
        interval: 10000,
      };

      const result = TickUpdateMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should reject message with wrong type', () => {
      const invalidMessage = {
        type: 'invalid',
        ticks: [],
        serverTime: Date.now(),
      };

      const result = TickUpdateMessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });

    it('should allow empty ticks array', () => {
      const validMessage = {
        type: 'ticks',
        ticks: [],
        serverTime: Date.now(),
      };

      const result = TickUpdateMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });
  });

  describe('SubscribeRequestSchema', () => {
    it('should validate a valid subscribe request', () => {
      const validRequest = {
        type: 'subscribe',
        symbols: ['AAPL', 'NVDA', 'TSLA'],
      };

      const result = SubscribeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject empty symbols array', () => {
      const invalidRequest = {
        type: 'subscribe',
        symbols: [],
      };

      const result = SubscribeRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject too many symbols (>50)', () => {
      const invalidRequest = {
        type: 'subscribe',
        symbols: Array(51).fill('AAPL'),
      };

      const result = SubscribeRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should validate single symbol subscription', () => {
      const validRequest = {
        type: 'subscribe',
        symbols: ['AAPL'],
      };

      const result = SubscribeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });
  });

  describe('UnsubscribeRequestSchema', () => {
    it('should validate a valid unsubscribe request', () => {
      const validRequest = {
        type: 'unsubscribe',
        symbols: ['AAPL'],
      };

      const result = UnsubscribeRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should reject wrong type', () => {
      const invalidRequest = {
        type: 'subscribe',
        symbols: ['AAPL'],
      };

      const result = UnsubscribeRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });
  });

  describe('HeartbeatMessageSchema', () => {
    it('should validate a valid heartbeat message', () => {
      const validMessage = {
        type: 'heartbeat',
        serverTime: Date.now(),
      };

      const result = HeartbeatMessageSchema.safeParse(validMessage);
      expect(result.success).toBe(true);
    });

    it('should reject heartbeat without serverTime', () => {
      const invalidMessage = {
        type: 'heartbeat',
      };

      const result = HeartbeatMessageSchema.safeParse(invalidMessage);
      expect(result.success).toBe(false);
    });
  });

  describe('ConnectionStatusSchema', () => {
    it('should validate connected status', () => {
      const validStatus = {
        type: 'status',
        status: 'connected',
      };

      const result = ConnectionStatusSchema.safeParse(validStatus);
      expect(result.success).toBe(true);
    });

    it('should validate subscribed status with symbols', () => {
      const validStatus = {
        type: 'status',
        status: 'subscribed',
        subscribedSymbols: ['AAPL', 'NVDA'],
      };

      const result = ConnectionStatusSchema.safeParse(validStatus);
      expect(result.success).toBe(true);
    });

    it('should validate error status with message', () => {
      const validStatus = {
        type: 'status',
        status: 'error',
        message: 'Connection failed',
      };

      const result = ConnectionStatusSchema.safeParse(validStatus);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status value', () => {
      const invalidStatus = {
        type: 'status',
        status: 'unknown',
      };

      const result = ConnectionStatusSchema.safeParse(invalidStatus);
      expect(result.success).toBe(false);
    });
  });

  describe('ErrorMessageSchema', () => {
    it('should validate a valid error message', () => {
      const validError = {
        type: 'error',
        code: 'INVALID_SYMBOL',
        message: 'The symbol provided is invalid',
      };

      const result = ErrorMessageSchema.safeParse(validError);
      expect(result.success).toBe(true);
    });

    it('should reject error without code', () => {
      const invalidError = {
        type: 'error',
        message: 'An error occurred',
      };

      const result = ErrorMessageSchema.safeParse(invalidError);
      expect(result.success).toBe(false);
    });
  });

  describe('ServerMessageSchema (discriminated union)', () => {
    it('should correctly identify tick message', () => {
      const tickMessage = {
        type: 'ticks',
        ticks: [],
        serverTime: Date.now(),
      };

      const result = ServerMessageSchema.safeParse(tickMessage);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('ticks');
      }
    });

    it('should correctly identify heartbeat message', () => {
      const heartbeat = {
        type: 'heartbeat',
        serverTime: Date.now(),
      };

      const result = ServerMessageSchema.safeParse(heartbeat);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('heartbeat');
      }
    });

    it('should correctly identify status message', () => {
      const status = {
        type: 'status',
        status: 'connected',
      };

      const result = ServerMessageSchema.safeParse(status);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('status');
      }
    });

    it('should correctly identify error message', () => {
      const error = {
        type: 'error',
        code: 'TEST',
        message: 'Test error',
      };

      const result = ServerMessageSchema.safeParse(error);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('error');
      }
    });

    it('should reject unknown message type', () => {
      const unknown = {
        type: 'unknown',
        data: 'something',
      };

      const result = ServerMessageSchema.safeParse(unknown);
      expect(result.success).toBe(false);
    });
  });

  describe('ClientMessageSchema (discriminated union)', () => {
    it('should correctly identify subscribe request', () => {
      const subscribe = {
        type: 'subscribe',
        symbols: ['AAPL'],
      };

      const result = ClientMessageSchema.safeParse(subscribe);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('subscribe');
      }
    });

    it('should correctly identify unsubscribe request', () => {
      const unsubscribe = {
        type: 'unsubscribe',
        symbols: ['AAPL'],
      };

      const result = ClientMessageSchema.safeParse(unsubscribe);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('unsubscribe');
      }
    });

    it('should reject unknown client message type', () => {
      const unknown = {
        type: 'heartbeat', // Not a valid client message
        serverTime: Date.now(),
      };

      const result = ClientMessageSchema.safeParse(unknown);
      expect(result.success).toBe(false);
    });
  });

  describe('Real-world payload simulation', () => {
    it('should validate a complete tick broadcast scenario', () => {
      // Simulate multiple ticks from different symbols
      const broadcast = {
        type: 'ticks',
        ticks: [
          { symbol: 'AAPL', price: 195.50, change: 2.35, changePercent: 1.22, volume: 45000000, high: 197.20, low: 193.10, open: 194.00, timestamp: Date.now() },
          { symbol: 'NVDA', price: 875.80, change: 15.60, changePercent: 1.81, volume: 38760000, high: 882.40, low: 862.00, open: 860.00, timestamp: Date.now() },
          { symbol: 'TSLA', price: 265.75, change: -3.25, changePercent: -1.21, volume: 82450000, high: 272.50, low: 263.00, open: 270.00, timestamp: Date.now() },
        ],
        serverTime: Date.now(),
        interval: 10000,
      };

      const result = TickUpdateMessageSchema.safeParse(broadcast);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.ticks.length).toBe(3);
      }
    });

    it('should validate max subscription (50 symbols)', () => {
      const maxSubscription = {
        type: 'subscribe',
        symbols: Array(50).fill(null).map((_, i) => `SYM${i}`),
      };

      const result = SubscribeRequestSchema.safeParse(maxSubscription);
      expect(result.success).toBe(true);
    });
  });
});
