import { Controller, Get } from '@nestjs/common';

/** 健康检查（公开路由，不参与业务鉴权） */
@Controller()
export class HealthController {
  @Get('health')
  check(): { status: string; uptimeInSeconds: number } {
    return {
      status: 'ok',
      uptimeInSeconds: Math.floor(process.uptime()),
    };
  }
}
