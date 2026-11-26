import type { PaymentRecordsService } from '../payment-records.service';

import { PaymentRecordsController } from '../payment-records.controller';
import { PaymentMethod } from '../entities/payment-record.entity';

const recordView = {
  id: '11111111-1111-4111-8111-111111111111',
  amount: 12.34,
  paidAt: '2026-11-20T12:00:00+08:00',
  payee: '便利店',
  method: PaymentMethod.CASH,
  note: null,
  createdAt: '2026-11-20T04:00:00.000Z',
  updatedAt: '2026-11-20T04:00:00.000Z',
};

describe('PaymentRecordsController', () => {
  let service: Record<string, jest.Mock>;
  let controller: PaymentRecordsController;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(recordView),
      list: jest.fn().mockResolvedValue({
        items: [recordView],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      }),
      findOne: jest.fn().mockResolvedValue(recordView),
      update: jest.fn().mockResolvedValue(recordView),
      remove: jest.fn().mockResolvedValue({ id: recordView.id, deleted: true }),
      statistics: jest.fn().mockResolvedValue({ month: '2026-11' }),
    };
    controller = new PaymentRecordsController(service as unknown as PaymentRecordsService);
  });

  it('[AC-1] create 透传到 Service 并返回视图', async () => {
    const dto = {
      amount: 12.34,
      paidAt: recordView.paidAt,
      payee: recordView.payee,
      method: PaymentMethod.CASH,
    };

    await expect(controller.create(dto)).resolves.toEqual(recordView);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('[AC-2] list 透传分页参数', async () => {
    const result = await controller.list({ page: 1, pageSize: 20 });

    expect(result.total).toBe(1);
    expect(service.list).toHaveBeenCalledWith({ page: 1, pageSize: 20 });
  });

  it('[AC-5] statistics 只把 month 传给 Service', async () => {
    await controller.statistics({ month: '2026-11' });

    expect(service.statistics).toHaveBeenCalledWith('2026-11');
  });

  it('[AC-5] statistics 未传 month 时传递 undefined', async () => {
    await controller.statistics({});

    expect(service.statistics).toHaveBeenCalledWith(undefined);
  });

  it('[AC-6] findOne 透传 id', async () => {
    await expect(controller.findOne(recordView.id)).resolves.toEqual(recordView);
    expect(service.findOne).toHaveBeenCalledWith(recordView.id);
  });

  it('[AC-3] update 透传 id 与补丁', async () => {
    await controller.update(recordView.id, { amount: 20 });

    expect(service.update).toHaveBeenCalledWith(recordView.id, { amount: 20 });
  });

  it('[AC-4] remove 透传 id', async () => {
    await expect(controller.remove(recordView.id)).resolves.toEqual({
      id: recordView.id,
      deleted: true,
    });
    expect(service.remove).toHaveBeenCalledWith(recordView.id);
  });
});
