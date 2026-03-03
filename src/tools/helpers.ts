import { toCoreError } from '../errors.js';

export function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function errorResult(error: unknown) {
  const coreError = toCoreError(error);
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify(coreError.toJSON(), null, 2) }],
  };
}
