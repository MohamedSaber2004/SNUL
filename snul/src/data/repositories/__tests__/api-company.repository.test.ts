import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiCompanyRepository } from '../api-company.repository';

/**
 * Regression guard for the "organization details shows a blank card labelled
 * pending" bug.
 *
 * On a 401 the HttpClient resolves (rather than throws) with a list-shaped
 * empty envelope: { isSuccess: false, data: [], totalCount: 0, ... }.
 * getMyCompany() used to spread that straight into a CompanyDto, producing a
 * non-null company with id: '' and no status — which the profile rendered as
 * an empty organization card whose status label fell through to "pending".
 */
describe('ApiCompanyRepository.getMyCompany', () => {
  let http: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    http = { get: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const repo = () => new ApiCompanyRepository(http as never);

  it('returns the company when the API responds with a real record', async () => {
    http.get.mockResolvedValue({
      id: 'b656ee7f-0e12-4ccb-a981-ffc4f68d049a',
      name: 'provider apex',
      imageName: 'logo.png',
      status: 2,
    });

    const result = await repo().getMyCompany();

    expect(result).not.toBeNull();
    expect(result!.id).toBe('b656ee7f-0e12-4ccb-a981-ffc4f68d049a');
    expect(result!.name).toBe('provider apex');
    expect(result!.imageName).toBe('logo.png');
  });

  it('returns null for the 401 empty envelope instead of a fake company', async () => {
    http.get.mockResolvedValue({
      isSuccess: false,
      data: [],
      totalCount: 0,
      pageNumber: 1,
      pageSize: 10,
      statusCode: 401,
    });

    await expect(repo().getMyCompany()).resolves.toBeNull();
  });

  it('returns null when the payload is an array', async () => {
    http.get.mockResolvedValue([]);

    await expect(repo().getMyCompany()).resolves.toBeNull();
  });

  it('returns null for an empty object', async () => {
    http.get.mockResolvedValue({});

    await expect(repo().getMyCompany()).resolves.toBeNull();
  });

  it('accepts a PascalCase id and normalizes it', async () => {
    http.get.mockResolvedValue({ Id: 'abc-123', Name: 'Legacy Shape' });

    const result = await repo().getMyCompany();

    expect(result).not.toBeNull();
    expect(result!.id).toBe('abc-123');
  });
});
