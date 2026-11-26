/** 统一响应契约 */
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  requestId: string;
}
