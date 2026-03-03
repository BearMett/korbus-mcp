export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UPSTREAM_TIMEOUT'
  | 'INTERNAL_ERROR';

export interface CoreErrorShape {
  code: ErrorCode;
  message: string;
  details?: unknown;
  retryable: boolean;
}

export class CoreError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly retryable: boolean;

  constructor(shape: CoreErrorShape) {
    super(shape.message);
    this.code = shape.code;
    this.details = shape.details;
    this.retryable = shape.retryable;
  }

  toJSON(): CoreErrorShape {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      retryable: this.retryable,
    };
  }
}

export function toCoreError(error: unknown): CoreError {
  if (error instanceof CoreError) {
    return error;
  }

  return new CoreError({
    code: 'INTERNAL_ERROR',
    message: error instanceof Error ? error.message : 'Unknown internal error',
    details: error,
    retryable: false,
  });
}
