import type { MiddlewareConsumer, NestModule } from '@nestjs/common';

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { requestIdMiddleware } from './common/middleware/request-id.middleware';
import { HealthModule } from './health/health.module';
import { PaymentRecordsModule } from './modules/payment-records/payment-records.module';

/** 应用根模块 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    HealthModule,
    PaymentRecordsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(requestIdMiddleware).forRoutes('*');
  }
}
