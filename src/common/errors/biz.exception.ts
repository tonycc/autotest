import { HttpException, HttpStatus } from '@nestjs/common';

import { ErrorCode } from './error-code';

/** 错误码到 HTTP 状态码的默认映射 */
const DEFAULT_HTTP_STATUS: Record<ErrorCode, HttpStatus> = {
  [ErrorCode.INVALID_PARAM]: HttpStatus.BAD_REQUEST,
  [ErrorCode.NOT_FOUND]: HttpStatus.NOT_FOUND,
  [ErrorCode.UNAUTHORIZED]: HttpStatus.UNAUTHORIZED,
  [ErrorCode.INTERNAL]: HttpStatus.INTERNAL_SERVER_ERROR,
};

/** 可预期业务异常，由全局异常过滤器统一转换为对外契约格式 */
export class BizException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message: string,
    httpStatus: HttpStatus = DEFAULT_HTTP_STATUS[code],
  ) {
    super(message, httpStatus);
  }
}
