import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

import { PaymentMethod } from '../entities/payment-record.entity';

/** 新增付款记录入参 */
export class CreatePaymentRecordDto {
  /** 金额，单位：元，最多两位小数 */
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount 必须为数字且最多两位小数' })
  @Min(0.01, { message: 'amount 必须大于 0' })
  @Max(99999999.99, { message: 'amount 超出允许范围' })
  amount!: number;

  /** 付款时间，ISO-8601（如 2026-11-26T10:00:00+08:00） */
  @IsISO8601({ strict: false }, { message: 'paidAt 必须为 ISO-8601 时间字符串' })
  paidAt!: string;

  /** 付款对象 / 用途 */
  @IsString({ message: 'payee 必须为字符串' })
  @Length(1, 64, { message: 'payee 长度需在 1-64 之间' })
  payee!: string;

  /** 支付方式 */
  @IsEnum(PaymentMethod, {
    message: `method 必须为 ${Object.values(PaymentMethod).join('/')} 之一`,
  })
  method!: PaymentMethod;

  /** 备注（可选） */
  @IsOptional()
  @IsString({ message: 'note 必须为字符串' })
  @MaxLength(200, { message: 'note 长度不能超过 200' })
  note?: string;
}
