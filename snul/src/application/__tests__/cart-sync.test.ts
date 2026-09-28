import { describe, it, expect } from 'vitest';
import { buildCreateCartPayload } from '../commerce.service';
describe('buildCreateCartPayload', () => {
  it('uses sessionId for guests, userId for auth', () => {
    expect(buildCreateCartPayload(null, 'sess-1', 'cur-1')).toEqual({ sessionId: 'sess-1', currencyId: 'cur-1' });
    expect(buildCreateCartPayload('u-1', 'sess-1', 'cur-1')).toEqual({ userId: 'u-1', currencyId: 'cur-1' });
  });
});
