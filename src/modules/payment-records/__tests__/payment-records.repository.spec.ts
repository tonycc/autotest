import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import type { PaymentRecord } from '../entities/payment-record.entity';

import { PaymentMethod } from '../entities/payment-record.entity';
import { PaymentRecordsRepository } from '../payment-records.repository';

function buildRepository(dataFilePath: string): PaymentRecordsRepository {
  const configService = {
    get: (key: string): string | undefined => (key === 'PAYMENT_DATA_FILE' ? dataFilePath : undefined),
  } as unknown as ConfigService;
  return new PaymentRecordsRepository(configService);
}

function buildRecord(overrides: Partial<PaymentRecord> = {}): PaymentRecord {
  return {
    id: overrides.id ?? '00000000-0000-4000-8000-000000000001',
    amountInCents: 1234,
    paidAt: '2026-11-20T12:00:00+08:00',
    payee: '菜市场',
    method: PaymentMethod.CASH,
    note: null,
    createdAt: '2026-11-20T04:00:00.000Z',
    updatedAt: '2026-11-20T04:00:00.000Z',
    ...overrides,
  };
}

describe('PaymentRecordsRepository', () => {
  let tempDir: string;
  let dataFilePath: string;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'payment-records-'));
    dataFilePath = path.join(tempDir, 'nested', 'payment-records.json');
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('[AC-1] 数据文件不存在时返回空列表且不抛错', async () => {
    const repository = buildRepository(dataFilePath);

    await expect(repository.findAll()).resolves.toEqual([]);
  });

  it('[AC-1] 新增后写入版本化 JSON 文件，新实例可读回', async () => {
    const repository = buildRepository(dataFilePath);
    await repository.insert(buildRecord());

    const raw = JSON.parse(await fs.readFile(dataFilePath, 'utf8')) as {
      version: number;
      records: PaymentRecord[];
    };
    expect(raw.version).toBe(1);
    expect(raw.records).toHaveLength(1);

    const reloaded = buildRepository(dataFilePath);
    const records = await reloaded.findAll();
    expect(records).toHaveLength(1);
    expect(records[0].amountInCents).toBe(1234);
  });

  it('[AC-3] 更新命中记录时返回新值并落盘', async () => {
    const repository = buildRepository(dataFilePath);
    const record = await repository.insert(buildRecord());

    const updated = await repository.update(record.id, { payee: '水果店', amountInCents: 2000 });

    expect(updated).toMatchObject({ payee: '水果店', amountInCents: 2000, id: record.id });
    const reloaded = buildRepository(dataFilePath);
    const stored = await reloaded.findById(record.id);
    expect(stored?.payee).toBe('水果店');
  });

  it('[AC-3] 更新不存在的记录返回 null', async () => {
    const repository = buildRepository(dataFilePath);

    await expect(repository.update('missing', { payee: 'x' })).resolves.toBeNull();
  });

  it('[AC-4] 删除命中返回 true，重复删除返回 false', async () => {
    const repository = buildRepository(dataFilePath);
    const record = await repository.insert(buildRecord());

    await expect(repository.deleteById(record.id)).resolves.toBe(true);
    await expect(repository.deleteById(record.id)).resolves.toBe(false);
    const reloaded = buildRepository(dataFilePath);
    await expect(reloaded.findAll()).resolves.toEqual([]);
  });

  it('未配置数据文件路径时回落到 <cwd>/data/payment-records.json', () => {
    const configService = { get: (): undefined => undefined } as unknown as ConfigService;
    const repository = new PaymentRecordsRepository(configService);

    expect(repository.dataFilePath).toBe(path.join(process.cwd(), 'data', 'payment-records.json'));
  });
});
