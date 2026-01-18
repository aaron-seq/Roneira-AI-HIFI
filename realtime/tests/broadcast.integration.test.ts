import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Server, Socket } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { createServer, Server as HttpServer } from 'http';
import { 
  TickDataSchema, 
  TickUpdateMessageSchema,
  ConnectionStatusSchema 
} from '../src/schemas';

/**
 * WebSocket Broadcast & Tick Delivery Integration Tests
 * Tests the real-time tick broadcasting and delivery mechanisms
 */
describe('WebSocket Broadcast Integration Tests', () => {
  let httpServer: HttpServer;
  let ioServer: Server;
  let port: number;
  let clientSockets: ClientSocket[] = [];

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      httpServer = createServer();
      ioServer = new Server(httpServer, {
        cors: { origin: '*' },
        transports: ['websocket'],
      });

      // Set up server handlers
      ioServer.on('connection', (socket: Socket) => {
        const subscribedSymbols: Set<string> = new Set();

        // Send connected status
        socket.emit('status', {
          type: 'status',
          status: 'connected',
        });

        // Handle subscribe
        socket.on('subscribe', (data: { symbols: string[] }) => {
          if (data.symbols) {
            data.symbols.forEach((s: string) => subscribedSymbols.add(s.toUpperCase()));
            
            // Join rooms for each symbol
            data.symbols.forEach((s: string) => socket.join(s.toUpperCase()));
            
            socket.emit('status', {
              type: 'status',
              status: 'subscribed',
              subscribedSymbols: Array.from(subscribedSymbols),
            });
          }
        });

        // Handle unsubscribe
        socket.on('unsubscribe', (data: { symbols: string[] }) => {
          if (data.symbols) {
            data.symbols.forEach((s: string) => {
              subscribedSymbols.delete(s.toUpperCase());
              socket.leave(s.toUpperCase());
            });
            
            socket.emit('status', {
              type: 'status',
              status: 'subscribed',
              subscribedSymbols: Array.from(subscribedSymbols),
            });
          }
        });
      });

      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          port = address.port;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    // Disconnect all clients
    for (const socket of clientSockets) {
      socket.disconnect();
    }
    clientSockets = [];

    // Close server
    await new Promise<void>((resolve) => {
      ioServer.close(() => resolve());
    });
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  const createClient = (): Promise<ClientSocket> => {
    return new Promise((resolve) => {
      const client = ioc(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: true,
      });
      
      client.on('connect', () => {
        clientSockets.push(client);
        resolve(client);
      });
    });
  };

  describe('Broadcast to Subscribed Clients', () => {
    it('should broadcast ticks only to subscribed clients', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      // Subscribe client1 to AAPL
      client1.emit('subscribe', { symbols: ['AAPL'] });
      
      // Subscribe client2 to NVDA
      client2.emit('subscribe', { symbols: ['NVDA'] });

      // Wait for subscriptions
      await new Promise(resolve => setTimeout(resolve, 100));

      // Track received messages
      const client1Messages: any[] = [];
      const client2Messages: any[] = [];

      client1.on('ticks', (msg: any) => client1Messages.push(msg));
      client2.on('ticks', (msg: any) => client2Messages.push(msg));

      // Broadcast AAPL tick to AAPL room
      ioServer.to('AAPL').emit('ticks', {
        type: 'ticks',
        ticks: [{ symbol: 'AAPL', price: 195.50, change: 2.0, changePercent: 1.0, volume: 1000000, high: 196, low: 194, open: 195, timestamp: Date.now() }],
        serverTime: Date.now(),
        interval: 10000,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Client1 should receive AAPL tick
      expect(client1Messages.length).toBeGreaterThan(0);
      expect(client1Messages[0].ticks[0].symbol).toBe('AAPL');

      // Client2 should not receive AAPL tick
      expect(client2Messages.length).toBe(0);

      client1.disconnect();
      client2.disconnect();
    });

    it('should broadcast to multiple clients subscribed to same symbol', async () => {
      const client1 = await createClient();
      const client2 = await createClient();

      // Both subscribe to TSLA
      client1.emit('subscribe', { symbols: ['TSLA'] });
      client2.emit('subscribe', { symbols: ['TSLA'] });

      await new Promise(resolve => setTimeout(resolve, 100));

      const client1Messages: any[] = [];
      const client2Messages: any[] = [];

      client1.on('ticks', (msg: any) => client1Messages.push(msg));
      client2.on('ticks', (msg: any) => client2Messages.push(msg));

      // Broadcast TSLA tick
      ioServer.to('TSLA').emit('ticks', {
        type: 'ticks',
        ticks: [{ symbol: 'TSLA', price: 265.75, change: -3.25, changePercent: -1.21, volume: 82000000, high: 272, low: 263, open: 270, timestamp: Date.now() }],
        serverTime: Date.now(),
        interval: 10000,
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Both clients should receive
      expect(client1Messages.length).toBeGreaterThan(0);
      expect(client2Messages.length).toBeGreaterThan(0);

      client1.disconnect();
      client2.disconnect();
    });
  });

  describe('Tick Delivery Validation', () => {
    it('should deliver ticks that conform to TickUpdateMessage schema', async () => {
      const client = await createClient();
      
      client.emit('subscribe', { symbols: ['GOOGL'] });
      await new Promise(resolve => setTimeout(resolve, 100));

      const receivedTicks: any[] = [];
      client.on('ticks', (msg: any) => receivedTicks.push(msg));

      // Broadcast valid tick
      const tickMessage = {
        type: 'ticks',
        ticks: [{ 
          symbol: 'GOOGL', 
          price: 175.30, 
          change: 1.85, 
          changePercent: 1.07, 
          volume: 24560000, 
          high: 177.00, 
          low: 173.50, 
          open: 174.00, 
          timestamp: Date.now() 
        }],
        serverTime: Date.now(),
        interval: 10000,
      };

      ioServer.to('GOOGL').emit('ticks', tickMessage);
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedTicks.length).toBe(1);
      
      // Validate against schema
      const result = TickUpdateMessageSchema.safeParse(receivedTicks[0]);
      expect(result.success).toBe(true);

      client.disconnect();
    });

    it('should deliver individual tick data conforming to TickData schema', async () => {
      const client = await createClient();
      
      client.emit('subscribe', { symbols: ['META'] });
      await new Promise(resolve => setTimeout(resolve, 100));

      const receivedTicks: any[] = [];
      client.on('ticks', (msg: any) => receivedTicks.push(msg));

      const tickData = { 
        symbol: 'META', 
        price: 505.20, 
        change: 8.35, 
        changePercent: 1.68, 
        volume: 18340000, 
        high: 508.90, 
        low: 498.50, 
        open: 500.00, 
        timestamp: Date.now() 
      };

      ioServer.to('META').emit('ticks', {
        type: 'ticks',
        ticks: [tickData],
        serverTime: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      expect(receivedTicks.length).toBe(1);
      
      // Validate individual tick
      const tickResult = TickDataSchema.safeParse(receivedTicks[0].ticks[0]);
      expect(tickResult.success).toBe(true);

      client.disconnect();
    });
  });

  describe('Multi-Symbol Subscription', () => {
    it('should receive ticks for all subscribed symbols', async () => {
      const client = await createClient();
      
      client.emit('subscribe', { symbols: ['AAPL', 'NVDA', 'MSFT'] });
      await new Promise(resolve => setTimeout(resolve, 100));

      const receivedTicks: any[] = [];
      client.on('ticks', (msg: any) => receivedTicks.push(msg));

      // Broadcast to each symbol
      ['AAPL', 'NVDA', 'MSFT'].forEach(symbol => {
        ioServer.to(symbol).emit('ticks', {
          type: 'ticks',
          ticks: [{ symbol, price: 100, change: 1, changePercent: 1, volume: 1000, high: 101, low: 99, open: 100, timestamp: Date.now() }],
          serverTime: Date.now(),
        });
      });

      await new Promise(resolve => setTimeout(resolve, 200));

      // Should receive 3 tick messages
      expect(receivedTicks.length).toBe(3);
      
      const symbols = receivedTicks.map(t => t.ticks[0].symbol);
      expect(symbols).toContain('AAPL');
      expect(symbols).toContain('NVDA');
      expect(symbols).toContain('MSFT');

      client.disconnect();
    });

    it('should stop receiving ticks after unsubscribe', async () => {
      const client = await createClient();
      
      client.emit('subscribe', { symbols: ['AMD'] });
      await new Promise(resolve => setTimeout(resolve, 100));

      const receivedBefore: any[] = [];
      const tickHandler = (msg: any) => receivedBefore.push(msg);
      client.on('ticks', tickHandler);

      // Send first tick
      ioServer.to('AMD').emit('ticks', {
        type: 'ticks',
        ticks: [{ symbol: 'AMD', price: 165.40, change: -2.10, changePercent: -1.25, volume: 52000000, high: 169, low: 164, open: 167, timestamp: Date.now() }],
        serverTime: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(receivedBefore.length).toBe(1);

      // Unsubscribe
      client.emit('unsubscribe', { symbols: ['AMD'] });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send second tick
      ioServer.to('AMD').emit('ticks', {
        type: 'ticks',
        ticks: [{ symbol: 'AMD', price: 166.00, change: -1.50, changePercent: -0.90, volume: 53000000, high: 170, low: 165, open: 167, timestamp: Date.now() }],
        serverTime: Date.now(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should still only have 1 tick (no new ticks after unsubscribe)
      expect(receivedBefore.length).toBe(1);

      client.disconnect();
    });
  });

  describe('Connection Status Messages', () => {
    it('should send valid connection status on subscribe', async () => {
      const client = await createClient();
      
      const statusMessages: any[] = [];
      client.on('status', (msg: any) => statusMessages.push(msg));

      // Wait for initial connected status
      await new Promise(resolve => setTimeout(resolve, 100));
      
      client.emit('subscribe', { symbols: ['INTC'] });
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should have at least 2 status messages (connected + subscribed)
      expect(statusMessages.length).toBeGreaterThanOrEqual(2);

      // Validate status messages against schema
      for (const status of statusMessages) {
        const result = ConnectionStatusSchema.safeParse(status);
        expect(result.success).toBe(true);
      }

      // Last status should be subscribed with symbols
      const lastStatus = statusMessages[statusMessages.length - 1];
      expect(lastStatus.status).toBe('subscribed');
      expect(lastStatus.subscribedSymbols).toContain('INTC');

      client.disconnect();
    });
  });
});
