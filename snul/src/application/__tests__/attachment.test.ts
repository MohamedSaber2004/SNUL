import { describe, it, expect } from 'vitest';
import { toUploadPlace } from '../attachment.service';
describe('toUploadPlace', () => {
  it('maps ticket context to place 1', () => {
    expect(toUploadPlace('ticket')).toBe(1);
  });
});
