import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  PAYMENT_RECORD_STORE_VERSION,
  PaymentRecord,
  PaymentRecordStore,
} from './entities/payment-record.entity';

/**
 * 付款记录持久化仓储。
 *
 * MVP 采用「版本化 JSON 文件 + 原子替换写」方案：
 * - 零原生依赖，沙箱与本地行为一致，便于门禁稳定复现；
 * - 写入串行化并先写临时文件再 rename，避免进程中断导致的半截文件；
 * - 文件格式带 `version` 字段，后续切换 PostgreSQL 时可平滑迁移。
 */
@Injectable()
export class PaymentRecordsRepository {
  private cache: PaymentRecord[] | null = null;

  private writeChain: Promise<void> = Promise.resolve();

  constructor(private readonly configService: ConfigService) {}

  /** 数据文件路径，默认 <cwd>/data/payment-records.json */
  get dataFilePath(): string {
    const configured = this.configService.get<string>('PAYMENT_DATA_FILE');
    return configured && configured.trim().length > 0
      ? configured
      : path.join(process.cwd(), 'data', 'payment-records.json');
  }

  async findAll(): Promise<PaymentRecord[]> {
    const records = await this.readAll();
    return [...records];
  }

  async findById(id: string): Promise<PaymentRecord | null> {
    const records = await this.readAll();
    return records.find((record) => record.id === id) ?? null;
  }

  async insert(record: PaymentRecord): Promise<PaymentRecord> {
    const records = await this.readAll();
    records.push(record);
    await this.flush(records);
    return record;
  }

  async update(
    id: string,
    patch: Partial<Omit<PaymentRecord, 'id' | 'createdAt'>>,
  ): Promise<PaymentRecord | null> {
    const records = await this.readAll();
    const index = records.findIndex((record) => record.id === id);
    if (index < 0) {
      return null;
    }
    const current = records[index];
    const updated: PaymentRecord = {
      ...current,
      ...patch,
      id: current.id,
      createdAt: current.createdAt,
    };
    records[index] = updated;
    await this.flush(records);
    return updated;
  }

  async deleteById(id: string): Promise<boolean> {
    const records = await this.readAll();
    const remaining = records.filter((record) => record.id !== id);
    if (remaining.length === records.length) {
      return false;
    }
    await this.flush(remaining);
    return true;
  }

  private async readAll(): Promise<PaymentRecord[]> {
    if (this.cache) {
      return this.cache;
    }
    let records: PaymentRecord[] = [];
    try {
      const raw = await fs.readFile(this.dataFilePath, 'utf8');
      const parsed = JSON.parse(raw) as PaymentRecordStore;
      records = Array.isArray(parsed.records) ? parsed.records : [];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
    this.cache = records;
    return records;
  }

  private async flush(records: PaymentRecord[]): Promise<void> {
    this.cache = records;
    const payload = JSON.stringify(
      { version: PAYMENT_RECORD_STORE_VERSION, records } satisfies PaymentRecordStore,
      null,
      2,
    );
    this.writeChain = this.writeChain.then(() => this.writeAtomically(payload));
    await this.writeChain;
  }

  private async writeAtomically(contents: string): Promise<void> {
    const filePath = this.dataFilePath;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const tempPath = `${filePath}.${process.pid}.tmp`;
    await fs.writeFile(tempPath, contents, 'utf8');
    await fs.rename(tempPath, filePath);
  }
}
