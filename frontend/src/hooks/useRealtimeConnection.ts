import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  TickUpdateMessage, 
  HeartbeatMessage, 
  ConnectionStatus,
  ErrorMessage,
  TickData,
  SubscribeRequest,
  UnsubscribeRequest,
} from '../../../realtime/src/schemas';

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'stale';

interface UseRealtimeConnectionOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectionAttempts?: number;
  reconnectionDelay?: number;
  staleThresholdMs?: number; // Time without ticks before showing "stale" (default: 20s)
}

interface UseRealtimeConnectionReturn {
  status: RealtimeConnectionState;
  subscribedSymbols: string[];
  lastTickTime: Date | null;
  ticks: Map<string, TickData>;
  error: string | null;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  connect: () => void;
  disconnect: () => void;
}

const DEFAULT_WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';
const DEFAULT_STALE_THRESHOLD_MS = 20000; // 20 seconds

/**
 * Hook to manage WebSocket connection for real-time tick updates
 * Implements exponential backoff reconnection and stale detection
 */
export const useRealtimeConnection = (
  options: UseRealtimeConnectionOptions = {}
): UseRealtimeConnectionReturn => {
  const {
    url = DEFAULT_WS_URL,
    autoConnect = true,
    reconnectionAttempts = 5,
    reconnectionDelay = 1000,
    staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS,
  } = options;

  const [status, setStatus] = useState<RealtimeConnectionState>('disconnected');
  const [subscribedSymbols, setSubscribedSymbols] = useState<string[]>([]);
  const [lastTickTime, setLastTickTime] = useState<Date | null>(null);
  const [ticks, setTicks] = useState<Map<string, TickData>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const staleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  // Clear stale timer
  const clearStaleTimer = useCallback(() => {
    if (staleTimerRef.current) {
      clearTimeout(staleTimerRef.current);
      staleTimerRef.current = null;
    }
  }, []);

  // Start stale timer
  const startStaleTimer = useCallback(() => {
    clearStaleTimer();
    staleTimerRef.current = setTimeout(() => {
      if (status === 'connected') {
        setStatus('stale');
      }
    }, staleThresholdMs);
  }, [clearStaleTimer, status, staleThresholdMs]);

  // Handle tick message
  const handleTicks = useCallback((message: TickUpdateMessage) => {
    setTicks((prev) => {
      const updated = new Map(prev);
      message.ticks.forEach((tick) => {
        updated.set(tick.symbol, tick);
      });
      return updated;
    });
    setLastTickTime(new Date(message.serverTime));
    
    // Reset stale status if we receive ticks
    if (status === 'stale') {
      setStatus('connected');
    }
    startStaleTimer();
  }, [status, startStaleTimer]);

  // Handle heartbeat
  const handleHeartbeat = useCallback((_message: HeartbeatMessage) => {
    // Heartbeat received - connection is alive
    // Don't reset stale timer on heartbeat, only on ticks
  }, []);

  // Handle status message
  const handleStatus = useCallback((message: ConnectionStatus) => {
    if (message.subscribedSymbols) {
      setSubscribedSymbols(message.subscribedSymbols);
    }
  }, []);

  // Handle error
  const handleError = useCallback((message: ErrorMessage) => {
    setError(message.message);
    console.error('[Realtime] Error:', message.code, message.message);
  }, []);

  // Connect
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setStatus('connecting');
    setError(null);

    const socket = io(url, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts,
      reconnectionDelay,
      reconnectionDelayMax: reconnectionDelay * 8,
    });

    socket.on('connect', () => {
      console.log('[Realtime] Connected');
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      startStaleTimer();
    });

    socket.on('disconnect', (reason) => {
      console.log('[Realtime] Disconnected:', reason);
      setStatus('disconnected');
      clearStaleTimer();
    });

    socket.on('connect_error', (err) => {
      console.error('[Realtime] Connection error:', err.message);
      setError(err.message);
      setStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      console.log('[Realtime] Reconnected');
      setStatus('connected');
      reconnectAttemptsRef.current = 0;
      
      // Re-subscribe after reconnect
      if (subscribedSymbols.length > 0) {
        const request: SubscribeRequest = {
          type: 'subscribe',
          symbols: subscribedSymbols,
        };
        socket.emit('subscribe', request);
      }
    });

    socket.io.on('reconnect_attempt', (attempt) => {
      console.log('[Realtime] Reconnect attempt:', attempt);
      setStatus('reconnecting');
      reconnectAttemptsRef.current = attempt;
    });

    socket.io.on('reconnect_failed', () => {
      console.error('[Realtime] Reconnection failed');
      setStatus('disconnected');
      setError('Failed to reconnect after maximum attempts');
    });

    // Message handlers
    socket.on('ticks', handleTicks);
    socket.on('heartbeat', handleHeartbeat);
    socket.on('status', handleStatus);
    socket.on('error', handleError);

    socketRef.current = socket;
  }, [
    url, 
    reconnectionAttempts, 
    reconnectionDelay, 
    subscribedSymbols, 
    handleTicks, 
    handleHeartbeat, 
    handleStatus, 
    handleError,
    startStaleTimer,
    clearStaleTimer,
  ]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    clearStaleTimer();
    setStatus('disconnected');
    setSubscribedSymbols([]);
    setTicks(new Map());
    setLastTickTime(null);
  }, [clearStaleTimer]);

  // Subscribe to symbols
  const subscribe = useCallback((symbols: string[]) => {
    if (!socketRef.current?.connected) {
      console.warn('[Realtime] Cannot subscribe - not connected');
      return;
    }

    const request: SubscribeRequest = {
      type: 'subscribe',
      symbols,
    };
    socketRef.current.emit('subscribe', request);
  }, []);

  // Unsubscribe from symbols
  const unsubscribe = useCallback((symbols: string[]) => {
    if (!socketRef.current?.connected) {
      console.warn('[Realtime] Cannot unsubscribe - not connected');
      return;
    }

    const request: UnsubscribeRequest = {
      type: 'unsubscribe',
      symbols,
    };
    socketRef.current.emit('unsubscribe', request);
    
    // Remove ticks for unsubscribed symbols
    setTicks((prev) => {
      const updated = new Map(prev);
      symbols.forEach((s) => updated.delete(s.toUpperCase()));
      return updated;
    });
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect]); // Only run on mount/unmount, not on connect/disconnect change

  return {
    status,
    subscribedSymbols,
    lastTickTime,
    ticks,
    error,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
  };
};

export default useRealtimeConnection;
