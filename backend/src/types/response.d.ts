declare module '*/utils/response' {
  import { Response } from 'express';

  export function sendSuccess<T>(res: Response, data: T, statusCode?: number): void;
  export function sendError(res: Response, error: string, statusCode?: number): void;
}
