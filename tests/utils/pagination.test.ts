import { describe, expect, it } from '@jest/globals';
import { normalizePagination } from '../../src/utils/pagination';

describe('Pagination utility', () => {
  it('clamps invalid page and limit values', () => {
    expect(normalizePagination({ page: 0, limit: 0 })).toEqual({ page: 1, limit: 10 });
    expect(normalizePagination({ page: 2, limit: 200 })).toEqual({ page: 2, limit: 50 });
  });

  it('returns the expected metadata shape when total is present', () => {
    expect(normalizePagination({ page: 3, limit: 10, total: 32 })).toEqual({
      page: 3,
      limit: 10,
      total: 32,
      totalPages: 4,
      hasNext: true,
      offset: 20,
    });
  });

  it('handles totals equal to zero', () => {
    expect(normalizePagination({ page: 1, limit: 10, total: 0 })).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 1,
      hasNext: false,
      offset: 0,
    });
  });
});
