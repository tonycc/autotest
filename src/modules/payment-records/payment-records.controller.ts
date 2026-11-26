import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { QueryPaymentRecordsDto } from './dto/query-payment-records.dto';
import { StatisticsQueryDto } from './dto/statistics-query.dto';
import { UpdatePaymentRecordDto } from './dto/update-payment-record.dto';
import { PaymentRecordsService } from './payment-records.service';
import {
  DeletePaymentRecordResult,
  PaginatedPaymentRecords,
  PaymentRecordView,
  PaymentStatisticsView,
} from './types/payment-record-view';

/** 付款记录 REST 接口（统一前缀 /api/v1） */
@Controller('api/v1/payment-records')
@UseGuards(ApiKeyGuard)
export class PaymentRecordsController {
  constructor(private readonly paymentRecordsService: PaymentRecordsService) {}

  /** 新增付款记录 */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePaymentRecordDto): Promise<PaymentRecordView> {
    return this.paymentRecordsService.create(dto);
  }

  /** 分页列表（按付款时间倒序） */
  @Get()
  list(@Query() query: QueryPaymentRecordsDto): Promise<PaginatedPaymentRecords> {
    return this.paymentRecordsService.list(query);
  }

  /** 统计汇总（须在 :id 路由之前声明，避免被动态段吞掉） */
  @Get('statistics')
  statistics(@Query() query: StatisticsQueryDto): Promise<PaymentStatisticsView> {
    return this.paymentRecordsService.statistics(query.month);
  }

  /** 查询单条记录 */
  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<PaymentRecordView> {
    return this.paymentRecordsService.findOne(id);
  }

  /** 编辑付款记录 */
  @Patch(':id')
  update(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() dto: UpdatePaymentRecordDto,
  ): Promise<PaymentRecordView> {
    return this.paymentRecordsService.update(id, dto);
  }

  /** 删除付款记录 */
  @Delete(':id')
  remove(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<DeletePaymentRecordResult> {
    return this.paymentRecordsService.remove(id);
  }
}
