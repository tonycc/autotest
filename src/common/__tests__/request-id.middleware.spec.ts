import type { NextFunction, Response } from 'express';
import type { RequestWithId } from '../types/request-with-id';

import { requestIdMiddleware } from '../middleware/request-id.middleware';

function buildResponse(): { response: Response; setHeader: jest.Mock } {
  const setHeader = jest.fn();
  return { response: { setHeader } as unknown as Response, setHeader };
}

describe('requestIdMiddleware', () => {
  it('[AC-8] 透传上游 x-request-id 并回写响应头', () => {
    const { response, setHeader } = buildResponse();
    const next = jest.fn() as unknown as NextFunction;
    const request = {
      header: (name: string): string | undefined => (name === 'x-request-id' ? 'upstream-id' : undefined),
    } as unknown as RequestWithId;

    requestIdMiddleware(request, response, next);

    expect(request.requestId).toBe('upstream-id');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'upstream-id');
    expect(next).toHaveBeenCalled();
  });

  it('[AC-8] 未携带时自动生成 UUID 并回写响应头', () => {
    const { response, setHeader } = buildResponse();
    const next = jest.fn() as unknown as NextFunction;
    const request = {
      header: (): undefined => undefined,
    } as unknown as RequestWithId;

    requestIdMiddleware(request, response, next);

    expect(request.requestId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(setHeader).toHaveBeenCalledWith('x-request-id', request.requestId);
  });

  it('[AC-8] 空白 x-request-id 视为未提供', () => {
    const { response } = buildResponse();
    const next = jest.fn() as unknown as NextFunction;
    const request = {
      header: (): string => '   ',
    } as unknown as RequestWithId;

    requestIdMiddleware(request, response, next);

    expect(request.requestId).not.toBe('   ');
    expect((request.requestId ?? '').length).toBeGreaterThan(0);
  });
});
