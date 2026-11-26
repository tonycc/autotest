import { PaymentMethod } from '../entities/payment-record.entity';

/** 付款记录对外视图（金额单位为元） */
export interface PaymentRecordView {
  id: string;
  amount: number;
  paidAt: string;
  payee: string;
  method: PaymentMethod;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** 分页列表对外视图 */
export interface PaginatedPaymentRecords {
  items: PaymentRecordView[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 按支付方式聚合的统计项 */
export interface MethodStatisticsItem {
  method: PaymentMethod;
  amount: number;
  count: number;
}

/** 统计汇总对外视图 */
export interface PaymentStatisticsView {
  /** 统计月份（YYYY-MM） */
  month: string;
  /** 累计支出金额（元） */
  totalAmount: number;
  /** 累计记录条数 */
  totalCount: number;
  /** 当月支出金额（元） */
  monthlyAmount: number;
  /** 当月记录条数 */
  monthlyCount: number;
  /** 全部记录的支付方式分布（按金额倒序） */
  byMethod: MethodStatisticsItem[];
}

/** 删除结果 */
export interface DeletePaymentRecordResult {
  id: string;
  deleted: boolean;
}
