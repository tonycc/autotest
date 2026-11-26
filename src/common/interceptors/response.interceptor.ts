import type { ApiResponse } from '../types/api-response';
import type { RequestWithId } from '../types/request-with-id';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';

import { Injectable } from '@nestjs/common';
import type { Observable } from 'rxjs';

import { map } from 'rxjs/operators';

/** 成功响应统一包装为 { code: 0, message: "ok", data, requestId } */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler<T>): Observable<ApiResponse<T>> {
    const request = context.switchToHttp().getRequest<RequestWithId>();

    return next.handle().pipe(
      map((data) => ({
        code: 0,
        message: 'ok',
        data,
        requestId: request.requestId ?? '',
      })),
    );
  }
}
