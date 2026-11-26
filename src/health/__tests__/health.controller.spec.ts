import { Test } from '@nestjs/testing';

import { HealthController } from '../health.controller';

describe('HealthController', () => {
  it('[AC-7] 健康检查返回 ok 与运行时长', () => {
    const controller = new HealthController();

    const result = controller.check();

    expect(result.status).toBe('ok');
    expect(result.uptimeInSeconds).toBeGreaterThanOrEqual(0);
  });

  it('[AC-7] 健康检查路由不依赖鉴权守卫（Nest 可实例化控制器）', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    expect(moduleRef.get(HealthController)).toBeInstanceOf(HealthController);
    await moduleRef.close();
  });
});
