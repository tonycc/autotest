import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

import { Test } from '@nestjs/testing';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';

const API_KEY = 'e2e-test-key-please-rotate';
const API = '/api/v1/payment-records';

describe('付款记录 API (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let tempDir: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'payment-records-e2e-'));
    process.env.PAYMENT_API_KEY = API_KEY;
    process.env.PAYMENT_DATA_FILE = path.join(tempDir, 'payment-records.json');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    server = app.getHttpServer() as Server;
  });

  afterAll(async () => {
    await app.close();
    await fs.rm(tempDir, { recursive: true, force: true });
    delete process.env.PAYMENT_API_KEY;
    delete process.env.PAYMENT_DATA_FILE;
  });

  it('[AC-7] 健康检查为公开路由，返回统一响应包装', async () => {
    const response = await request(server).get('/health').expect(200);

    expect(response.body).toMatchObject({ code: 0, message: 'ok' });
    expect(response.body.data.status).toBe('ok');
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('[AC-7] 缺少访问密钥时返回 401 与 UNAUTHORIZED 业务码', async () => {
    const response = await request(server).get(API).expect(401);

    expect(response.body).toMatchObject({ code: 1003, data: null });
  });

  it('[AC-7] 访问密钥错误时返回 401', async () => {
    const response = await request(server).get(API).set('x-api-key', 'wrong-key').expect(401);

    expect(response.body.code).toBe(1003);
  });

  it('[AC-1] 新增付款记录返回 201 与完整视图', async () => {
    const response = await request(server)
      .post(API)
      .set('x-api-key', API_KEY)
      .send({
        amount: 128.88,
        paidAt: '2026-11-20T12:30:00+08:00',
        payee: '房东',
        method: 'BANK_CARD',
        note: '十一月房租',
      })
      .expect(201);

    expect(response.body.code).toBe(0);
    expect(response.body.data).toMatchObject({
      amount: 128.88,
      payee: '房东',
      method: 'BANK_CARD',
      note: '十一月房租',
    });
    expect(response.body.data.id).toMatch(/^[0-9a-f-]{36}$/);
    createdIds.push(String(response.body.data.id));
  });

  it('[AC-1] 金额非法（0）与未知字段均返回 400/1001', async () => {
    const zeroAmount = await request(server)
      .post(API)
      .set('x-api-key', API_KEY)
      .send({ amount: 0, paidAt: '2026-11-20T12:30:00+08:00', payee: '便利店', method: 'CASH' })
      .expect(400);

    expect(zeroAmount.body.code).toBe(1001);

    const unknownField = await request(server)
      .post(API)
      .set('x-api-key', API_KEY)
      .send({
        amount: 10,
        paidAt: '2026-11-20T12:30:00+08:00',
        payee: '便利店',
        method: 'CASH',
        unexpected: 'x',
      })
      .expect(400);

    expect(unknownField.body.code).toBe(1001);
  });

  it('[AC-2] 列表按付款时间倒序并返回分页元数据', async () => {
    const second = await request(server)
      .post(API)
      .set('x-api-key', API_KEY)
      .send({
        amount: 20,
        paidAt: '2026-11-25T08:00:00+08:00',
        payee: '早餐店',
        method: 'WECHAT',
      })
      .expect(201);
    createdIds.push(String(second.body.data.id));

    const response = await request(server)
      .get(`${API}?page=1&pageSize=1`)
      .set('x-api-key', API_KEY)
      .expect(200);

    expect(response.body.data.page).toBe(1);
    expect(response.body.data.pageSize).toBe(1);
    expect(response.body.data.total).toBe(2);
    expect(response.body.data.totalPages).toBe(2);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].paidAt).toBe('2026-11-25T08:00:00+08:00');
  });

  it('[AC-2] page 为 0 时返回 400/1001', async () => {
    const response = await request(server)
      .get(`${API}?page=0`)
      .set('x-api-key', API_KEY)
      .expect(400);

    expect(response.body.code).toBe(1001);
  });

  it('[AC-6] 查询单条记录；非法 UUID 返回 400，未知 UUID 返回 404', async () => {
    const detail = await request(server)
      .get(`${API}/${createdIds[0]}`)
      .set('x-api-key', API_KEY)
      .expect(200);
    expect(detail.body.data.id).toBe(createdIds[0]);

    const invalid = await request(server)
      .get(`${API}/not-a-uuid`)
      .set('x-api-key', API_KEY)
      .expect(400);
    expect(invalid.body.code).toBe(1001);

    const missing = await request(server)
      .get(`${API}/11111111-1111-4111-8111-111111111111`)
      .set('x-api-key', API_KEY)
      .expect(404);
    expect(missing.body.code).toBe(1002);
  });

  it('[AC-3] 编辑记录后返回新值', async () => {
    const response = await request(server)
      .patch(`${API}/${createdIds[0]}`)
      .set('x-api-key', API_KEY)
      .send({ amount: 99.5, note: '调整为实际租金' })
      .expect(200);

    expect(response.body.data.amount).toBe(99.5);
    expect(response.body.data.note).toBe('调整为实际租金');
  });

  it('[AC-3] 空补丁返回 400/1001', async () => {
    const response = await request(server)
      .patch(`${API}/${createdIds[0]}`)
      .set('x-api-key', API_KEY)
      .send({})
      .expect(400);

    expect(response.body.code).toBe(1001);
  });

  it('[AC-5] 统计接口返回累计与当月汇总', async () => {
    const response = await request(server)
      .get(`${API}/statistics?month=2026-11`)
      .set('x-api-key', API_KEY)
      .expect(200);

    expect(response.body.data.month).toBe('2026-11');
    expect(response.body.data.totalCount).toBe(2);
    expect(response.body.data.totalAmount).toBe(119.5);
    expect(response.body.data.monthlyAmount).toBe(119.5);
    expect(response.body.data.monthlyCount).toBe(2);
    expect(Array.isArray(response.body.data.byMethod)).toBe(true);
  });

  it('[AC-5] 月份格式非法返回 400/1001', async () => {
    const response = await request(server)
      .get(`${API}/statistics?month=2026-13`)
      .set('x-api-key', API_KEY)
      .expect(400);

    expect(response.body.code).toBe(1001);
  });

  it('[AC-4] 删除记录后再次删除返回 404', async () => {
    const deleted = await request(server)
      .delete(`${API}/${createdIds[1]}`)
      .set('x-api-key', API_KEY)
      .expect(200);

    expect(deleted.body.data).toEqual({ id: createdIds[1], deleted: true });

    const again = await request(server)
      .delete(`${API}/${createdIds[1]}`)
      .set('x-api-key', API_KEY)
      .expect(404);
    expect(again.body.code).toBe(1002);
  });
});
