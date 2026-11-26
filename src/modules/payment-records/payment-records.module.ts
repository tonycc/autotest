import { Module } from '@nestjs/common';

import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { PaymentRecordsController } from './payment-records.controller';
import { PaymentRecordsRepository } from './payment-records.repository';
import { PaymentRecordsService } from './payment-records.service';

/** 付款记录领域模块 */
@Module({
  controllers: [PaymentRecordsController],
  providers: [PaymentRecordsRepository, PaymentRecordsService, ApiKeyGuard],
  exports: [PaymentRecordsService],
})
export class PaymentRecordsModule {}
