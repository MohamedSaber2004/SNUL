import { describe, it, expect } from 'vitest';
import { isSalesRole } from '../../domain/models/business-role';
describe('isSalesRole', () => {
  it('treats WelcoStaff, SnulStaff, and Sales identically', () => {
    expect(isSalesRole('WelcoStaff')).toBe(true);
    expect(isSalesRole('SnulStaff')).toBe(true);
    expect(isSalesRole('Sales')).toBe(true);
    expect(isSalesRole('Client')).toBe(false);
    expect(isSalesRole('Admin')).toBe(false);
  });
});