import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { BizException } from '../../common/errors/biz.exception';
import { ErrorCode } from '../../common/errors/error-code';
import { CreatePaymentRecordDto } from './dto/create-payment-record.dto';
import { QueryPaymentRecordsDto } from './dto/query-payment-records.dto';
import { UpdatePaymentRecordDto } from './dto/update-payment-record.dto';
import { PaymentMethod, PaymentRecord } from './entities/payment-record.entity';
import { PaymentRecordsRepository } from './payment-records.repository';
import {
  DeletePaymentRecordResult,
  MethodStatisticsItem,
  PaginatedPaymentRecords,
  PaymentRecordView,
  PaymentStatisticsView,
} from './types/payment-record-view';

const DEFAULT_PAGE_SIZE = 20;
const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 100;

/** 付款记录领域服务：金额换算、排序分页、统计汇总与业务异常收敛 */
@Injectable()
export class PaymentRecordsService {
  constructor(private readonly repository: PaymentRecordsRepository) {}

  /** 新增付款记录 */
  async create(dto: CreatePaymentRecordDto): Promise<PaymentRecordView> {
    const payee = dto.payee.trim();
    if (payee.length === 0) {
      throw new BizException(ErrorCode.INVALID_PARAM, 'payee 不能为空白字符');
    }

    const now = new Date().toISOString();
    const record: PaymentRecord = {
      id: randomUUID(),
      amountInCents: PaymentRecordsService.toCents(dto.amount),
      paidAt: dto.paidAt,
      payee,
      method: dto.method,
      note: PaymentRecordsService.normalizeNote(dto.note),
      createdAt: now,
      updatedAt: now,
    };

    await this.repository.insert(record);
    return PaymentRecordsService.toView(record);
  }

  /** 分页列表，按付款时间倒序 */
  async list(query: QueryPaymentRecordsDto): Promise<PaginatedPaymentRecords> {
    const page = query.page ?? 1;
    const pageSize = this.normalizePageSize(query.pageSize);
    const records = await this.repository.findAll();
    const sorted = PaymentRecordsService.sortByPaidAtDesc(records);
    const total = sorted.length;
    const start = (page - 1) * pageSize;
    const items = sorted.slice(start, start + pageSize).map((record) => PaymentRecordsService.toView(record));

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
    };
  }

  /** 查询单条记录 */
  async findOne(id: string): Promise<PaymentRecordView> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw new BizException(ErrorCode.NOT_FOUND, '付款记录不存在');
    }
    return PaymentRecordsService.toView(record);
  }

  /** 编辑付款记录（部分更新） */
  async update(id: string, dto: UpdatePaymentRecordDto): Promise<PaymentRecordView> {
    const patch: Partial<Omit<PaymentRecord, 'id' | 'createdAt'>> = {};

    if (dto.amount !== undefined) {
      patch.amountInCents = PaymentRecordsService.toCents(dto.amount);
    }
    if (dto.paidAt !== undefined) {
      patch.paidAt = dto.paidAt;
    }
    if (dto.payee !== undefined) {
      const payee = dto.payee.trim();
      if (payee.length === 0) {
        throw new BizException(ErrorCode.INVALID_PARAM, 'payee 不能为空白字符');
      }
      patch.payee = payee;
    }
    if (dto.method !== undefined) {
      patch.method = dto.method;
    }
    if (dto.note !== undefined) {
      patch.note = PaymentRecordsService.normalizeNote(dto.note);
    }

    if (Object.keys(patch).length === 0) {
      throw new BizException(ErrorCode.INVALID_PARAM, '至少需要提供一个待更新字段');
    }
    patch.updatedAt = new Date().toISOString();

    const updated = await this.repository.update(id, patch);
    if (!updated) {
      throw new BizException(ErrorCode.NOT_FOUND, '付款记录不存在');
    }
    return PaymentRecordsService.toView(updated);
  }

  /** 删除付款记录 */
  async remove(id: string): Promise<DeletePaymentRecordResult> {
    const deleted = await this.repository.deleteById(id);
    if (!deleted) {
      throw new BizException(ErrorCode.NOT_FOUND, '付款记录不存在');
    }
    return { id, deleted: true };
  }

  /** 统计汇总：累计支出 + 指定月份支出 + 支付方式分布 */
  async statistics(month?: string): Promise<PaymentStatisticsView> {
    const records = await this.repository.findAll();
    const targetMonth = month ?? PaymentRecordsService.currentMonthKey();

    let totalInCents = 0;
    let monthlyInCents = 0;
    let monthlyCount = 0;
    const byMethodInCents = new Map<PaymentMethod, { amountInCents: number; count: number }>();

    for (const record of records) {
      totalInCents += record.amountInCents;

      const isTargetMonth = PaymentRecordsService.monthKeyOf(record.paidAt) === targetMonth;
      if (isTargetMonth) {
        monthlyInCents += record.amountInCents;
        monthlyCount += 1;
      }

      const bucket = byMethodInCents.get(record.method) ?? { amountInCents: 0, count: 0 };
      bucket.amountInCents += record.amountInCents;
      bucket.count += 1;
      byMethodInCents.set(record.method, bucket);
    }

    const byMethod: MethodStatisticsItem[] = [...byMethodInCents.entries()]
      .map(([method, bucket]) => ({
        method,
        amount: PaymentRecordsService.toYuan(bucket.amountInCents),
        count: bucket.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    return {
      month: targetMonth,
      totalAmount: PaymentRecordsService.toYuan(totalInCents),
      totalCount: records.length,
      monthlyAmount: PaymentRecordsService.toYuan(monthlyInCents),
      monthlyCount,
      byMethod,
    };
  }

  private normalizePageSize(pageSize?: number): number {
    if (pageSize === undefined) {
      return DEFAULT_PAGE_SIZE;
    }
    if (pageSize < MIN_PAGE_SIZE || pageSize > MAX_PAGE_SIZE) {
      throw new BizException(
        ErrorCode.INVALID_PARAM,
        `pageSize 需在 ${MIN_PAGE_SIZE}-${MAX_PAGE_SIZE} 之间`,
      );
    }
    return pageSize;
  }

  /** 元 -> 分（整数），避免浮点累计误差 */
  private static toCents(amountInYuan: number): number {
    return Math.round(amountInYuan * 100);
  }

  /** 分 -> 元 */
  private static toYuan(amountInCents: number): number {
    return Math.round(amountInCents) / 100;
  }

  private static normalizeNote(note?: string): string | null {
    const trimmed = note?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : null;
  }

  /** 月份归属：按 paidAt 字符串自身携带的本地日期取前 7 位（YYYY-MM） */
  private static monthKeyOf(paidAt: string): string {
    return paidAt.slice(0, 7);
  }

  private static currentMonthKey(): string {
    const now = new Date();
    const month = `${now.getMonth() + 1}`.padStart(2, '0');
    return `${now.getFullYear()}-${month}`;
  }

  private static sortByPaidAtDesc(records: PaymentRecord[]): PaymentRecord[] {
    return [...records].sort((a, b) => {
      const byPaidAt = Date.parse(b.paidAt) - Date.parse(a.paidAt);
      if (byPaidAt !== 0) {
        return byPaidAt;
      }
      const byCreatedAt = b.createdAt.localeCompare(a.createdAt);
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }
      return b.id.localeCompare(a.id);
    });
  }

  private static toView(record: PaymentRecord): PaymentRecordView {
    return {
      id: record.id,
      amount: PaymentRecordsService.toYuan(record.amountInCents),
      paidAt: record.paidAt,
      payee: record.payee,
      method: record.method,
      note: record.note,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
