import type { INestApplication } from '@nestjs/common';

import { ValidationPipe } from '@nestjs/common';

import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { requestIdMiddleware } from './common/middleware/request-id.middleware';

/**
 * 统一的运行时装配：main.ts 与 e2e 测试共用，
 * 保证测试环境与生产环境的响应包装、入参校验、异常格式完全一致。
 */
export function configureApp(app: INestApplication): INestApplication {
  app.use(requestIdMiddleware);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor<unknown>());
  return app;
}
