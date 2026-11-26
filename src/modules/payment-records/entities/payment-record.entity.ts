/** 支付方式（对外枚举值，禁止随意变更） */
export enum PaymentMethod {
  CASH = 'CASH',
  BANK_CARD = 'BANK_CARD',
  WECHAT = 'WECHAT',
  ALIPAY = 'ALIPAY',
  OTHER = 'OTHER',
}

/** 付款记录持久化实体 */
export interface PaymentRecord {
  /** 记录唯一标识（UUID v4） */
  id: string;
  /** 金额，单位：分（整数存储，避免浮点累计误差） */
  amountInCents: number;
  /** 付款时间，ISO-8601 字符串 */
  paidAt: string;
  /** 付款对象 / 用途 */
  payee: string;
  method: PaymentMethod;
  /** 备注，无备注时为 null */
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 磁盘数据文件格式（带版本号，便于后续 Migration） */
export interface PaymentRecordStore {
  version: number;
  records: PaymentRecord[];
}

export const PAYMENT_RECORD_STORE_VERSION = 1;
