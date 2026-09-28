import { describe, it, expect, vi } from 'vitest';
import { TokenStore } from '../token-store';
describe('TokenStore refresh', () => {
  it('reports expiring token within 5 min window', () => {
    const s = new TokenStore();
    const exp = Math.floor(Date.now() / 1000) + 120;
    expect(s.isExpiringSoon(exp, 300)).toBe(true);
  });
});
