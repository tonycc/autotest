/** 全局业务错误码（对外契约，禁止随意变更已发布取值） */
export enum ErrorCode {
  /** 入参校验失败 */
  INVALID_PARAM = 1001,
  /** 资源不存在 */
  NOT_FOUND = 1002,
  /** 未授权（缺少/错误的访问密钥） */
  UNAUTHORIZED = 1003,
  /** 服务端内部错误 */
  INTERNAL = 9999,
}
