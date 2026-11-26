import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import { Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';

import type { RequestWithId } from '../types/request-with-id';

import { BizException } from '../errors/biz.exception';
import { ErrorCode } from '../errors/error-code';

interface NormalizedError {
  status: number;
  code: ErrorCode;
  message: string;
}

/** 全局异常过滤器：把任意异常收敛为统一响应契约，避免泄漏堆栈与内部细节 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestWithId>();
    const normalized = this.normalize(exception);

    if (normalized.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${request.requestId ?? '-'}] ${request.method} ${request.url} -> ${normalized.status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(normalized.status).json({
      code: normalized.code,
      message: normalized.message,
      data: null,
      requestId: request.requestId ?? '',
    });
  }

  private normalize(exception: unknown): NormalizedError {
    if (exception instanceof BizException) {
      return {
        status: exception.getStatus(),
        code: exception.code,
        message: exception.message,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        code: this.mapStatusToCode(status),
        message: this.extractMessage(exception),
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL,
      message: '服务器内部错误',
    };
  }

  private mapStatusToCode(status: number): ErrorCode {
    if (status === HttpStatus.UNAUTHORIZED || status === HttpStatus.FORBIDDEN) {
      return ErrorCode.UNAUTHORIZED;
    }
    if (status === HttpStatus.NOT_FOUND) {
      return ErrorCode.NOT_FOUND;
    }
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      return ErrorCode.INTERNAL;
    }
    return ErrorCode.INVALID_PARAM;
  }

  private extractMessage(exception: HttpException): string {
    const payload = exception.getResponse();
    if (typeof payload === 'string') {
      return payload;
    }
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) {
      return message.map((item) => String(item)).join('; ');
    }
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    return exception.message;
  }
}
