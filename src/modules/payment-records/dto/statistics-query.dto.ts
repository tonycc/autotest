import { IsOptional, Matches } from 'class-validator';

/** 统计查询入参：month 形如 2026-11，缺省按当前月统计 */
export class StatisticsQueryDto {
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, { message: 'month 格式必须为 YYYY-MM' })
  month?: string;
}
