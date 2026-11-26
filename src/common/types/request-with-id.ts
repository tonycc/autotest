import type { Request } from 'express';

/** 携带链路追踪 ID 的请求对象 */
export interface RequestWithId extends Request {
  requestId?: string;
}
