import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { ErrorCode } from '../errors/error-code';
import { ApiKeyGuard } from '../guards/api-key.guard';

function buildContext(apiKey?: string): ExecutionContext {
  const request = {
    header: (name: string): string | undefined => (name === 'x-api-key' ? apiKey : undefined),
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function buildGuard(configuredKey?: string): ApiKeyGuard {
  const configService = {
    get: (key: string): string | undefined =>
      key === 'PAYMENT_API_KEY' ? configuredKey : undefined,
  } as unknown as ConfigService;
  return new ApiKeyGuard(configService);
}

describe('ApiKeyGuard', () => {
  it('[AC-7] 未配置服务端密钥时失败关闭（INTERNAL）', () => {
    const guard = buildGuard(undefined);

    expect(() => guard.canActivate(buildContext('any'))).toThrow(
      expect.objectContaining({ code: ErrorCode.INTERNAL }),
    );
  });

  it('[AC-7] 缺少请求头时抛出 UNAUTHORIZED', () => {
    const guard = buildGuard('expected-key');

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      expect.objectContaining({ code: ErrorCode.UNAUTHORIZED }),
    );
  });

  it('[AC-7] 密钥长度不一致时抛出 UNAUTHORIZED', () => {
    const guard = buildGuard('expected-key');

    expect(() => guard.canActivate(buildContext('short'))).toThrow(
      expect.objectContaining({ code: ErrorCode.UNAUTHORIZED }),
    );
  });

  it('[AC-7] 密钥内容不一致时抛出 UNAUTHORIZED', () => {
    const guard = buildGuard('expected-key');

    expect(() => guard.canActivate(buildContext('wrong-key-123'))).toThrow(
      expect.objectContaining({ code: ErrorCode.UNAUTHORIZED }),
    );
  });

  it('[AC-7] 密钥匹配时放行', () => {
    const guard = buildGuard('expected-key');

    expect(guard.canActivate(buildContext('expected-key'))).toBe(true);
  });
});
