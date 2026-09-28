import { describe, it, expect } from 'vitest';
import { COMPANY_ROUTES } from '../api.config';
describe('route truth', () => {
  it('points OEM to oem-inquiries', () => {
    expect(COMPANY_ROUTES.oemInquiries).toBe('/api/v1/oem-inquiries');
  });
});
