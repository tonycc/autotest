# 项目架构总览：付款记录小应用（payment-records-app）

## 1. 业务定位与核心场景
- **项目名称**：付款记录小应用（payment-records-app）
- **目标用户与核心闭环**：个人用户记录日常付款流水 → 按时间回看流水 → 按月/按支付方式了解支出分布。核心闭环为「记一笔 → 查流水 → 看汇总」。
- **首期（MVP）边界**：
  - **包含**：付款记录的新增、查询（单条 + 分页列表）、编辑、删除；累计支出与当月支出统计；支付方式分布统计；统一响应/异常契约；接口访问密钥保护。
  - **明确排除**（防止下游发散）：
    - 前端页面与移动端：MVP 只交付 REST API（`/api/v1/payment-records`），不搭建 Vue/小程序；
    - 多用户体系、注册登录、多租户隔离：MVP 为单用户自托管，仅用 `x-api-key` 保护接口；
    - 预算/账单导入导出/图表、多币种与汇率、周期性账单提醒；
    - 分布式数据库与消息队列。

## 2. 技术栈与目录划分
- **后端**：NestJS 11 + TypeScript 5（Node.js ≥ 20），全局 `ValidationPipe`（`whitelist` + `forbidNonWhitelisted`）。
- **前端**：无（MVP 排除）。
- **数据与基础设施**：版本化 JSON 文件存储（`data/payment-records.json`，写前先写临时文件再 `rename` 原子替换），零原生依赖；后续可平滑替换为 PostgreSQL。
- **目录职责**：
  - `src/common/`：跨模块横切能力（统一响应拦截器、全局异常过滤器、请求 ID 中间件、`ApiKeyGuard`、错误码与 `BizException`）。
  - `src/modules/payment-records/`：付款记录领域（controller / service / repository / dto / entities / types / `__tests__`）。
  - `src/health/`：公开健康检查路由（不参与业务鉴权）。
  - `src/setup-app.ts`：运行时装配（`main.ts` 与 e2e 共用，保证测试与生产一致）。
  - `test/`：端到端测试（supertest，走真实 HTTP 栈）。
  - `artifacts/`：门禁与评审产物（已 gitignore）。

## 3. 核心接口契约与非功能约束
- **统一响应/错误格式**：
  - 成功：`{ "code": 0, "message": "ok", "data": <payload>, "requestId": "<uuid|透传 x-request-id>" }`
  - 失败：`{ "code": <业务码>, "message": "<可读信息>", "data": null, "requestId": "..." }`
  - 业务码：`1001` 入参非法 / `1002` 资源不存在 / `1003` 未授权 / `9999` 服务端内部错误。
- **接口清单**（前缀 `/api/v1/payment-records`，均需 `x-api-key`）：
  - `POST /` 新增（`amount` 单位元、最多两位小数；`paidAt` ISO-8601；`payee` 1-64 字符；`method` ∈ `CASH|BANK_CARD|WECHAT|ALIPAY|OTHER`；`note` ≤ 200）
  - `GET /?page=&pageSize=` 分页列表（`paidAt` 倒序，`createdAt` 倒序兜底；`pageSize` 1-100，默认 20）
  - `GET /statistics?month=YYYY-MM` 统计（累计支出/条数、当月支出/条数、按支付方式分布）
  - `GET /:id`、`PATCH /:id`（部分更新，空补丁返回 1001）、`DELETE /:id`
  - `GET /health`（公开）健康检查
- **鉴权与多租户隔离方式**：单用户自托管，所有业务路由校验 `x-api-key` 与 `PAYMENT_API_KEY` 是否一致（常量时间比较）；未配置服务端密钥时失败关闭（拒绝全部业务请求），不存在多租户维度。
- **金额精度**：入参以「元」接收，内部以「分」（整数）存储与汇总，输出再换算回元，规避浮点累计误差。
- **性能/时延基线**：单机 JSON 存储，单次读写 P95 < 50ms（数据量 < 10 万条），列表接口不引入 N+1 查询。

## 4. 门禁适配清单（对应 `harness.config.json`）
- `commands.lint`：`npm run lint`（ESLint 9 flat config，`@typescript-eslint/no-explicit-any` 为 error）
- `commands.typecheck`：`npm run typecheck`（`tsc --noEmit`，`strict: true`）
- `commands.testUnit`（含覆盖率或报告产物路径）：`npm run test:cov`（Jest + ts-jest，覆盖率报告输出 `artifacts/coverage/`，阈值 statements 75 / branches 65 / functions 70 / lines 75）
- `commands.testE2e`：`npm run test:e2e`（supertest 走真实 HTTP 栈，覆盖新增/列表/编辑/删除/统计与 400/401/404 分支）
