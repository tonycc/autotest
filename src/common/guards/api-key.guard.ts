import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { RequestWithId } from '../types/request-with-id';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';

import { BizException } from '../errors/biz.exception';
import { ErrorCode } from '../errors/error-code';

/** 个人财务数据接口保护：校验 x-api-key 请求头与配置的服务端密钥是否一致 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = (this.configService.get<string>('PAYMENT_API_KEY') ?? '').trim();
    if (expected.length === 0) {
      // 失败关闭：未配置密钥时拒绝所有业务请求，避免无鉴权裸奔
      throw new BizException(ErrorCode.INTERNAL, '服务端未配置访问密钥');
    }

    const provided = (context.switchToHttp().getRequest<RequestWithId>().header('x-api-key') ?? '').trim();
    if (!this.isSameSecret(provided, expected)) {
      throw new BizException(ErrorCode.UNAUTHORIZED, '缺少或无效的访问密钥');
    }
    return true;
  }

  private isSameSecret(provided: string, expected: string): boolean {
    const providedBuffer = Buffer.from(provided, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return timingSafeEqual(providedBuffer, expectedBuffer);
  }
}
