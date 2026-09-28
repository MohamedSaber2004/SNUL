import { describe, it, expect } from 'vitest';
import { normalizeEnvelope } from '../http-client';
describe('normalizeEnvelope', () => {
  it('unwraps Welco Result envelope', () => {
    const out = normalizeEnvelope({ isSuccess: true, statusCode: 200, message: 'ok', errors: [], data: { id: 1 } });
    expect(out).toEqual({ id: 1 });
  });
});
