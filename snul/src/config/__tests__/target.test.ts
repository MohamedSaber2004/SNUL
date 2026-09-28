import { describe, it, expect } from 'vitest';
import { resolveGateway } from '../api.config';
describe('resolveGateway', () => {
  it('defaults to SNUL gateway or welco when specified', () => {
    expect(resolveGateway('')).toContain('snul-gateway');
    expect(resolveGateway('welco')).toContain('welco-gateway');
  });
});
