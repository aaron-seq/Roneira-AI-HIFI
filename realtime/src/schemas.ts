import { z } from 'zod';

// ============================================
// SHARED ZOD SCHEMAS FOR WEBSOCKET PAYLOADS
// ============================================

/**
 * Tick data for a single symbol
 */
export const TickDataSchema = z.object({
  symbol: z.string().min(1).max(10),
  price: z.number().positive(),
  change: z.number(),
  changePercent: z.number(),
  volume: z.number().int().nonnegative(),
  high: z.number().positive(),
  low: z.number().positive(),
  open: z.number().positive(),
  timestamp: z.number().int(), // Unix timestamp in ms
});

export type TickData = z.infer<typeof TickDataSchema>;

/**
 * Aggregated tick update message (sent every 10s)
 */
export const TickUpdateMessageSchema = z.object({
  type: z.literal('ticks'),
  ticks: z.array(TickDataSchema),
  serverTime: z.number().int(),
  interval: z.number().int().default(10000), // 10s default
});

export type TickUpdateMessage = z.infer<typeof TickUpdateMessageSchema>;

/**
 * Subscribe request from client
 */
export const SubscribeRequestSchema = z.object({
  type: z.literal('subscribe'),
  symbols: z.array(z.string().min(1).max(10)).min(1).max(50),
});

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;

/**
 * Unsubscribe request from client
 */
export const UnsubscribeRequestSchema = z.object({
  type: z.literal('unsubscribe'),
  symbols: z.array(z.string().min(1).max(10)).min(1).max(50),
});

export type UnsubscribeRequest = z.infer<typeof UnsubscribeRequestSchema>;

/**
 * Heartbeat message (for connection health)
 */
export const HeartbeatMessageSchema = z.object({
  type: z.literal('heartbeat'),
  serverTime: z.number().int(),
});

export type HeartbeatMessage = z.infer<typeof HeartbeatMessageSchema>;

/**
 * Connection status message
 */
export const ConnectionStatusSchema = z.object({
  type: z.literal('status'),
  status: z.enum(['connected', 'subscribed', 'error']),
  subscribedSymbols: z.array(z.string()).optional(),
  message: z.string().optional(),
});

export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

/**
 * Error message
 */
export const ErrorMessageSchema = z.object({
  type: z.literal('error'),
  code: z.string(),
  message: z.string(),
});

export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;

/**
 * Any server-to-client message
 */
export const ServerMessageSchema = z.discriminatedUnion('type', [
  TickUpdateMessageSchema,
  HeartbeatMessageSchema,
  ConnectionStatusSchema,
  ErrorMessageSchema,
]);

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

/**
 * Any client-to-server message
 */
export const ClientMessageSchema = z.discriminatedUnion('type', [
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
]);

export type ClientMessage = z.infer<typeof ClientMessageSchema>;
