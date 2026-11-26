import { IsEnum, IsISO8601, IsNumber, IsOptional, IsString, Length, Max, MaxLength, Min } from 'class-validator';

import { PaymentMethod } from '../entities/payment-record.entity';

/** 编辑付款记录入参：至少提供一个字段，由 Service 层做“空补丁”校验 */
export class UpdatePaymentRecordDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'amount 必须为数字且最多两位小数' })
  @Min(0.01, { message: 'amount 必须大于 0' })
  @Max(99999999.99, { message: 'amount 超出允许范围' })
  amount?: number;

  @IsOptional()
  @IsISO8601({ strict: false }, { message: 'paidAt 必须为 ISO-8601 时间字符串' })
  paidAt?: string;

  @IsOptional()
  @IsString({ message: 'payee 必须为字符串' })
  @Length(1, 64, { message: 'payee 长度需在 1-64 之间' })
  payee?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, {
    message: `method 必须为 ${Object.values(PaymentMethod).join('/')} 之一`,
  })
  method?: PaymentMethod;

  @IsOptional()
  @IsString({ message: 'note 必须为字符串' })
  @MaxLength(200, { message: 'note 长度不能超过 200' })
  note?: string;
}
