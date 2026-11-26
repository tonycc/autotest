import type { NextFunction, Response } from 'express';

import { randomUUID } from 'node:crypto';

import type { RequestWithId } from '../types/request-with-id';

/**
 * 为每个请求注入 requestId：
 * 优先透传上游（网关/客户端）传入的 x-request-id，便于全链路排查。
 */
export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
): void {
  const inbound = req.header('x-request-id');
  req.requestId = inbound && inbound.trim().length > 0 ? inbound.trim() : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}
