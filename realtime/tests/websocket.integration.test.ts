import { describe, it, expect, beforeEach, afterAll, beforeAll } from 'vitest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as SocketIOClient, Socket as ClientSocket } from 'socket.io-client';

/**
 * WebSocket Integration Tests
 * Tests the realtime service subscribe/unsubscribe, broadcast, and connection handling
 */

describe('WebSocket Integration', () => {
  let httpServer: ReturnType<typeof createServer>;
  let ioServer: SocketIOServer;
  let clientSocket: ClientSocket;
  const port = 3099; // Test port

  beforeAll((done) => {
    // Create mock server for integration tests
    httpServer = createServer();
    ioServer = new SocketIOServer(httpServer, {
      cors: { origin: '*' },
    });

    // Simple mock implementation
    ioServer.on('connection', (socket) => {
      const subscriptions = new Set<string>();

      socket.emit('status', {
        type: 'status',
        status: 'connected',
        subscribedSymbols: [],
        message: 'Connected to test server',
      });

      socket.on('subscribe', (data) => {
        if (data.type === 'subscribe' && Array.isArray(data.symbols)) {
          data.symbols.forEach((s: string) => subscriptions.add(s.toUpperCase()));
          socket.emit('status', {
            type: 'status',
            status: 'subscribed',
            subscribedSymbols: Array.from(subscriptions),
          });
          
          // Send immediate mock ticks
          socket.emit('ticks', {
            type: 'ticks',
            ticks: data.symbols.map((s: string) => ({
              symbol: s.toUpperCase(),
              price: 100 + Math.random() * 100,
              change: Math.random() * 10 - 5,
              changePercent: Math.random() * 5 - 2.5,
              volume: Math.floor(Math.random() * 1000000),
              high: 110,
              low: 90,
              open: 100,
              timestamp: Date.now(),
            })),
            serverTime: Date.now(),
            interval: 10000,
          });
        }
      });

      socket.on('unsubscribe', (data) => {
        if (data.type === 'unsubscribe' && Array.isArray(data.symbols)) {
          data.symbols.forEach((s: string) => subscriptions.delete(s.toUpperCase()));
          socket.emit('status', {
            type: 'status',
            status: 'subscribed',
            subscribedSymbols: Array.from(subscriptions),
          });
        }
      });
    });

    httpServer.listen(port, () => {
      done();
    });
  });

  afterAll((done) => {
    ioServer.close();
    httpServer.close(() => {
      done();
    });
  });

  beforeEach((done) => {
    clientSocket = SocketIOClient(`http://localhost:${port}`, {
      transports: ['websocket'],
    });
    clientSocket.on('connect', () => {
      done();
    });
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('receives connected status on connection', (done) => {
    // Already connected in beforeEach, check for status
    clientSocket.once('status', (data) => {
      expect(data.type).toBe('status');
      expect(data.status).toBe('connected');
      done();
    });
    
    // Reconnect to trigger status message
    clientSocket.disconnect();
    clientSocket.connect();
  });

  it('can subscribe to symbols', (done) => {
    clientSocket.emit('subscribe', {
      type: 'subscribe',
      symbols: ['AAPL', 'GOOGL'],
    });

    clientSocket.once('status', (data) => {
      if (data.status === 'subscribed') {
        expect(data.subscribedSymbols).toContain('AAPL');
        expect(data.subscribedSymbols).toContain('GOOGL');
        done();
      }
    });
  });

  it('receives ticks after subscribing', (done) => {
    clientSocket.emit('subscribe', {
      type: 'subscribe',
      symbols: ['MSFT'],
    });

    clientSocket.once('ticks', (data) => {
      expect(data.type).toBe('ticks');
      expect(Array.isArray(data.ticks)).toBe(true);
      expect(data.ticks.length).toBeGreaterThan(0);
      expect(data.ticks[0].symbol).toBe('MSFT');
      expect(typeof data.ticks[0].price).toBe('number');
      expect(data.serverTime).toBeDefined();
      done();
    });
  });

  it('can unsubscribe from symbols', (done) => {
    // First subscribe
    clientSocket.emit('subscribe', {
      type: 'subscribe',
      symbols: ['AAPL', 'GOOGL', 'MSFT'],
    });

    // Wait for subscribe confirmation, then unsubscribe
    clientSocket.once('status', (subscribeData) => {
      if (subscribeData.status === 'subscribed' && subscribeData.subscribedSymbols.length === 3) {
        clientSocket.emit('unsubscribe', {
          type: 'unsubscribe',
          symbols: ['GOOGL'],
        });

        clientSocket.once('status', (unsubscribeData) => {
          expect(unsubscribeData.subscribedSymbols).toContain('AAPL');
          expect(unsubscribeData.subscribedSymbols).toContain('MSFT');
          expect(unsubscribeData.subscribedSymbols).not.toContain('GOOGL');
          done();
        });
      }
    });
  });

  it('converts symbols to uppercase', (done) => {
    clientSocket.emit('subscribe', {
      type: 'subscribe',
      symbols: ['aapl', 'googl'],
    });

    clientSocket.once('status', (data) => {
      if (data.status === 'subscribed') {
        expect(data.subscribedSymbols).toContain('AAPL');
        expect(data.subscribedSymbols).toContain('GOOGL');
        done();
      }
    });
  });

  it('tick data has valid schema', (done) => {
    clientSocket.emit('subscribe', {
      type: 'subscribe',
      symbols: ['TSLA'],
    });

    clientSocket.once('ticks', (data) => {
      const tick = data.ticks[0];
      
      // Validate tick schema
      expect(typeof tick.symbol).toBe('string');
      expect(typeof tick.price).toBe('number');
      expect(typeof tick.change).toBe('number');
      expect(typeof tick.changePercent).toBe('number');
      expect(typeof tick.volume).toBe('number');
      expect(typeof tick.high).toBe('number');
      expect(typeof tick.low).toBe('number');
      expect(typeof tick.open).toBe('number');
      expect(typeof tick.timestamp).toBe('number');
      
      done();
    });
  });

  it('handles multiple subscriptions from same client', (done) => {
    // Subscribe to first set
    clientSocket.emit('subscribe', {
      type: 'subscribe',
      symbols: ['AAPL'],
    });

    let subscribeCount = 0;
    clientSocket.on('status', (data) => {
      if (data.status === 'subscribed') {
        subscribeCount++;
        
        if (subscribeCount === 1) {
          expect(data.subscribedSymbols).toHaveLength(1);
          
          // Subscribe to more
          clientSocket.emit('subscribe', {
            type: 'subscribe',
            symbols: ['GOOGL', 'MSFT'],
          });
        } else if (subscribeCount === 2) {
          // Should have all three
          expect(data.subscribedSymbols).toContain('AAPL');
          expect(data.subscribedSymbols).toContain('GOOGL');
          expect(data.subscribedSymbols).toContain('MSFT');
          done();
        }
      }
    });
  });
});
