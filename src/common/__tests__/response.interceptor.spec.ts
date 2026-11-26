import type { CallHandler, ExecutionContext } from '@nestjs/common';
import type { RequestWithId } from '../types/request-with-id';

import { firstValueFrom, of } from 'rxjs';

import { ResponseInterceptor } from '../interceptors/response.interceptor';

function buildContext(request: Partial<RequestWithId>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('ResponseInterceptor', () => {
  const interceptor = new ResponseInterceptor<{ value: number }>();

  it('[AC-8] 成功响应包装为统一契约并透传 requestId', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(buildContext({ requestId: 'req-9' }), {
        handle: () => of({ value: 42 }),
      } as CallHandler<{ value: number }>),
    );

    expect(result).toEqual({ code: 0, message: 'ok', data: { value: 42 }, requestId: 'req-9' });
  });

  it('[AC-8] 缺失 requestId 时输出空字符串而非 undefined', async () => {
    const result = await firstValueFrom(
      interceptor.intercept(buildContext({}), {
        handle: () => of({ value: 1 }),
      } as CallHandler<{ value: number }>),
    );

    expect(result.requestId).toBe('');
  });
});
