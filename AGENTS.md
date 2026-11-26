# Project Agent Rules (AGENTS.md)

本仓库遵循「确定性门禁约束非确定性 Agent」的研发规范。所有编码、测试、文档与评审 Agent 在修改或审查代码前必须遵守本文件。

## 1. 通用工作流铁律（全项目适用，禁止削弱）
1. **先读后写**：动手前必须先阅读 `docs/architecture/overview.md` 及本次任务涉及的 `.agents/skills/*/SKILL.md`。
2. **严格遵守白名单**：仅修改需求单允许的路径及对应测试文件；禁止顺手重构无关模块、禁止升级未指定的依赖版本。
3. **禁止篡改门禁基座**：除非需求单明确授权，严禁修改 `harness.config.json`、`scripts/gate.mjs`、`scripts/check-gate-integrity.mjs`、`scripts/check-harness-health.mjs`、`.github/workflows/ci.yml` 或调低测试覆盖率阈值。
4. **禁止绕过门禁**：严禁通过删除/跳过已有测试（`.skip` / `.only`）、添加 `@ts-ignore` / `@ts-nocheck` / `eslint-disable` / 覆盖率忽略注释来让门禁变绿。
5. **禁止自编自审**：实现者不得评审自己的变更；提交前必须确保 `node scripts/gate.mjs gate-mvp`（或完整需求 `node scripts/gate.mjs gate-all`）退出码为 0。
6. **证据驱动交付**：所有自动化报告必须输出至 `artifacts/` 目录（已被 `.gitignore` 忽略），PR 描述必须附带逐条 AC 与证据文件的映射表。

## 2. 通用安全与合规红线
1. **零硬编码凭据**：禁止在源码、测试或配置文件中写入真实密钥、Token、密码或生产内网地址；配置项统一通过环境变量读取，并同步更新 `.env.example`。
2. **日志脱敏**：禁止打印密码、JWT、手机号、身份证号、银行卡号等敏感明文。
3. **外部调用必带保护**：调用第三方 API、模型服务或外部基础设施时，必须设置显式超时与失败降级/错误处理逻辑。
4. **许可证红线**：禁止引入 `AGPL` 或 `GPL-3.0` 等强传染性开源依赖（除非架构评审书面批准并隔离运行）。
5. **数据变更向后兼容**：数据库或持久化结构变更必须提供向后兼容的 Migration 脚本，禁止单次发布直接删除或重命名线上正在使用的列。

## 3. 项目专属架构红线（付款记录小应用）
> 以下条目与本项目 `docs/architecture/overview.md` 保持一致，所有 Agent 必须遵守：
- **技术栈与目录边界**：后端 NestJS 11 + TypeScript（Node ≥ 20），业务代码仅位于 `src/modules/payment-records/`；横切能力（统一响应、异常、鉴权、请求 ID）仅在 `src/common/` 维护。MVP 无前端，禁止在本仓库新增 Vue/小程序工程。
- **核心分层约束**：`controller` 仅做路由、守卫与 DTO 绑定；业务规则（金额换算、排序分页、统计、业务异常）归属 `service`；持久化只允许经 `repository` 访问（当前为版本化 JSON 文件，禁止在 service/controller 内直接 `fs` 读写）。金额一律以「分」为整数存储，禁止用浮点累加金额。
- **接口与契约规范**：所有业务路由统一前缀 `/api/v1/payment-records`，必须挂 `ApiKeyGuard`；成功响应由全局拦截器包装为 `{ code: 0, message, data, requestId }`，可预期错误必须抛 `BizException(ErrorCode, message)`，禁止手写不一致的外层 JSON 或静默吞异常；入参 DTO 必须使用 `class-validator` 强校验。
- **数据文件与敏感信息**：数据文件路径统一由 `PAYMENT_DATA_FILE` 配置（默认 `data/payment-records.json`，已 gitignore），接口访问密钥只允许来自 `PAYMENT_API_KEY` 环境变量，禁止硬编码或提交真实密钥；日志禁止打印密钥与完整记录内容。
- **默认加载技能**：`.agents/skills/nestjs-backend/`、`.agents/skills/security-and-testing/`。

