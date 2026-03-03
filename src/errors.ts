import { isAxiosError } from 'axios';

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'API_KEY_ERROR'
  | 'RATE_LIMIT'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL_ERROR';

export interface CoreErrorShape {
  code: ErrorCode;
  message: string;
  hint?: string;
  details?: unknown;
  retryable: boolean;
}

export class CoreError extends Error {
  readonly code: ErrorCode;
  readonly hint?: string;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(shape: CoreErrorShape) {
    super(shape.message);
    this.code = shape.code;
    this.hint = shape.hint;
    this.details = shape.details;
    this.retryable = shape.retryable;
  }

  toJSON(): CoreErrorShape {
    return {
      code: this.code,
      message: this.message,
      ...(this.hint && { hint: this.hint }),
      ...(this.details !== undefined && { details: this.details }),
      retryable: this.retryable,
    };
  }
}

const SETUP_GUIDE = 'https://github.com/BearMett/korbus-mcp#api-키-발급';

export function apiKeyError(region: string, rawMessage?: string): CoreError {
  return new CoreError({
    code: 'API_KEY_ERROR',
    message: `[${region}] API 키가 등록되지 않았거나 해당 서비스가 활용 신청되지 않았습니다.`,
    hint: `data.go.kr에서 ${region} 버스 관련 서비스 3개의 활용 신청을 확인하세요. 가이드: ${SETUP_GUIDE}`,
    details: rawMessage,
    retryable: false,
  });
}

export function apiKeyExpiredError(region: string): CoreError {
  return new CoreError({
    code: 'API_KEY_ERROR',
    message: `[${region}] API 키가 만료되었습니다.`,
    hint: `data.go.kr 마이페이지에서 인증키 갱신 후 환경변수를 업데이트하세요. 가이드: ${SETUP_GUIDE}`,
    retryable: false,
  });
}

export function rateLimitError(region: string): CoreError {
  return new CoreError({
    code: 'RATE_LIMIT',
    message: `[${region}] API 호출 한도를 초과했습니다.`,
    hint: '잠시 후 다시 시도해주세요. 공공데이터포털 기본 한도는 일 1,000건입니다.',
    retryable: true,
  });
}

export function toCoreError(error: unknown): CoreError {
  if (error instanceof CoreError) {
    return error;
  }

  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      return new CoreError({
        code: 'UPSTREAM_TIMEOUT',
        message: '공공데이터 API 서버 응답 시간이 초과되었습니다.',
        hint: '잠시 후 다시 시도해주세요.',
        retryable: true,
      });
    }
    const status = error.response?.status;
    return new CoreError({
      code: 'INTERNAL_ERROR',
      message: `공공데이터 API 요청 실패${status ? ` (HTTP ${status})` : ''}`,
      retryable: status != null && status >= 500,
    });
  }

  return new CoreError({
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Unknown internal error',
    retryable: false,
  });
}
