import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiMarketplaceRepository } from '../api-marketplace.repository';

/**
 * Guards the isolation between the two landing-page category sections:
 *
 *   - "Browse by Category"          -> getCategoriesPaginated() -> GET /categories
 *   - "Browse by Clinical Specialty"-> getCategories()          -> GET /categories/all
 *
 * They previously shared one source, so paging the grid silently truncated the
 * specialty filter's options to whatever fitted on a page. These tests pin each
 * method to its own route and its own paging semantics.
 */
describe('category endpoints are isolated per landing section', () => {
  let http: { get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    http = { get: vi.fn() };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const repo = () => new ApiMarketplaceRepository(http as never);

  const page = (rows: unknown[], totalCount: number, pageNumber: number, pageSize: number) => ({
    isSuccess: true,
    data: rows,
    totalCount,
    pageNumber,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    hasPreviousPage: pageNumber > 1,
    hasNextPage: pageNumber * pageSize < totalCount,
    message: '',
    statusCode: 200,
  });

  const cat = (id: string, nameEn: string, nameAr: string) => ({
    id,
    slug: nameEn.toLowerCase().replace(/\s+/g, '-'),
    nameEn,
    nameAr,
  });

  it('getCategoriesPaginated hits the PAGINATED /categories route', async () => {
    http.get.mockResolvedValue(page([cat('c1', 'Forceps', 'كماشة')], 20, 2, 8));

    const result = await repo().getCategoriesPaginated({ pageNumber: 2, pageSize: 8 });

    expect(http.get).toHaveBeenCalledTimes(1);
    const url = http.get.mock.calls[0][0] as string;
    expect(url).toContain('/api/v1/categories?');
    expect(url).not.toContain('/categories/all');
    expect(url).toContain('pageNumber=2');
    expect(url).toContain('pageSize=8');
    expect(result.totalCount).toBe(20);
    expect(result.pageNumber).toBe(2);
    expect(result.hasNextPage).toBe(true);
    expect(result.hasPreviousPage).toBe(true);
  });

  it('getCategoriesPaginated only returns the requested page, not every row', async () => {
    // Server answers with just this page's 8 rows out of 20 total.
    const rows = Array.from({ length: 8 }, (_, i) => cat(`c${i}`, `Cat ${i}`, `فئة ${i}`));
    http.get.mockResolvedValue(page(rows, 20, 1, 8));

    const result = await repo().getCategoriesPaginated({ pageNumber: 1, pageSize: 8 });

    expect(result.data).toHaveLength(8);
    expect(result.totalCount).toBe(20);
    expect(result.totalPages).toBe(3);
  });

  it('getCategories hits the UNPAGINATED /categories/all route', async () => {
    const all = Array.from({ length: 20 }, (_, i) => cat(`c${i}`, `Cat ${i}`, `فئة ${i}`));
    http.get.mockResolvedValue(all);

    const result = await repo().getCategories();

    expect(http.get).toHaveBeenCalledTimes(1);
    const url = http.get.mock.calls[0][0] as string;
    expect(url).toBe('/api/v1/categories/all');
    expect(url).not.toContain('pageNumber');
    expect(result).toHaveLength(20);
  });

  it('the two methods never share a request', async () => {
    http.get.mockResolvedValue(page([cat('c1', 'Forceps', 'كماشة')], 1, 1, 8));

    await repo().getCategoriesPaginated({ pageNumber: 1, pageSize: 8 });
    const firstUrl = http.get.mock.calls[0][0] as string;
    http.get.mockReset();
    http.get.mockResolvedValue([cat('c1', 'Forceps', 'كماشة')]);

    await repo().getCategories();
    const secondUrl = http.get.mock.calls[0][0] as string;

    expect(firstUrl).not.toBe(secondUrl);
  });

  it('paging the grid does not change what the specialty filter receives', async () => {
    // Page 1 of the grid holds 2 of 20 categories.
    http.get.mockResolvedValue(page([cat('c1', 'Forceps', 'كماشة'), cat('c2', 'Scalpels', 'مشارب')], 20, 1, 2));
    const grid = await repo().getCategoriesPaginated({ pageNumber: 1, pageSize: 2 });
    expect(grid.data).toHaveLength(2);

    // The filter's own source is untouched by that paging.
    http.get.mockReset();
    const all = Array.from({ length: 20 }, (_, i) => cat(`c${i}`, `Cat ${i}`, `فئة ${i}`));
    http.get.mockResolvedValue(all);
    const specialties = await repo().getCategories();
    expect(specialties).toHaveLength(20);
  });

  it('getCategoriesPaginated normalizes rows and tolerates a bare array', async () => {
    // Defensive: if the route ever returns a plain array, report it as one page.
    http.get.mockResolvedValue([cat('c1', 'Forceps', 'كماشة')]);

    const result = await repo().getCategoriesPaginated({ pageNumber: 1, pageSize: 8 });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].nameEn).toBe('Forceps');
    expect(result.totalCount).toBe(1);
    expect(result.totalPages).toBe(1);
    expect(result.hasNextPage).toBe(false);
  });

  it('getCategoriesPaginated forwards searchTerm and isActive when supplied', async () => {
    http.get.mockResolvedValue(page([], 0, 1, 8));

    await repo().getCategoriesPaginated({ pageNumber: 1, pageSize: 8, searchTerm: '  forceps  ', isActive: true });

    const url = http.get.mock.calls[0][0] as string;
    expect(url).toContain('searchTerm=forceps');
    expect(url).toContain('isActive=true');
  });
});
