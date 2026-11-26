import type { ArgumentsHost } from '@nestjs/common';

import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';

import { AllExceptionsFilter } from '../filters/all-exceptions.filter';
import { BizException } from '../errors/biz.exception';
import { ErrorCode } from '../errors/error-code';

interface ResponseMock {
  status: jest.Mock;
  json: jest.Mock;
}

function buildHost(requestId?: string): { host: ArgumentsHost; response: ResponseMock } {
  const response: ResponseMock = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  const request = { requestId, method: 'GET', url: '/api/v1/payment-records' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  it('[AC-8] BizException 按业务码与消息输出', () => {
    const { host, response } = buildHost('req-1');

    filter.catch(new BizException(ErrorCode.NOT_FOUND, '付款记录不存在'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith({
      code: ErrorCode.NOT_FOUND,
      message: '付款记录不存在',
      data: null,
      requestId: 'req-1',
    });
  });

  it('[AC-8] ValidationPipe 的多条校验消息合并为一条 message', () => {
    const { host, response } = buildHost('req-2');

    filter.catch(
      new BadRequestException({ message: ['amount 必须大于 0', 'paidAt 格式错误'] }),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: ErrorCode.INVALID_PARAM,
        message: 'amount 必须大于 0; paidAt 格式错误',
        requestId: 'req-2',
      }),
    );
  });

  it('[AC-7] 未授权异常映射为 UNAUTHORIZED 业务码', () => {
    const { host, response } = buildHost('req-3');

    filter.catch(new UnauthorizedException('缺少或无效的访问密钥'), host);

    expect(response.status).toHaveBeenCalledWith(401);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCode.UNAUTHORIZED }),
    );
  });

  it('[AC-8] 路由 404 映射为 NOT_FOUND 业务码', () => {
    const { host, response } = buildHost('req-4');

    filter.catch(new NotFoundException('Cannot GET /not-exist'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: ErrorCode.NOT_FOUND }),
    );
  });

  it('[AC-8] 未知异常收敛为 500 且不泄漏堆栈', () => {
    const { host, response } = buildHost('req-5');

    filter.catch(new Error('数据库连接字符串 password=xxx'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      code: ErrorCode.INTERNAL,
      message: '服务器内部错误',
      data: null,
      requestId: 'req-5',
    });
  });

  it('[AC-8] 字符串响应的 HttpException 直接作为 message', () => {
    const { host, response } = buildHost(undefined);

    filter.catch(new BadRequestException('自定义参数错误'), host);

    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: '自定义参数错误', requestId: '' }),
    );
  });
});
