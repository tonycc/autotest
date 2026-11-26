import { BizException } from '../../../common/errors/biz.exception';
import { ErrorCode } from '../../../common/errors/error-code';
import type { CreatePaymentRecordDto } from '../dto/create-payment-record.dto';
import type { UpdatePaymentRecordDto } from '../dto/update-payment-record.dto';
import type { PaymentRecord } from '../entities/payment-record.entity';

import { PaymentMethod } from '../entities/payment-record.entity';
import type { PaymentRecordsRepository } from '../payment-records.repository';
import { PaymentRecordsService } from '../payment-records.service';

/** 内存版仓储替身：隔离文件系统，保证单测离线可复现 */
class InMemoryRepository {
  records: PaymentRecord[] = [];

  async findAll(): Promise<PaymentRecord[]> {
    return [...this.records];
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    return this.records.find((record) => record.id === id) ?? null;
  }

  async insert(record: PaymentRecord): Promise<PaymentRecord> {
    this.records.push(record);
    return record;
  }

  async update(
    id: string,
    patch: Partial<Omit<PaymentRecord, 'id' | 'createdAt'>>,
  ): Promise<PaymentRecord | null> {
    const index = this.records.findIndex((record) => record.id === id);
    if (index < 0) {
      return null;
    }
    const updated = { ...this.records[index], ...patch };
    this.records[index] = updated;
    return updated;
  }

  async deleteById(id: string): Promise<boolean> {
    const before = this.records.length;
    this.records = this.records.filter((record) => record.id !== id);
    return this.records.length !== before;
  }
}

function buildCreateDto(overrides: Partial<CreatePaymentRecordDto> = {}): CreatePaymentRecordDto {
  return {
    amount: 25.5,
    paidAt: '2026-11-20T12:30:00+08:00',
    payee: '公司食堂',
    method: PaymentMethod.WECHAT,
    note: '午餐',
    ...overrides,
  };
}

function seedRecord(repository: InMemoryRepository, overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  const record: PaymentRecord = {
    id: overrides.id ?? '00000000-0000-4000-8000-00000000000a',
    amountInCents: 1000,
    paidAt: '2026-11-01T09:00:00+08:00',
    payee: '超市',
    method: PaymentMethod.CASH,
    note: null,
    createdAt: '2026-11-01T09:00:01.000Z',
    updatedAt: '2026-11-01T09:00:01.000Z',
    ...overrides,
  };
  repository.records.push(record);
  return record;
}

describe('PaymentRecordsService', () => {
  let repository: InMemoryRepository;
  let service: PaymentRecordsService;

  beforeEach(() => {
    repository = new InMemoryRepository();
    service = new PaymentRecordsService(repository as unknown as PaymentRecordsRepository);
  });

  describe('create', () => {
    it('[AC-1] 新增成功后金额按分存储、备注去除首尾空格', async () => {
      const view = await service.create(buildCreateDto({ note: '  打车  ' }));

      expect(view.amount).toBe(25.5);
      expect(view.note).toBe('打车');
      expect(view.method).toBe(PaymentMethod.WECHAT);
      expect(repository.records).toHaveLength(1);
      expect(repository.records[0].amountInCents).toBe(2550);
    });

    it('[AC-1] 最小金额 0.01 元可正常保存，空备注归一为 null', async () => {
      const view = await service.create(buildCreateDto({ amount: 0.01, note: '   ' }));

      expect(view.amount).toBe(0.01);
      expect(view.note).toBeNull();
      expect(repository.records[0].amountInCents).toBe(1);
    });

    it('[AC-1] 付款对象为空白字符时抛出 INVALID_PARAM 且不落库', async () => {
      await expect(service.create(buildCreateDto({ payee: '   ' }))).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAM,
      });
      expect(repository.records).toHaveLength(0);
    });
  });

  describe('list', () => {
    it('[AC-2] 列表按付款时间倒序返回', async () => {
      seedRecord(repository, { id: 'a', paidAt: '2026-11-01T09:00:00+08:00' });
      seedRecord(repository, { id: 'b', paidAt: '2026-11-25T09:00:00+08:00' });
      seedRecord(repository, { id: 'c', paidAt: '2026-11-10T09:00:00+08:00' });

      const result = await service.list({});

      expect(result.items.map((item) => item.id)).toEqual(['b', 'c', 'a']);
      expect(result.total).toBe(3);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('[AC-2] 分页参数生效且 totalPages 计算正确', async () => {
      seedRecord(repository, { id: 'a', paidAt: '2026-11-01T09:00:00+08:00' });
      seedRecord(repository, { id: 'b', paidAt: '2026-11-02T09:00:00+08:00' });
      seedRecord(repository, { id: 'c', paidAt: '2026-11-03T09:00:00+08:00' });

      const result = await service.list({ page: 2, pageSize: 2 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('a');
      expect(result.totalPages).toBe(2);
    });

    it('[AC-2] 空数据集返回空列表且 totalPages 为 0', async () => {
      const result = await service.list({ page: 1, pageSize: 10 });

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(result.totalPages).toBe(0);
    });

    it('[AC-2] pageSize 超出上限时抛出 INVALID_PARAM', async () => {
      await expect(service.list({ pageSize: 101 })).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAM,
      });
    });

    it('[AC-2] 付款时间相同时按创建时间倒序兜底', async () => {
      seedRecord(repository, {
        id: 'older',
        paidAt: '2026-11-05T09:00:00+08:00',
        createdAt: '2026-11-05T01:00:00.000Z',
      });
      seedRecord(repository, {
        id: 'newer',
        paidAt: '2026-11-05T09:00:00+08:00',
        createdAt: '2026-11-06T01:00:00.000Z',
      });

      const result = await service.list({});

      expect(result.items.map((item) => item.id)).toEqual(['newer', 'older']);
    });
  });

  describe('update', () => {
    it('[AC-3] 部分更新金额与支付方式后视图返回新值', async () => {
      const record = seedRecord(repository);

      const view = await service.update(record.id, {
        amount: 88.88,
        method: PaymentMethod.ALIPAY,
      } as UpdatePaymentRecordDto);

      expect(view.amount).toBe(88.88);
      expect(view.method).toBe(PaymentMethod.ALIPAY);
      expect(view.createdAt).toBe(record.createdAt);
      expect(repository.records[0].amountInCents).toBe(8888);
    });

    it('[AC-3] 空补丁抛出 INVALID_PARAM', async () => {
      const record = seedRecord(repository);

      await expect(service.update(record.id, {})).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAM,
      });
    });

    it('[AC-3] 更新不存在的记录抛出 NOT_FOUND', async () => {
      await expect(service.update('not-exist', { payee: '书店' })).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('[AC-3] 付款对象改为空白字符时抛出 INVALID_PARAM', async () => {
      const record = seedRecord(repository);

      await expect(service.update(record.id, { payee: '  ' })).rejects.toMatchObject({
        code: ErrorCode.INVALID_PARAM,
      });
    });
  });

  describe('remove / findOne', () => {
    it('[AC-4] 删除存在的记录返回 deleted=true 并从仓储移除', async () => {
      const record = seedRecord(repository);

      const result = await service.remove(record.id);

      expect(result).toEqual({ id: record.id, deleted: true });
      expect(repository.records).toHaveLength(0);
    });

    it('[AC-4] 删除不存在的记录抛出 NOT_FOUND', async () => {
      await expect(service.remove('missing-id')).rejects.toBeInstanceOf(BizException);
      await expect(service.remove('missing-id')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('[AC-6] 查询不存在的记录抛出 NOT_FOUND', async () => {
      await expect(service.findOne('missing-id')).rejects.toMatchObject({
        code: ErrorCode.NOT_FOUND,
      });
    });

    it('[AC-6] 查询存在的记录返回详情', async () => {
      const record = seedRecord(repository, { payee: '药店' });

      const view = await service.findOne(record.id);

      expect(view.payee).toBe('药店');
      expect(view.amount).toBe(10);
    });
  });

  describe('statistics', () => {
    it('[AC-5] 累计金额与指定月份金额分别汇总正确', async () => {
      seedRecord(repository, { id: 'a', amountInCents: 1000, paidAt: '2026-11-01T09:00:00+08:00' });
      seedRecord(repository, { id: 'b', amountInCents: 2500, paidAt: '2026-11-20T09:00:00+08:00' });
      seedRecord(repository, { id: 'c', amountInCents: 500, paidAt: '2026-10-31T09:00:00+08:00' });

      const stats = await service.statistics('2026-11');

      expect(stats.month).toBe('2026-11');
      expect(stats.totalAmount).toBe(40);
      expect(stats.totalCount).toBe(3);
      expect(stats.monthlyAmount).toBe(35);
      expect(stats.monthlyCount).toBe(2);
    });

    it('[AC-5] 按支付方式聚合且按金额倒序', async () => {
      seedRecord(repository, { id: 'a', amountInCents: 1000, method: PaymentMethod.CASH });
      seedRecord(repository, { id: 'b', amountInCents: 3000, method: PaymentMethod.ALIPAY });
      seedRecord(repository, { id: 'c', amountInCents: 500, method: PaymentMethod.ALIPAY });

      const stats = await service.statistics('2026-11');

      expect(stats.byMethod[0]).toEqual({
        method: PaymentMethod.ALIPAY,
        amount: 35,
        count: 2,
      });
      expect(stats.byMethod[1]).toEqual({
        method: PaymentMethod.CASH,
        amount: 10,
        count: 1,
      });
    });

    it('[AC-5] 未指定月份时按当前自然月统计', async () => {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;
      seedRecord(repository, { id: 'a', amountInCents: 700, paidAt: `${currentMonth}-05T10:00:00+08:00` });

      const stats = await service.statistics();

      expect(stats.month).toBe(currentMonth);
      expect(stats.monthlyAmount).toBe(7);
      expect(stats.monthlyCount).toBe(1);
    });
  });
});
