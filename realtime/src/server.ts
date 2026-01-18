import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { 
  SubscribeRequestSchema, 
  UnsubscribeRequestSchema,
  TickUpdateMessage,
  HeartbeatMessage,
  ConnectionStatus,
  ErrorMessage,
} from './schemas';
import { generateTicks } from './tickGenerator';

dotenv.config();

// ============================================
// CONFIGURATION
// ============================================

const PORT = parseInt(process.env.WS_PORT || '3002', 10);
const TICK_INTERVAL_MS = parseInt(process.env.TICK_INTERVAL_MS || '10000', 10); // 10 seconds
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS || '30000', 10); // 30 seconds

// ============================================
// SERVER SETUP
// ============================================

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Track subscriptions per client
const clientSubscriptions: Map<string, Set<string>> = new Map();

// Track all active subscriptions for efficient broadcasting
const symbolSubscribers: Map<string, Set<string>> = new Map();

// ============================================
// TICK BROADCASTING
// ============================================

/**
 * Broadcast ticks to subscribed clients every TICK_INTERVAL_MS
 */
const tickInterval = setInterval(() => {
  // Get all unique symbols that have subscribers
  const activeSymbols = Array.from(symbolSubscribers.keys()).filter(
    (symbol) => (symbolSubscribers.get(symbol)?.size || 0) > 0
  );
  
  if (activeSymbols.length === 0) return;
  
  // Generate ticks for all active symbols
  const ticks = generateTicks(activeSymbols);
  
  // Send to each client only their subscribed symbols
  clientSubscriptions.forEach((symbols, clientId) => {
    const clientTicks = ticks.filter((tick) => symbols.has(tick.symbol));
    
    if (clientTicks.length > 0) {
      const message: TickUpdateMessage = {
        type: 'ticks',
        ticks: clientTicks,
        serverTime: Date.now(),
        interval: TICK_INTERVAL_MS,
      };
      
      io.to(clientId).emit('ticks', message);
    }
  });
  
  console.log(`[Tick] Broadcast ${ticks.length} symbols to ${clientSubscriptions.size} clients`);
}, TICK_INTERVAL_MS);

/**
 * Heartbeat for connection health
 */
const heartbeatInterval = setInterval(() => {
  const message: HeartbeatMessage = {
    type: 'heartbeat',
    serverTime: Date.now(),
  };
  io.emit('heartbeat', message);
}, HEARTBEAT_INTERVAL_MS);

// ============================================
// CONNECTION HANDLING
// ============================================

io.on('connection', (socket: Socket) => {
  const clientId = socket.id;
  console.log(`[Connect] Client connected: ${clientId}`);
  
  // Initialize client subscription set
  clientSubscriptions.set(clientId, new Set());
  
  // Send connection status
  const statusMessage: ConnectionStatus = {
    type: 'status',
    status: 'connected',
    subscribedSymbols: [],
    message: 'Connected to Roneira realtime service',
  };
  socket.emit('status', statusMessage);
  
  // Handle subscribe
  socket.on('subscribe', (data: unknown) => {
    try {
      const parsed = SubscribeRequestSchema.parse(data);
      const clientSymbols = clientSubscriptions.get(clientId) || new Set();
      
      parsed.symbols.forEach((symbol) => {
        const upperSymbol = symbol.toUpperCase();
        clientSymbols.add(upperSymbol);
        
        // Add to global symbol subscribers
        if (!symbolSubscribers.has(upperSymbol)) {
          symbolSubscribers.set(upperSymbol, new Set());
        }
        symbolSubscribers.get(upperSymbol)?.add(clientId);
      });
      
      clientSubscriptions.set(clientId, clientSymbols);
      
      const subscribeStatus: ConnectionStatus = {
        type: 'status',
        status: 'subscribed',
        subscribedSymbols: Array.from(clientSymbols),
        message: `Subscribed to ${parsed.symbols.length} symbols`,
      };
      socket.emit('status', subscribeStatus);
      
      console.log(`[Subscribe] ${clientId} subscribed to: ${parsed.symbols.join(', ')}`);
      
      // Send immediate tick for new subscriptions
      const immediateTicks = generateTicks(parsed.symbols);
      const tickMessage: TickUpdateMessage = {
        type: 'ticks',
        ticks: immediateTicks,
        serverTime: Date.now(),
        interval: TICK_INTERVAL_MS,
      };
      socket.emit('ticks', tickMessage);
      
    } catch (error) {
      const errorMessage: ErrorMessage = {
        type: 'error',
        code: 'INVALID_SUBSCRIBE',
        message: error instanceof Error ? error.message : 'Invalid subscribe request',
      };
      socket.emit('error', errorMessage);
    }
  });
  
  // Handle unsubscribe
  socket.on('unsubscribe', (data: unknown) => {
    try {
      const parsed = UnsubscribeRequestSchema.parse(data);
      const clientSymbols = clientSubscriptions.get(clientId) || new Set();
      
      parsed.symbols.forEach((symbol) => {
        const upperSymbol = symbol.toUpperCase();
        clientSymbols.delete(upperSymbol);
        symbolSubscribers.get(upperSymbol)?.delete(clientId);
      });
      
      const unsubscribeStatus: ConnectionStatus = {
        type: 'status',
        status: 'subscribed',
        subscribedSymbols: Array.from(clientSymbols),
        message: `Unsubscribed from ${parsed.symbols.length} symbols`,
      };
      socket.emit('status', unsubscribeStatus);
      
      console.log(`[Unsubscribe] ${clientId} unsubscribed from: ${parsed.symbols.join(', ')}`);
      
    } catch (error) {
      const errorMessage: ErrorMessage = {
        type: 'error',
        code: 'INVALID_UNSUBSCRIBE',
        message: error instanceof Error ? error.message : 'Invalid unsubscribe request',
      };
      socket.emit('error', errorMessage);
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Disconnect] Client ${clientId} disconnected: ${reason}`);
    
    // Clean up subscriptions
    const clientSymbols = clientSubscriptions.get(clientId) || new Set();
    clientSymbols.forEach((symbol) => {
      symbolSubscribers.get(symbol)?.delete(clientId);
    });
    clientSubscriptions.delete(clientId);
  });
});

// ============================================
// GRACEFUL SHUTDOWN
// ============================================

const shutdown = () => {
  console.log('\n[Shutdown] Gracefully shutting down...');
  clearInterval(tickInterval);
  clearInterval(heartbeatInterval);
  io.close(() => {
    console.log('[Shutdown] Socket.IO closed');
    httpServer.close(() => {
      console.log('[Shutdown] HTTP server closed');
      process.exit(0);
    });
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ============================================
// START SERVER
// ============================================

httpServer.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║     RONEIRA REALTIME SERVICE                                 ║
║     WebSocket server running on port ${PORT}                    ║
║     Tick interval: ${TICK_INTERVAL_MS / 1000}s | Heartbeat: ${HEARTBEAT_INTERVAL_MS / 1000}s              ║
╚══════════════════════════════════════════════════════════════╝
  `);
});

export { io, httpServer };
