import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './setup-app';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = Number(configService.get<string>('PORT') ?? '3000');
  await app.listen(port);
  Logger.log(`付款记录服务已启动: http://127.0.0.1:${port}/api/v1/payment-records`, 'Bootstrap');
}

void bootstrap();
